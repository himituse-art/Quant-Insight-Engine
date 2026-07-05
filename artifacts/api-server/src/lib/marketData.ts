import { logger } from "./logger";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const cache = new Map<string, { expiresAt: number; value: unknown }>();
const CACHE_TTL_MS = 60_000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await fn();
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

let authState: { cookie: string; crumb: string; expiresAt: number } | null =
  null;
const AUTH_TTL_MS = 30 * 60_000;

async function getAuth(): Promise<{ cookie: string; crumb: string }> {
  if (authState && authState.expiresAt > Date.now()) {
    return authState;
  }

  const cookieRes = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": USER_AGENT },
  });
  const setCookie = cookieRes.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];

  const crumbRes = await fetch(
    "https://query1.finance.yahoo.com/v1/test/getcrumb",
    {
      headers: { "User-Agent": USER_AGENT, Cookie: cookie },
    },
  );
  const crumb = (await crumbRes.text()).trim();

  authState = { cookie, crumb, expiresAt: Date.now() + AUTH_TTL_MS };
  return authState;
}

async function fetchJson(
  url: string,
  options: { authenticated?: boolean } = {},
): Promise<unknown> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  let finalUrl = url;

  if (options.authenticated) {
    const auth = await getAuth();
    headers.Cookie = auth.cookie;
    finalUrl += (url.includes("?") ? "&" : "?") + `crumb=${auth.crumb}`;
  }

  const res = await fetch(finalUrl, { headers });
  if (!res.ok) {
    throw new Error(`Upstream request failed with status ${res.status}`);
  }
  return res.json();
}

export interface QuoteSummaryResult {
  price?: {
    regularMarketPrice?: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
    currency?: string;
    longName?: string;
    shortName?: string;
    symbol?: string;
  };
  summaryDetail?: {
    marketCap?: number;
    trailingPE?: number;
    forwardPE?: number;
    trailingAnnualDividendYield?: number;
    dividendYield?: number;
    beta?: number;
    volume?: number;
    averageVolume?: number;
    averageDailyVolume10Day?: number;
  };
  defaultKeyStatistics?: {
    pegRatio?: number;
    trailingEps?: number;
    forwardEps?: number;
    enterpriseValue?: number;
    beta?: number;
    bookValue?: number;
  };
  financialData?: {
    returnOnEquity?: number;
    freeCashflow?: number;
    grossMargins?: number;
    totalDebt?: number;
    totalCash?: number;
    ebitda?: number;
    earningsGrowth?: number;
    revenueGrowth?: number;
    targetMedianPrice?: number;
    debtToEquity?: number;
    totalRevenue?: number;
  };
  assetProfile?: {
    sector?: string;
    industry?: string;
  };
}

interface RawFieldValue {
  raw?: number;
  fmt?: string;
}

function num(value: unknown): number | undefined {
  if (value == null) return undefined;
  const v = value as RawFieldValue | number;
  if (typeof v === "number") return v;
  return typeof v.raw === "number" ? v.raw : undefined;
}

function str(value: unknown): string | undefined {
  if (value == null) return undefined;
  return typeof value === "string" ? value : undefined;
}

export async function getQuoteSummary(
  ticker: string,
): Promise<QuoteSummaryResult | null> {
  return cached(`quoteSummary:${ticker}`, async () => {
    const modules = [
      "price",
      "summaryDetail",
      "defaultKeyStatistics",
      "financialData",
      "assetProfile",
    ].join(",");
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker,
    )}?modules=${modules}`;

    try {
      const json = (await fetchJson(url, { authenticated: true })) as {
        quoteSummary?: { result?: unknown[]; error?: unknown };
      };
      const result = json.quoteSummary?.result?.[0] as
        | Record<string, Record<string, unknown>>
        | undefined;
      if (!result) return null;

      const price = result.price ?? {};
      const summaryDetail = result.summaryDetail ?? {};
      const keyStats = result.defaultKeyStatistics ?? {};
      const financialData = result.financialData ?? {};
      const assetProfile = result.assetProfile ?? {};

      return {
        price: {
          regularMarketPrice: num(price.regularMarketPrice),
          regularMarketChange: num(price.regularMarketChange),
          regularMarketChangePercent: num(price.regularMarketChangePercent),
          currency: str(price.currency),
          longName: str(price.longName),
          shortName: str(price.shortName),
          symbol: str(price.symbol),
        },
        summaryDetail: {
          marketCap: num(summaryDetail.marketCap),
          trailingPE: num(summaryDetail.trailingPE),
          forwardPE: num(summaryDetail.forwardPE),
          trailingAnnualDividendYield: num(
            summaryDetail.trailingAnnualDividendYield,
          ),
          dividendYield: num(summaryDetail.dividendYield),
          beta: num(summaryDetail.beta),
          volume: num(summaryDetail.volume),
          averageVolume: num(summaryDetail.averageVolume),
          averageDailyVolume10Day: num(summaryDetail.averageDailyVolume10Day),
        },
        defaultKeyStatistics: {
          pegRatio: num(keyStats.pegRatio),
          trailingEps: num(keyStats.trailingEps),
          forwardEps: num(keyStats.forwardEps),
          beta: num(keyStats.beta),
          bookValue: num(keyStats.bookValue),
        },
        financialData: {
          returnOnEquity: num(financialData.returnOnEquity),
          freeCashflow: num(financialData.freeCashflow),
          grossMargins: num(financialData.grossMargins),
          totalDebt: num(financialData.totalDebt),
          totalCash: num(financialData.totalCash),
          earningsGrowth: num(financialData.earningsGrowth),
          revenueGrowth: num(financialData.revenueGrowth),
          debtToEquity: num(financialData.debtToEquity),
          totalRevenue: num(financialData.totalRevenue),
        },
        assetProfile: {
          sector: str(assetProfile.sector),
          industry: str(assetProfile.industry),
        },
      };
    } catch (err) {
      logger.warn({ err, ticker }, "Failed to fetch Yahoo quoteSummary");
      return null;
    }
  });
}

export interface ChartResult {
  closes: number[];
  timestamps: number[];
}

export async function getChartHistory(
  ticker: string,
): Promise<ChartResult | null> {
  return cached(`chart:${ticker}`, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker,
    )}?range=1y&interval=1d`;
    try {
      const json = (await fetchJson(url)) as {
        chart?: { result?: unknown[]; error?: unknown };
      };
      const result = json.chart?.result?.[0] as
        | {
            timestamp?: number[];
            indicators?: { quote?: { close?: (number | null)[] }[] };
          }
        | undefined;
      if (!result?.timestamp) return null;

      const closesRaw = result.indicators?.quote?.[0]?.close ?? [];
      const timestamps: number[] = [];
      const closes: number[] = [];
      for (let i = 0; i < result.timestamp.length; i++) {
        const close = closesRaw[i];
        if (typeof close === "number") {
          timestamps.push(result.timestamp[i]);
          closes.push(close);
        }
      }
      if (closes.length === 0) return null;
      return { closes, timestamps };
    } catch (err) {
      logger.warn({ err, ticker }, "Failed to fetch Yahoo chart history");
      return null;
    }
  });
}

const LONG_CHART_CACHE_TTL_MS = 60 * 60_000;

export async function getLongChartHistory(
  ticker: string,
): Promise<ChartResult | null> {
  const hit = longChartCache.get(ticker);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?range=10y&interval=1wk`;
  try {
    const json = (await fetchJson(url)) as {
      chart?: { result?: unknown[]; error?: unknown };
    };
    const result = json.chart?.result?.[0] as
      | {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }
      | undefined;
    if (!result?.timestamp) return null;

    const closesRaw = result.indicators?.quote?.[0]?.close ?? [];
    const timestamps: number[] = [];
    const closes: number[] = [];
    for (let i = 0; i < result.timestamp.length; i++) {
      const close = closesRaw[i];
      if (typeof close === "number") {
        timestamps.push(result.timestamp[i]);
        closes.push(close);
      }
    }
    if (closes.length === 0) return null;
    const value = { closes, timestamps };
    longChartCache.set(ticker, {
      expiresAt: Date.now() + LONG_CHART_CACHE_TTL_MS,
      value,
    });
    return value;
  } catch (err) {
    logger.warn({ err, ticker }, "Failed to fetch Yahoo long-range chart");
    return null;
  }
}

const longChartCache = new Map<
  string,
  { expiresAt: number; value: ChartResult }
>();

export interface OhlcvResult {
  timestamps: number[];
  opens: number[];
  closes: number[];
  volumes: number[];
}

const OHLCV_CACHE_TTL_MS = 15 * 60_000;
const ohlcvCache = new Map<string, { expiresAt: number; value: OhlcvResult }>();

export async function getOhlcvHistory(
  ticker: string,
): Promise<OhlcvResult | null> {
  const hit = ohlcvCache.get(ticker);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?range=6mo&interval=1d`;
  try {
    const json = (await fetchJson(url)) as {
      chart?: { result?: unknown[]; error?: unknown };
    };
    const result = json.chart?.result?.[0] as
      | {
          timestamp?: number[];
          indicators?: {
            quote?: {
              open?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }[];
          };
        }
      | undefined;
    if (!result?.timestamp) return null;

    const q = result.indicators?.quote?.[0];
    const opensRaw = q?.open ?? [];
    const closesRaw = q?.close ?? [];
    const volumesRaw = q?.volume ?? [];
    const timestamps: number[] = [];
    const opens: number[] = [];
    const closes: number[] = [];
    const volumes: number[] = [];
    for (let i = 0; i < result.timestamp.length; i++) {
      const o = opensRaw[i];
      const c = closesRaw[i];
      const v = volumesRaw[i];
      if (typeof o === "number" && typeof c === "number" && typeof v === "number") {
        timestamps.push(result.timestamp[i]);
        opens.push(o);
        closes.push(c);
        volumes.push(v);
      }
    }
    if (closes.length === 0) return null;
    const value = { timestamps, opens, closes, volumes };
    ohlcvCache.set(ticker, {
      expiresAt: Date.now() + OHLCV_CACHE_TTL_MS,
      value,
    });
    return value;
  } catch (err) {
    logger.warn({ err, ticker }, "Failed to fetch Yahoo OHLCV history");
    return null;
  }
}

export interface OwnershipHolder {
  organization: string;
  pctHeld?: number;
  shares?: number;
  value?: number;
  pctChange?: number;
}

export interface OwnershipData {
  institutionsPercentHeld?: number;
  institutionsCount?: number;
  insidersPercentHeld?: number;
  topInstitutionalHolders: OwnershipHolder[];
  topFundHolders: OwnershipHolder[];
}

export async function getOwnershipData(
  ticker: string,
): Promise<OwnershipData | null> {
  return cached(`ownership:${ticker}`, async () => {
    const modules = [
      "institutionOwnership",
      "fundOwnership",
      "majorHoldersBreakdown",
    ].join(",");
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker,
    )}?modules=${modules}`;
    try {
      const json = (await fetchJson(url, { authenticated: true })) as {
        quoteSummary?: { result?: unknown[]; error?: unknown };
      };
      const result = json.quoteSummary?.result?.[0] as
        | Record<string, Record<string, unknown>>
        | undefined;
      if (!result) return null;

      const breakdown = result.majorHoldersBreakdown ?? {};
      const institutionOwnership = result.institutionOwnership as
        | { ownershipList?: unknown[] }
        | undefined;
      const fundOwnership = result.fundOwnership as
        | { ownershipList?: unknown[] }
        | undefined;

      const mapHolder = (entry: unknown): OwnershipHolder => {
        const e = entry as Record<string, unknown>;
        return {
          organization: str(e.organization) ?? "Unknown",
          pctHeld: num(e.pctHeld),
          shares: num(e.position),
          value: num(e.value),
          pctChange: num(e.pctChange),
        };
      };

      return {
        institutionsPercentHeld: num(breakdown.institutionsPercentHeld),
        institutionsCount: num(breakdown.institutionsCount),
        insidersPercentHeld: num(breakdown.insidersPercentHeld),
        topInstitutionalHolders: (institutionOwnership?.ownershipList ?? [])
          .slice(0, 10)
          .map(mapHolder),
        topFundHolders: (fundOwnership?.ownershipList ?? [])
          .slice(0, 10)
          .map(mapHolder),
      };
    } catch (err) {
      logger.warn({ err, ticker }, "Failed to fetch Yahoo ownership data");
      return null;
    }
  });
}

export interface YahooNewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: string;
}

export async function getNews(ticker: string): Promise<YahooNewsItem[]> {
  return cached(`news:${ticker}`, async () => {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      ticker,
    )}&newsCount=8&quotesCount=0`;
    try {
      const json = (await fetchJson(url)) as {
        news?: Array<{
          title?: string;
          link?: string;
          publisher?: string;
          providerPublishTime?: number;
        }>;
      };
      const news = json.news ?? [];
      return news
        .filter((item) => item.title && item.link)
        .slice(0, 8)
        .map((item) => ({
          title: item.title as string,
          link: item.link as string,
          publisher: item.publisher ?? "Unknown",
          publishedAt: item.providerPublishTime
            ? new Date(item.providerPublishTime * 1000).toISOString()
            : new Date().toISOString(),
        }));
    } catch (err) {
      logger.warn({ err, ticker }, "Failed to fetch Yahoo news");
      return [];
    }
  });
}

export interface SearchQuote {
  symbol: string;
  name: string;
  exchange: string | null;
}

export async function searchTickers(query: string): Promise<SearchQuote[]> {
  return cached(`search:${query.toLowerCase()}`, async () => {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      query,
    )}&quotesCount=10&newsCount=0`;
    try {
      const json = (await fetchJson(url)) as {
        quotes?: Array<{
          symbol?: string;
          shortname?: string;
          longname?: string;
          exchange?: string;
          quoteType?: string;
        }>;
      };
      const quotes = json.quotes ?? [];
      return quotes
        .filter(
          (q) =>
            q.symbol &&
            (q.quoteType === "EQUITY" || q.quoteType === undefined),
        )
        .map((q) => ({
          symbol: q.symbol as string,
          name: q.longname ?? q.shortname ?? (q.symbol as string),
          exchange: q.exchange ?? null,
        }));
    } catch (err) {
      logger.warn({ err, query }, "Failed to search Yahoo tickers");
      return [];
    }
  });
}
