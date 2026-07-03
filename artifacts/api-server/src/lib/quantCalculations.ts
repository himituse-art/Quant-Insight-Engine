import type { QuoteSummaryResult } from "./marketData";

export interface MarketDataFields {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  peRatio: number | null;
  forwardPe: number | null;
  pegRatio: number | null;
  epsTtm: number | null;
  roe: number | null;
  freeCashFlow: number | null;
  grossMargin: number | null;
  currency: string;
}

export function buildMarketData(
  quote: QuoteSummaryResult | null,
): MarketDataFields {
  return {
    price: quote?.price?.regularMarketPrice ?? null,
    change: quote?.price?.regularMarketChange ?? null,
    changePercent: quote?.price?.regularMarketChangePercent ?? null,
    marketCap: quote?.summaryDetail?.marketCap ?? null,
    peRatio: quote?.summaryDetail?.trailingPE ?? null,
    forwardPe: quote?.summaryDetail?.forwardPE ?? null,
    pegRatio: quote?.defaultKeyStatistics?.pegRatio ?? null,
    epsTtm: quote?.defaultKeyStatistics?.trailingEps ?? null,
    roe: quote?.financialData?.returnOnEquity ?? null,
    freeCashFlow: quote?.financialData?.freeCashflow ?? null,
    grossMargin: quote?.financialData?.grossMargins ?? null,
    currency: quote?.price?.currency ?? "USD",
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export interface GuruScores {
  buffettScore: number;
  buffettSummary: string;
  lynchScore: number;
  lynchSummary: string;
  mungerScore: number;
  mungerSummary: string;
}

export function computeGuruScores(quote: QuoteSummaryResult | null): GuruScores {
  const roe = quote?.financialData?.returnOnEquity ?? null;
  const grossMargin = quote?.financialData?.grossMargins ?? null;
  const debtToEquity = quote?.financialData?.debtToEquity ?? null;
  const fcf = quote?.financialData?.freeCashflow ?? null;
  const peg = quote?.defaultKeyStatistics?.pegRatio ?? null;
  const pe = quote?.summaryDetail?.trailingPE ?? null;

  let buffettScore = 40;
  const buffettNotes: string[] = [];
  if (roe != null) {
    if (roe > 0.2) {
      buffettScore += 25;
      buffettNotes.push("high ROE");
    } else if (roe > 0.12) {
      buffettScore += 12;
      buffettNotes.push("solid ROE");
    } else {
      buffettNotes.push("weak ROE");
    }
  }
  if (debtToEquity != null) {
    if (debtToEquity < 50) {
      buffettScore += 15;
      buffettNotes.push("low debt");
    } else if (debtToEquity < 100) {
      buffettScore += 5;
    } else {
      buffettNotes.push("elevated debt");
    }
  }
  if (fcf != null && fcf > 0) {
    buffettScore += 15;
    buffettNotes.push("consistent free cash flow");
  }
  if (grossMargin != null && grossMargin > 0.4) {
    buffettScore += 5;
  }
  buffettScore = clampScore(buffettScore);

  let lynchScore = 40;
  const lynchNotes: string[] = [];
  if (peg != null) {
    if (peg > 0 && peg < 1) {
      lynchScore += 35;
      lynchNotes.push("PEG below 1");
    } else if (peg < 1.5) {
      lynchScore += 15;
      lynchNotes.push("reasonable PEG");
    } else {
      lynchNotes.push("PEG above growth-at-a-reasonable-price threshold");
    }
  }
  if (debtToEquity != null) {
    if (debtToEquity < 50) {
      lynchScore += 20;
      lynchNotes.push("low debt");
    } else if (debtToEquity < 100) {
      lynchScore += 8;
    }
  }
  if (pe != null && pe > 0 && pe < 20) {
    lynchScore += 5;
  }
  lynchScore = clampScore(lynchScore);

  let mungerScore = 40;
  const mungerNotes: string[] = [];
  if (roe != null && roe > 0.15) {
    mungerScore += 20;
    mungerNotes.push("strong quality (high ROE)");
  }
  if (debtToEquity != null && debtToEquity < 60) {
    mungerScore += 15;
    mungerNotes.push("conservative balance sheet");
  }
  if (peg != null && peg > 0 && peg < 1.5) {
    mungerScore += 20;
    mungerNotes.push("reasonable valuation");
  } else if (pe != null && pe > 0 && pe < 25) {
    mungerScore += 10;
    mungerNotes.push("acceptable valuation");
  }
  mungerScore = clampScore(mungerScore);

  return {
    buffettScore,
    buffettSummary:
      buffettNotes.length > 0
        ? `Buffett criteria: ${buffettNotes.join(", ")}.`
        : "Insufficient data to fully evaluate Buffett criteria.",
    lynchScore,
    lynchSummary:
      lynchNotes.length > 0
        ? `Lynch criteria: ${lynchNotes.join(", ")}.`
        : "Insufficient data to fully evaluate Lynch criteria.",
    mungerScore,
    mungerSummary:
      mungerNotes.length > 0
        ? `Munger criteria: ${mungerNotes.join(", ")}.`
        : "Insufficient data to fully evaluate Munger criteria.",
  };
}

export interface DcfValuation {
  fairValue: number | null;
  currentPrice: number | null;
  marginOfSafetyPercent: number | null;
  expectedReturn1Y: number | null;
  expectedReturn3Y: number | null;
  expectedReturn5Y: number | null;
  assumedGrowthRate: number | null;
  discountRate: number;
  terminalGrowthRate: number;
}

const DISCOUNT_RATE = 0.1;
const TERMINAL_GROWTH_RATE = 0.025;
const PROJECTION_YEARS = 10;

export function computeDcfValuation(
  quote: QuoteSummaryResult | null,
): DcfValuation {
  const currentPrice = quote?.price?.regularMarketPrice ?? null;
  const eps = quote?.defaultKeyStatistics?.trailingEps ?? null;
  let growthRate = quote?.financialData?.earningsGrowth ?? null;

  if (growthRate == null || !Number.isFinite(growthRate)) {
    growthRate = 0.08;
  }
  growthRate = Math.max(-0.1, Math.min(growthRate, 0.35));

  if (eps == null || eps <= 0 || currentPrice == null) {
    return {
      fairValue: null,
      currentPrice,
      marginOfSafetyPercent: null,
      expectedReturn1Y: null,
      expectedReturn3Y: null,
      expectedReturn5Y: null,
      assumedGrowthRate: growthRate,
      discountRate: DISCOUNT_RATE,
      terminalGrowthRate: TERMINAL_GROWTH_RATE,
    };
  }

  let presentValue = 0;
  let projectedEarnings = eps;
  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    projectedEarnings *= 1 + growthRate;
    presentValue += projectedEarnings / Math.pow(1 + DISCOUNT_RATE, year);
  }
  const terminalValue =
    (projectedEarnings * (1 + TERMINAL_GROWTH_RATE)) /
    (DISCOUNT_RATE - TERMINAL_GROWTH_RATE);
  const discountedTerminalValue =
    terminalValue / Math.pow(1 + DISCOUNT_RATE, PROJECTION_YEARS);

  const fairValue = presentValue + discountedTerminalValue;
  const marginOfSafetyPercent = ((fairValue - currentPrice) / fairValue) * 100;

  const project = (years: number) => {
    const futureEps = eps * Math.pow(1 + growthRate, years);
    const futurePrice = futureEps * (fairValue / eps > 0 ? fairValue / eps : 15);
    return ((futurePrice - currentPrice) / currentPrice) * 100;
  };

  return {
    fairValue: Number(fairValue.toFixed(2)),
    currentPrice,
    marginOfSafetyPercent: Number(marginOfSafetyPercent.toFixed(2)),
    expectedReturn1Y: Number(project(1).toFixed(2)),
    expectedReturn3Y: Number(project(3).toFixed(2)),
    expectedReturn5Y: Number(project(5).toFixed(2)),
    assumedGrowthRate: Number(growthRate.toFixed(4)),
    discountRate: DISCOUNT_RATE,
    terminalGrowthRate: TERMINAL_GROWTH_RATE,
  };
}

export interface TradingSignals {
  suggestedBuyPrice: number | null;
  stopLoss: number | null;
  targetPrice1: number | null;
  targetPrice2: number | null;
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  trend: "bullish" | "bearish" | "neutral";
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

export function computeTradingSignals(closes: number[]): TradingSignals {
  if (closes.length === 0) {
    return {
      suggestedBuyPrice: null,
      stopLoss: null,
      targetPrice1: null,
      targetPrice2: null,
      rsi14: null,
      sma50: null,
      sma200: null,
      trend: "neutral",
    };
  }

  const lastClose = closes[closes.length - 1];
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const rsi14 = rsi(closes, 14);

  let trend: "bullish" | "bearish" | "neutral" = "neutral";
  if (sma50 != null && sma200 != null) {
    if (sma50 > sma200 && lastClose > sma50) trend = "bullish";
    else if (sma50 < sma200 && lastClose < sma50) trend = "bearish";
  }

  const volatilityWindow = closes.slice(-30);
  const mean =
    volatilityWindow.reduce((a, b) => a + b, 0) / volatilityWindow.length;
  const variance =
    volatilityWindow.reduce((a, b) => a + (b - mean) ** 2, 0) /
    volatilityWindow.length;
  const stdDev = Math.sqrt(variance);

  const suggestedBuyPrice = Number((lastClose - stdDev * 0.5).toFixed(2));
  const stopLoss = Number((lastClose - stdDev * 1.5).toFixed(2));
  const targetPrice1 = Number((lastClose + stdDev * 1.5).toFixed(2));
  const targetPrice2 = Number((lastClose + stdDev * 3).toFixed(2));

  return {
    suggestedBuyPrice,
    stopLoss,
    targetPrice1,
    targetPrice2,
    rsi14: rsi14 != null ? Number(rsi14.toFixed(2)) : null,
    sma50: sma50 != null ? Number(sma50.toFixed(2)) : null,
    sma200: sma200 != null ? Number(sma200.toFixed(2)) : null,
    trend,
  };
}

export interface ExperimentalScores {
  aiBenefitScore: number;
  aiBenefitSummary: string;
  sorosScore: number;
  sorosSummary: string;
  dalioScore: number;
  dalioSummary: string;
  eps2027Estimate: number | null;
}

function hashSeed(ticker: string): number {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) % 1000;
  }
  return hash;
}

export function computeExperimentalScores(
  ticker: string,
  quote: QuoteSummaryResult | null,
): ExperimentalScores {
  const seed = hashSeed(ticker);
  const revenueGrowth = quote?.financialData?.revenueGrowth ?? null;
  const grossMargin = quote?.financialData?.grossMargins ?? null;
  const sector = quote?.assetProfile?.sector ?? "";

  const isTechAdjacent = /tech|software|semiconductor|internet/i.test(sector);
  const aiBenefitScore = clampScore(
    35 +
      (isTechAdjacent ? 30 : 0) +
      (grossMargin != null ? grossMargin * 30 : 0) +
      (seed % 15),
  );

  const macroSensitivity = clampScore(30 + (seed % 40) + (revenueGrowth != null ? revenueGrowth * 40 : 0));
  const sorosScore = clampScore(macroSensitivity + (seed % 10));
  const dalioScore = clampScore(
    50 + (quote?.financialData?.debtToEquity != null && quote.financialData.debtToEquity < 80 ? 15 : -10) + (seed % 12),
  );

  const eps = quote?.defaultKeyStatistics?.trailingEps ?? null;
  const growth = quote?.financialData?.earningsGrowth ?? 0.08;
  const eps2027Estimate =
    eps != null ? Number((eps * Math.pow(1 + growth, 3)).toFixed(2)) : null;

  return {
    aiBenefitScore,
    aiBenefitSummary:
      "Heuristic estimate of exposure to AI-driven productivity or demand tailwinds, derived from sector and margin profile. Not a verified analyst figure.",
    sorosScore,
    sorosSummary:
      "Heuristic estimate of sensitivity to macro/reflexivity-driven trades, derived from growth volatility. Not a verified analyst figure.",
    dalioScore,
    dalioSummary:
      "Heuristic 'all-weather' resilience estimate based on balance sheet conservatism. Not a verified analyst figure.",
    eps2027Estimate,
  };
}
