import type { OhlcvResult, OwnershipData } from "./marketData";

// HEURISTIC PROXY: True institutional order-flow / dark-pool prints require
// premium feeds unavailable here. We approximate "smart money" activity via:
//  1) Publicly reported institutional/fund ownership snapshots (13F-style,
//     not real-time) for concentration and holder profiles.
//  2) A daily Net Dollar Flow proxy — Volume * (Close - Open) — computed from
//     free daily OHLCV history. A rolling 20-day mean/stddev of this series
//     is used to flag statistically unusual single-day capital movement
//     ("whale alerts") at +/-2 standard deviations. This is a directional
//     signal derived from public price/volume data, not a confirmed
//     institutional trade record.

export type WhaleAlert = "MEGA_INFLOW" | "MEGA_OUTFLOW" | "NORMAL";

export interface WhaleHolder {
  organization: string;
  pctHeld: number | null;
  shares: number | null;
  value: number | null;
  pctChange: number | null;
}

export interface CapitalFlowPoint {
  date: string;
  netDollarFlow: number;
  whaleAlert: WhaleAlert;
  close: number;
}

export interface FundFlowResult {
  ticker: string;
  isHeuristic: true;
  methodologyNote: string;
  institutionsPercentHeld: number | null;
  institutionsCount: number | null;
  insidersPercentHeld: number | null;
  top3WhaleConcentrationPercent: number | null;
  topWhaleHolders: WhaleHolder[];
  timeSeries: CapitalFlowPoint[];
}

const ROLLING_WINDOW_DAYS = 20;
const OUTPUT_WINDOW_DAYS = 45;
const ALERT_Z_THRESHOLD = 2.0;

function toDateStr(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  const variance =
    values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeFundFlow(
  ticker: string,
  ohlcv: OhlcvResult | null,
  ownership: OwnershipData | null,
): FundFlowResult {
  const dailyFlows: { date: string; netDollarFlow: number; close: number }[] =
    [];
  if (ohlcv) {
    for (let i = 0; i < ohlcv.timestamps.length; i++) {
      const netDollarFlow = ohlcv.volumes[i] * (ohlcv.closes[i] - ohlcv.opens[i]);
      dailyFlows.push({
        date: toDateStr(ohlcv.timestamps[i]),
        netDollarFlow: Math.round(netDollarFlow),
        close: ohlcv.closes[i],
      });
    }
  }

  const timeSeries: CapitalFlowPoint[] = [];
  const startIdx = Math.max(
    0,
    dailyFlows.length - OUTPUT_WINDOW_DAYS,
  );
  for (let i = startIdx; i < dailyFlows.length; i++) {
    const windowStart = Math.max(0, i - ROLLING_WINDOW_DAYS + 1);
    const window = dailyFlows
      .slice(windowStart, i + 1)
      .map((f) => f.netDollarFlow);
    const avg = mean(window);
    const sd = stdDev(window, avg);

    let whaleAlert: WhaleAlert = "NORMAL";
    if (sd > 0) {
      const z = (dailyFlows[i].netDollarFlow - avg) / sd;
      if (z > ALERT_Z_THRESHOLD) whaleAlert = "MEGA_INFLOW";
      else if (z < -ALERT_Z_THRESHOLD) whaleAlert = "MEGA_OUTFLOW";
    }

    timeSeries.push({
      date: dailyFlows[i].date,
      netDollarFlow: dailyFlows[i].netDollarFlow,
      whaleAlert,
      close: dailyFlows[i].close,
    });
  }

  const sortedHolders = [...(ownership?.topInstitutionalHolders ?? [])].sort(
    (a, b) => (b.pctHeld ?? 0) - (a.pctHeld ?? 0),
  );

  const topWhaleHolders: WhaleHolder[] = sortedHolders.slice(0, 5).map((h) => ({
    organization: h.organization,
    pctHeld: h.pctHeld ?? null,
    shares: h.shares ?? null,
    value: h.value ?? null,
    pctChange: h.pctChange ?? null,
  }));

  const top3Fractions = sortedHolders
    .slice(0, 3)
    .map((h) => h.pctHeld)
    .filter((v): v is number => v != null);
  const top3WhaleConcentrationPercent =
    top3Fractions.length > 0
      ? Number((top3Fractions.reduce((a, b) => a + b, 0) * 100).toFixed(2))
      : null;

  return {
    ticker,
    isHeuristic: true,
    methodologyNote:
      "Net Dollar Flow = Volume x (Close - Open) per trading day, a public-data proxy for capital direction (not confirmed institutional order flow). Whale Alerts flag days where flow exceeds +/-2 standard deviations of its own trailing 20-day mean. Ownership figures reflect the latest publicly disclosed 13F-style snapshot, not real-time.",
    institutionsPercentHeld: ownership?.institutionsPercentHeld ?? null,
    institutionsCount: ownership?.institutionsCount ?? null,
    insidersPercentHeld: ownership?.insidersPercentHeld ?? null,
    top3WhaleConcentrationPercent,
    topWhaleHolders,
    timeSeries,
  };
}
