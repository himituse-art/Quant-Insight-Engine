import { logger } from "./logger";
import { STOCK_UNIVERSE } from "./stockUniverse";
import { getQuoteSummary, getChartHistory, getNews, type QuoteSummaryResult } from "./marketData";
import { computeGuruScores, computeDcfValuation } from "./quantCalculations";

interface UniverseSnapshot {
  symbol: string;
  name: string;
  sector: string;
  quote: QuoteSummaryResult | null;
  closes: number[];
  newsTitles: string[];
}

const CONCURRENCY = 8;
const SCREENER_CACHE_TTL_MS = 5 * 60_000;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

let universeCache: { expiresAt: number; value: UniverseSnapshot[] } | null =
  null;

async function loadUniverseSnapshots(): Promise<UniverseSnapshot[]> {
  if (universeCache && universeCache.expiresAt > Date.now()) {
    return universeCache.value;
  }

  const snapshots = await mapWithConcurrency(
    STOCK_UNIVERSE,
    CONCURRENCY,
    async (stock): Promise<UniverseSnapshot> => {
      try {
        const [quote, chart, news] = await Promise.all([
          getQuoteSummary(stock.symbol),
          getChartHistory(stock.symbol),
          getNews(stock.symbol),
        ]);
        return {
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          quote,
          closes: chart?.closes ?? [],
          newsTitles: news.map((n) => n.title),
        };
      } catch (err) {
        logger.warn({ err, symbol: stock.symbol }, "Failed to load universe snapshot");
        return {
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          quote: null,
          closes: [],
          newsTitles: [],
        };
      }
    },
  );

  universeCache = { expiresAt: Date.now() + SCREENER_CACHE_TTL_MS, value: snapshots };
  return snapshots;
}

export interface ScreenerStock {
  symbol: string;
  name: string;
  price: number | null;
  metricLabel: string;
  metricValue: number | null;
  rank: number;
}

export interface ScreenerList {
  key: string;
  title: string;
  description: string;
  stocks: ScreenerStock[];
}

function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(closes.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / period / (losses / period);
  return 100 - 100 / (1 + rs);
}

function percentileRank(values: number[], value: number): number {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return 0.5;
  const below = finite.filter((v) => v <= value).length;
  return below / finite.length;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Screener 1: Undervalued Top 10 (High Margin of Safety)
 * Pre-filters: Market Cap > $5B AND ROE (TTM) > 12%.
 * DCF (WACC 9%, terminal growth 2.5%) -> Margin of Safety.
 * Since 5Y historical PE series is not available from live Yahoo endpoints,
 * "5Y PE Percentile" is approximated as this stock's trailing-PE percentile
 * rank across the eligible screening universe (cross-sectional proxy).
 */
function computeUndervalued(snapshots: UniverseSnapshot[]): ScreenerList {
  const DISCOUNT_RATE = 0.09;
  const TERMINAL_GROWTH = 0.025;
  const YEARS = 5;

  const eligible = snapshots.filter((s) => {
    const marketCap = s.quote?.summaryDetail?.marketCap ?? null;
    const roe = s.quote?.financialData?.returnOnEquity ?? null;
    return marketCap != null && marketCap > 5e9 && roe != null && roe > 0.12;
  });

  const peValues = eligible
    .map((s) => s.quote?.summaryDetail?.trailingPE ?? null)
    .filter((v): v is number => v != null && Number.isFinite(v));

  const scored = eligible
    .map((s) => {
      const price = s.quote?.price?.regularMarketPrice ?? null;
      const eps = s.quote?.defaultKeyStatistics?.trailingEps ?? null;
      let growth = s.quote?.financialData?.earningsGrowth ?? 0.08;
      growth = Math.max(-0.1, Math.min(growth, 0.35));

      if (price == null || eps == null || eps <= 0) return null;

      let presentValue = 0;
      let projectedEarnings = eps;
      for (let year = 1; year <= YEARS; year++) {
        projectedEarnings *= 1 + growth;
        presentValue += projectedEarnings / Math.pow(1 + DISCOUNT_RATE, year);
      }
      const terminalValue =
        (projectedEarnings * (1 + TERMINAL_GROWTH)) /
        (DISCOUNT_RATE - TERMINAL_GROWTH);
      const discountedTerminalValue =
        terminalValue / Math.pow(1 + DISCOUNT_RATE, YEARS);
      const fairValue = presentValue + discountedTerminalValue;
      const marginOfSafety = ((fairValue - price) / fairValue) * 100;

      const pe = s.quote?.summaryDetail?.trailingPE ?? null;
      const peRankInverse =
        pe != null ? 1 - percentileRank(peValues, pe) : 0.5;

      const valueScore = marginOfSafety * 0.7 + peRankInverse * 100 * 0.3;

      return {
        symbol: s.symbol,
        name: s.name,
        price: round2(price),
        metricLabel: "Value Score",
        metricValue: round2(valueScore),
        marginOfSafety,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.metricValue - a.metricValue)
    .slice(0, 10)
    .map((s, i) => ({
      symbol: s.symbol,
      name: s.name,
      price: s.price,
      metricLabel: s.metricLabel,
      metricValue: s.metricValue,
      rank: i + 1,
    }));

  return {
    key: "undervalued",
    title: "Undervalued Top 10",
    description:
      "High margin-of-safety picks: Market cap > $5B, ROE > 12%, ranked by a 5-year DCF (9% WACC, 2.5% terminal growth) margin of safety blended with trailing-PE percentile.",
    stocks: scored,
  };
}

/**
 * Screener 2: Best to Buy Now Top 10 (Guru & Momentum Consensus)
 * Pre-filters: Buffett Score > 80 AND Lynch Score > 80 AND Price > 50MA.
 * Technical Momentum: base 80 if Price > 20MA > 50MA > 200MA, +20 if RSI in [35,60], -40 if RSI > 75.
 */
function computeBestToBuyNow(snapshots: UniverseSnapshot[]): ScreenerList {
  const scored = snapshots
    .map((s) => {
      const price = s.quote?.price?.regularMarketPrice ?? null;
      const sma20 = sma(s.closes, 20);
      const sma50 = sma(s.closes, 50);
      const sma200 = sma(s.closes, 200);
      const rsi14 = rsi(s.closes, 14);
      const guru = computeGuruScores(s.quote);

      if (price == null || sma50 == null) return null;
      if (guru.buffettScore <= 80 || guru.lynchScore <= 80) return null;
      if (price <= sma50) return null;

      let momentum = 0;
      const bullishAlignment =
        sma20 != null &&
        sma200 != null &&
        price > sma20 &&
        sma20 > sma50 &&
        sma50 > sma200;
      if (bullishAlignment) momentum += 80;

      if (rsi14 != null) {
        if (rsi14 >= 35 && rsi14 <= 60) momentum += 20;
        else if (rsi14 > 75) momentum -= 40;
      }

      const guruAvg = (guru.buffettScore + guru.lynchScore) / 2;
      const finalScore = guruAvg * 0.5 + momentum * 0.5;

      return {
        symbol: s.symbol,
        name: s.name,
        price: round2(price),
        metricLabel: "Consensus Score",
        metricValue: round2(finalScore),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.metricValue - a.metricValue)
    .slice(0, 10)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return {
    key: "best-to-buy-now",
    title: "Best to Buy Now Top 10",
    description:
      "Guru & momentum consensus: Buffett score > 80, Lynch score > 80, price above 50-day moving average, ranked by blended guru score and technical momentum (MA alignment + RSI).",
    stocks: scored,
  };
}

/**
 * Screener 3: 3-Year Highest Return Top 10 (Growth Momentum)
 * Pre-filters: revenue/net-income growth positive AND PEG < 1.2.
 * Live 3Y CAGR and 2029 consensus EPS are not exposed by the free Yahoo endpoints,
 * so YoY revenue/earnings growth is used as the positivity check, and a 3-year
 * compounding of forward EPS at the current earnings-growth rate approximates
 * "2029 Expected EPS". min(trailing PE, forward PE) approximates "5Y Average PE".
 */
function computeThreeYearReturn(snapshots: UniverseSnapshot[]): ScreenerList {
  const scored = snapshots
    .map((s) => {
      const price = s.quote?.price?.regularMarketPrice ?? null;
      const revenueGrowth = s.quote?.financialData?.revenueGrowth ?? null;
      const earningsGrowth = s.quote?.financialData?.earningsGrowth ?? null;
      const peg = s.quote?.defaultKeyStatistics?.pegRatio ?? null;
      const forwardEps = s.quote?.defaultKeyStatistics?.forwardEps ?? null;
      const trailingPe = s.quote?.summaryDetail?.trailingPE ?? null;
      const forwardPe = s.quote?.summaryDetail?.forwardPE ?? null;

      if (price == null || forwardEps == null || forwardEps <= 0) return null;
      if (revenueGrowth == null || earningsGrowth == null) return null;
      if (revenueGrowth <= 0 || earningsGrowth <= 0) return null;
      if (peg == null || peg <= 0 || peg >= 1.2) return null;

      const growth = Math.max(-0.1, Math.min(earningsGrowth, 0.4));
      const targetEps2029 = forwardEps * Math.pow(1 + growth, 3);
      const referencePe = Math.min(
        ...[trailingPe, forwardPe].filter(
          (v): v is number => v != null && v > 0,
        ),
        50,
      );
      const targetPrice = targetEps2029 * referencePe;

      if (!Number.isFinite(targetPrice) || targetPrice <= 0) return null;

      const cagr = (Math.pow(targetPrice / price, 1 / 3) - 1) * 100;

      return {
        symbol: s.symbol,
        name: s.name,
        price: round2(price),
        metricLabel: "Est. 3Y CAGR",
        metricValue: round2(cagr),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.metricValue - a.metricValue)
    .slice(0, 10)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return {
    key: "three-year-return",
    title: "3-Year Highest Return Top 10",
    description:
      "Growth momentum: positive revenue & earnings growth, PEG < 1.2, ranked by estimated 3-year CAGR from a projected 2029 EPS target price versus current price.",
    stocks: scored,
  };
}

const AI_KEYWORDS = [
  "artificial intelligence",
  "\\bai\\b",
  "\\bllm\\b",
  "data center",
  "generative ai",
];
const AI_KEYWORD_REGEX = new RegExp(AI_KEYWORDS.join("|"), "gi");

/**
 * Screener 4: AI Beneficiary Top 10 (NLP Keyword Matcher)
 * Scans recent news headlines for AI keyword frequency (C_AI).
 * Free Yahoo endpoints do not expose R&D expense directly, so gross margin
 * is used as a proxy for R&D-intensity (heuristic, consistent with the
 * app's existing "AI Disruption Benefit" score elsewhere).
 */
function computeAiBeneficiary(snapshots: UniverseSnapshot[]): ScreenerList {
  const scored = snapshots
    .map((s) => {
      const price = s.quote?.price?.regularMarketPrice ?? null;
      const grossMargin = s.quote?.financialData?.grossMargins ?? 0;
      const revenueGrowth = s.quote?.financialData?.revenueGrowth ?? 0;
      if (price == null) return null;

      const text = s.newsTitles.join(" . ");
      const matches = text.match(AI_KEYWORD_REGEX);
      const cAi = matches ? matches.length : 0;

      const rdProxy = Math.max(0, Math.min(grossMargin, 1)) * 100;
      const revenueGrowthPct = Math.max(0, revenueGrowth) * 100;

      const score = cAi * 0.4 + rdProxy * 0.4 + revenueGrowthPct * 0.2;

      return {
        symbol: s.symbol,
        name: s.name,
        price: round2(price),
        metricLabel: "AI Benefit Score",
        metricValue: round2(score),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.metricValue - a.metricValue)
    .slice(0, 10)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return {
    key: "ai-beneficiary",
    title: "AI Beneficiary Top 10",
    description:
      "NLP keyword matcher: scores recent news for AI-related keyword frequency, blended with gross margin (R&D-intensity proxy) and YoY revenue growth.",
    stocks: scored,
  };
}

/**
 * Screener 5: Defensive Top 10 (Low Volatility / Safe Haven)
 * Pre-filters: Beta (5Y monthly) < 0.75 AND Debt-to-Equity < 1.0.
 * Note: debtToEquity from Yahoo is expressed as a percentage (e.g. 45 = 0.45x),
 * so the 1.0x threshold is applied as < 100.
 */
function computeDefensive(snapshots: UniverseSnapshot[]): ScreenerList {
  const scored = snapshots
    .map((s) => {
      const price = s.quote?.price?.regularMarketPrice ?? null;
      const beta =
        s.quote?.summaryDetail?.beta ?? s.quote?.defaultKeyStatistics?.beta ?? null;
      const debtToEquity = s.quote?.financialData?.debtToEquity ?? null;
      const dividendYield =
        s.quote?.summaryDetail?.dividendYield ??
        s.quote?.summaryDetail?.trailingAnnualDividendYield ??
        0;
      const fcf = s.quote?.financialData?.freeCashflow ?? null;
      const revenue = s.quote?.financialData?.totalRevenue ?? null;

      if (price == null || beta == null || debtToEquity == null) return null;
      if (beta >= 0.75 || debtToEquity >= 100) return null;

      const fcfMargin =
        fcf != null && revenue != null && revenue > 0 ? fcf / revenue : 0;

      const defensiveScore =
        (1 - beta) * 40 +
        Math.min(dividendYield / 0.08, 1) * 30 +
        Math.min(Math.max(fcfMargin, 0) / 0.3, 1) * 30;

      return {
        symbol: s.symbol,
        name: s.name,
        price: round2(price),
        metricLabel: "Defensive Score",
        metricValue: round2(defensiveScore),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.metricValue - a.metricValue)
    .slice(0, 10)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return {
    key: "defensive",
    title: "Defensive Top 10",
    description:
      "Low-volatility safe havens: Beta < 0.75, Debt-to-Equity < 1.0x, ranked by low beta, dividend yield, and free-cash-flow margin.",
    stocks: scored,
  };
}

export async function getScreeners(): Promise<ScreenerList[]> {
  const snapshots = await loadUniverseSnapshots();

  return [
    computeUndervalued(snapshots),
    computeBestToBuyNow(snapshots),
    computeThreeYearReturn(snapshots),
    computeAiBeneficiary(snapshots),
    computeDefensive(snapshots),
  ];
}
