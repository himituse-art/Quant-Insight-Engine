import { Router, type IRouter } from "express";
import {
  SearchStocksQueryParams,
  SearchStocksResponse,
  GetPopularStocksResponse,
  GetStockDetailParams,
  GetStockDetailResponse,
} from "@workspace/api-zod";
import {
  getQuoteSummary,
  getChartHistory,
  getNews,
  searchTickers,
} from "../lib/marketData";
import {
  buildMarketData,
  computeGuruScores,
  computeDcfValuation,
  computeTradingSignals,
  computeExperimentalScores,
} from "../lib/quantCalculations";

const router: IRouter = Router();

const POPULAR_TICKERS: { symbol: string; name: string; exchange: string }[] = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ" },
  { symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ" },
  { symbol: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ" },
  { symbol: "META", name: "Meta Platforms Inc.", exchange: "NASDAQ" },
  { symbol: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ" },
  { symbol: "BRK-B", name: "Berkshire Hathaway Inc.", exchange: "NYSE" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", exchange: "NYSE" },
  { symbol: "V", name: "Visa Inc.", exchange: "NYSE" },
  { symbol: "JNJ", name: "Johnson & Johnson", exchange: "NYSE" },
  { symbol: "WMT", name: "Walmart Inc.", exchange: "NYSE" },
];

router.get("/stocks/popular", (_req, res): void => {
  const data = GetPopularStocksResponse.parse(POPULAR_TICKERS);
  res.json(data);
});

router.get("/stocks/search", async (req, res): Promise<void> => {
  const parsed = SearchStocksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const query = parsed.data.q.trim();
  if (query.length === 0) {
    res.json(SearchStocksResponse.parse([]));
    return;
  }

  const localMatches = POPULAR_TICKERS.filter(
    (t) =>
      t.symbol.toLowerCase().includes(query.toLowerCase()) ||
      t.name.toLowerCase().includes(query.toLowerCase()),
  );

  const remoteMatches = await searchTickers(query);

  const seen = new Set<string>();
  const merged = [...localMatches, ...remoteMatches].filter((item) => {
    if (seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    return true;
  });

  req.log.info({ query, count: merged.length }, "Stock search performed");
  res.json(SearchStocksResponse.parse(merged.slice(0, 12)));
});

router.get("/stocks/:ticker", async (req, res): Promise<void> => {
  const params = GetStockDetailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const ticker = params.data.ticker.toUpperCase();

  const [quote, chart, news] = await Promise.all([
    getQuoteSummary(ticker),
    getChartHistory(ticker),
    getNews(ticker),
  ]);

  if (!quote || !quote.price?.regularMarketPrice) {
    req.log.warn({ ticker }, "Ticker not found");
    res.status(404).json({ error: "Ticker not found" });
    return;
  }

  const companyName =
    quote.price?.longName ?? quote.price?.shortName ?? ticker;
  const marketData = buildMarketData(quote);
  const guruScores = computeGuruScores(quote);
  const dcfValuation = computeDcfValuation(quote);
  const tradingSignals = computeTradingSignals(chart?.closes ?? []);
  const experimentalScores = computeExperimentalScores(ticker, quote);

  const financialLinks = {
    incomeStatementUrl: `https://finance.yahoo.com/quote/${ticker}/financials`,
    balanceSheetUrl: `https://finance.yahoo.com/quote/${ticker}/balance-sheet`,
    cashFlowUrl: `https://finance.yahoo.com/quote/${ticker}/cash-flow`,
    secFilingsUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(
      ticker,
    )}&type=10-K&dateb=&owner=include&count=40`,
  };

  const responseBody = {
    ticker,
    companyName,
    sector: quote.assetProfile?.sector ?? null,
    industry: quote.assetProfile?.industry ?? null,
    marketData: {
      ...marketData,
      lastUpdated: new Date().toISOString(),
    },
    guruScores,
    dcfValuation,
    tradingSignals,
    news,
    financialLinks,
    experimentalScores,
  };

  req.log.info({ ticker }, "Stock detail served");
  res.json(GetStockDetailResponse.parse(responseBody));
});

export default router;
