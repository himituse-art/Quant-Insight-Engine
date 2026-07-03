import type { OwnershipData, QuoteSummaryResult } from "./marketData";

// HEURISTIC PROXY: Real-time order-flow / dark-pool data requires premium
// feeds unavailable here. We approximate "smart money" activity using
// publicly reported institutional/fund ownership snapshots plus a
// volume-shock heuristic: if today's volume exceeds 1.5x the recent average
// volume (Yahoo's ~3-month averageVolume, used as a 20-day-average proxy)
// while price is rising, we tag it "Institutional Accumulation"; the mirror
// case is tagged "Institutional Distribution". This is directional, not a
// confirmed institutional trade record.

export type VolumeShockStatus =
  | "accumulation"
  | "distribution"
  | "normal";

export interface WhaleHolder {
  organization: string;
  pctHeld: number | null;
  shares: number | null;
  value: number | null;
  pctChange: number | null;
}

export interface FundFlowResult {
  ticker: string;
  isHeuristic: true;
  methodologyNote: string;
  institutionsPercentHeld: number | null;
  institutionsCount: number | null;
  insidersPercentHeld: number | null;
  institutionalMomentum: "increasing" | "decreasing" | "flat" | "unknown";
  institutionalMomentumNote: string;
  topWhaleHolders: WhaleHolder[];
  currentVolume: number | null;
  averageVolume: number | null;
  volumeRatio: number | null;
  priceChangePercent: number | null;
  volumeShockStatus: VolumeShockStatus;
  volumeShockNote: string;
}

const VOLUME_SHOCK_THRESHOLD = 1.5;

export function computeFundFlow(
  ticker: string,
  quote: QuoteSummaryResult | null,
  ownership: OwnershipData | null,
): FundFlowResult {
  const currentVolume = quote?.summaryDetail?.volume ?? null;
  const averageVolume =
    quote?.summaryDetail?.averageDailyVolume10Day ??
    quote?.summaryDetail?.averageVolume ??
    null;
  const priceChangePercent = quote?.price?.regularMarketChangePercent ?? null;

  const volumeRatio =
    currentVolume != null && averageVolume != null && averageVolume > 0
      ? Number((currentVolume / averageVolume).toFixed(2))
      : null;

  let volumeShockStatus: VolumeShockStatus = "normal";
  let volumeShockNote =
    "Volume is within normal range relative to the recent average — no shock detected.";
  if (volumeRatio != null && priceChangePercent != null) {
    if (volumeRatio >= VOLUME_SHOCK_THRESHOLD && priceChangePercent > 0) {
      volumeShockStatus = "accumulation";
      volumeShockNote = `Volume is ${volumeRatio.toFixed(1)}x the recent average while price rises — consistent with institutional accumulation ("whales buying").`;
    } else if (volumeRatio >= VOLUME_SHOCK_THRESHOLD && priceChangePercent < 0) {
      volumeShockStatus = "distribution";
      volumeShockNote = `Volume is ${volumeRatio.toFixed(1)}x the recent average while price falls — consistent with institutional distribution ("whales selling").`;
    }
  }

  const topWhaleHolders: WhaleHolder[] = (
    ownership?.topInstitutionalHolders ?? []
  ).map((h) => ({
    organization: h.organization,
    pctHeld: h.pctHeld ?? null,
    shares: h.shares ?? null,
    value: h.value ?? null,
    pctChange: h.pctChange ?? null,
  }));

  let institutionalMomentum: "increasing" | "decreasing" | "flat" | "unknown" =
    "unknown";
  let institutionalMomentumNote =
    "No institutional position-change data available.";
  if (topWhaleHolders.length > 0) {
    const changes = topWhaleHolders
      .map((h) => h.pctChange)
      .filter((v): v is number => v != null);
    if (changes.length > 0) {
      const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
      if (avgChange > 1) {
        institutionalMomentum = "increasing";
        institutionalMomentumNote = `Top reporting institutions increased positions by an average of ${avgChange.toFixed(1)}% in the latest reporting period.`;
      } else if (avgChange < -1) {
        institutionalMomentum = "decreasing";
        institutionalMomentumNote = `Top reporting institutions decreased positions by an average of ${Math.abs(avgChange).toFixed(1)}% in the latest reporting period.`;
      } else {
        institutionalMomentum = "flat";
        institutionalMomentumNote =
          "Top reporting institutions show broadly stable position sizes in the latest reporting period.";
      }
    }
  }

  return {
    ticker,
    isHeuristic: true,
    methodologyNote:
      "Institutional data reflects the latest publicly disclosed 13F-style ownership snapshot (not real-time). Volume Shock Status uses recent average volume as a 20-day-average proxy since a true 20-day figure isn't available from the free data source — treat both as directional signals.",
    institutionsPercentHeld: ownership?.institutionsPercentHeld ?? null,
    institutionsCount: ownership?.institutionsCount ?? null,
    insidersPercentHeld: ownership?.insidersPercentHeld ?? null,
    institutionalMomentum,
    institutionalMomentumNote,
    topWhaleHolders,
    currentVolume,
    averageVolume,
    volumeRatio,
    priceChangePercent,
    volumeShockStatus,
    volumeShockNote,
  };
}
