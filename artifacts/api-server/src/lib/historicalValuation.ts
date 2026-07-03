import type { ChartResult, QuoteSummaryResult } from "./marketData";

// HEURISTIC PROXY: Free Yahoo endpoints do not expose true historical
// EPS/book-value-per-share series, only historical price. We approximate
// historical PE/PB using the current trailing EPS / book value applied to
// historical closing prices (i.e. "what would PE/PB have been at this price,
// assuming today's fundamentals held constant"). This is a standard
// simplification used by many free "PE band" tools but is NOT the same as
// a true trailing-twelve-month historical PE series. Clearly labeled in the
// UI as an approximation.

export interface ValuationBandLevels {
  minus2SD: number | null;
  minus1SD: number | null;
  mean: number | null;
  plus1SD: number | null;
  plus2SD: number | null;
}

export interface ValuationPeriodStats {
  years: number;
  currentPe: number | null;
  pePercentile: number | null;
  peMean: number | null;
  peStdDev: number | null;
  priceBandsFromPe: ValuationBandLevels;
  currentPb: number | null;
  pbPercentile: number | null;
  pbMean: number | null;
  pbStdDev: number | null;
  priceBandsFromPb: ValuationBandLevels;
}

export interface ValuationChartPoint {
  date: string;
  price: number;
  peBandMinus2SD: number | null;
  peBandMinus1SD: number | null;
  peBandMean: number | null;
  peBandPlus1SD: number | null;
  peBandPlus2SD: number | null;
}

export interface HistoricalValuationResult {
  ticker: string;
  isHeuristic: true;
  methodologyNote: string;
  currentPrice: number | null;
  currentPe: number | null;
  currentPb: number | null;
  periods: {
    threeYear: ValuationPeriodStats | null;
    fiveYear: ValuationPeriodStats | null;
    tenYear: ValuationPeriodStats | null;
  };
  chartSeries: ValuationChartPoint[];
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  const variance =
    values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function percentileOf(values: number[], target: number): number {
  const below = values.filter((v) => v <= target).length;
  return Number(((below / values.length) * 100).toFixed(1));
}

function sliceYears(chart: ChartResult, years: number): ChartResult {
  const cutoff = Date.now() / 1000 - years * 365 * 24 * 60 * 60;
  const timestamps: number[] = [];
  const closes: number[] = [];
  for (let i = 0; i < chart.timestamps.length; i++) {
    if (chart.timestamps[i] >= cutoff) {
      timestamps.push(chart.timestamps[i]);
      closes.push(chart.closes[i]);
    }
  }
  return { timestamps, closes };
}

function computePeriodStats(
  slice: ChartResult,
  years: number,
  eps: number | null,
  bookValue: number | null,
  currentPrice: number | null,
): ValuationPeriodStats | null {
  if (slice.closes.length < 10) return null;

  let peMean: number | null = null;
  let peStdDevVal: number | null = null;
  let currentPe: number | null = null;
  let pePercentile: number | null = null;
  let priceBandsFromPe: ValuationBandLevels = {
    minus2SD: null,
    minus1SD: null,
    mean: null,
    plus1SD: null,
    plus2SD: null,
  };

  if (eps != null && eps > 0) {
    const peSeries = slice.closes.map((c) => c / eps);
    peMean = mean(peSeries);
    peStdDevVal = stdDev(peSeries, peMean);
    currentPe =
      currentPrice != null ? Number((currentPrice / eps).toFixed(2)) : null;
    pePercentile = currentPe != null ? percentileOf(peSeries, currentPe) : null;
    priceBandsFromPe = {
      minus2SD: Number(((peMean - 2 * peStdDevVal) * eps).toFixed(2)),
      minus1SD: Number(((peMean - peStdDevVal) * eps).toFixed(2)),
      mean: Number((peMean * eps).toFixed(2)),
      plus1SD: Number(((peMean + peStdDevVal) * eps).toFixed(2)),
      plus2SD: Number(((peMean + 2 * peStdDevVal) * eps).toFixed(2)),
    };
  }

  let pbMean: number | null = null;
  let pbStdDevVal: number | null = null;
  let currentPb: number | null = null;
  let pbPercentile: number | null = null;
  let priceBandsFromPb: ValuationBandLevels = {
    minus2SD: null,
    minus1SD: null,
    mean: null,
    plus1SD: null,
    plus2SD: null,
  };

  if (bookValue != null && bookValue > 0) {
    const pbSeries = slice.closes.map((c) => c / bookValue);
    pbMean = mean(pbSeries);
    pbStdDevVal = stdDev(pbSeries, pbMean);
    currentPb =
      currentPrice != null
        ? Number((currentPrice / bookValue).toFixed(2))
        : null;
    pbPercentile = currentPb != null ? percentileOf(pbSeries, currentPb) : null;
    priceBandsFromPb = {
      minus2SD: Number(((pbMean - 2 * pbStdDevVal) * bookValue).toFixed(2)),
      minus1SD: Number(((pbMean - pbStdDevVal) * bookValue).toFixed(2)),
      mean: Number((pbMean * bookValue).toFixed(2)),
      plus1SD: Number(((pbMean + pbStdDevVal) * bookValue).toFixed(2)),
      plus2SD: Number(((pbMean + 2 * pbStdDevVal) * bookValue).toFixed(2)),
    };
  }

  return {
    years,
    currentPe,
    pePercentile,
    peMean: peMean != null ? Number(peMean.toFixed(2)) : null,
    peStdDev: peStdDevVal != null ? Number(peStdDevVal.toFixed(2)) : null,
    priceBandsFromPe,
    currentPb,
    pbPercentile,
    pbMean: pbMean != null ? Number(pbMean.toFixed(2)) : null,
    pbStdDev: pbStdDevVal != null ? Number(pbStdDevVal.toFixed(2)) : null,
    priceBandsFromPb,
  };
}

export function computeHistoricalValuation(
  ticker: string,
  quote: QuoteSummaryResult | null,
  longChart: ChartResult | null,
): HistoricalValuationResult {
  const currentPrice = quote?.price?.regularMarketPrice ?? null;
  const eps = quote?.defaultKeyStatistics?.trailingEps ?? null;
  const bookValue = quote?.defaultKeyStatistics?.bookValue ?? null;

  const currentPe =
    currentPrice != null && eps != null && eps > 0
      ? Number((currentPrice / eps).toFixed(2))
      : null;
  const currentPb =
    currentPrice != null && bookValue != null && bookValue > 0
      ? Number((currentPrice / bookValue).toFixed(2))
      : null;

  if (!longChart || longChart.closes.length < 10) {
    return {
      ticker,
      isHeuristic: true,
      methodologyNote:
        "Historical PE/PB bands are approximated using today's trailing EPS/book value applied to historical prices (free data source lacks a true historical fundamentals series). Treat as a directional valuation-band heuristic, not audited historical PE/PB.",
      currentPrice,
      currentPe,
      currentPb,
      periods: { threeYear: null, fiveYear: null, tenYear: null },
      chartSeries: [],
    };
  }

  const threeYearSlice = sliceYears(longChart, 3);
  const fiveYearSlice = sliceYears(longChart, 5);
  const tenYearSlice = sliceYears(longChart, 10);

  const threeYear = computePeriodStats(
    threeYearSlice,
    3,
    eps,
    bookValue,
    currentPrice,
  );
  const fiveYear = computePeriodStats(
    fiveYearSlice,
    5,
    eps,
    bookValue,
    currentPrice,
  );
  const tenYear = computePeriodStats(
    tenYearSlice,
    10,
    eps,
    bookValue,
    currentPrice,
  );

  const chartSeries: ValuationChartPoint[] = fiveYearSlice.timestamps.map(
    (ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      price: Number(fiveYearSlice.closes[i].toFixed(2)),
      peBandMinus2SD: fiveYear?.priceBandsFromPe.minus2SD ?? null,
      peBandMinus1SD: fiveYear?.priceBandsFromPe.minus1SD ?? null,
      peBandMean: fiveYear?.priceBandsFromPe.mean ?? null,
      peBandPlus1SD: fiveYear?.priceBandsFromPe.plus1SD ?? null,
      peBandPlus2SD: fiveYear?.priceBandsFromPe.plus2SD ?? null,
    }),
  );

  return {
    ticker,
    isHeuristic: true,
    methodologyNote:
      "Historical PE/PB bands are approximated using today's trailing EPS/book value applied to historical prices (free data source lacks a true historical fundamentals series). Treat as a directional valuation-band heuristic, not audited historical PE/PB.",
    currentPrice,
    currentPe,
    currentPb,
    periods: { threeYear, fiveYear, tenYear },
    chartSeries,
  };
}
