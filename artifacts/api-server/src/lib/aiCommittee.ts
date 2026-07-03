import type { QuoteSummaryResult, YahooNewsItem } from "./marketData";
import type {
  DcfValuation,
  ExperimentalScores,
  GuruScores,
  TradingSignals,
} from "./quantCalculations";

// NOTE: This module is a deterministic, rules-based synthesis engine — not a
// live LLM call. It combines the quant/technical signals already computed
// elsewhere in this app (guru scores, DCF, technical signals) into a
// structured "investment committee" verdict, voiced through three canonical
// value/growth/macro personas. It is transparent and reproducible, and does
// not require any external API key.

export interface AiCommitteeVerdict {
  ticker: string;
  isHeuristic: true;
  methodologyNote: string;
  agentVerdict: "BUY" | "HOLD" | "SELL";
  confidence: number;
  reasoningBreakdown: {
    valueView: string;
    valueStance: "bullish" | "bearish" | "neutral";
    growthView: string;
    growthStance: "bullish" | "bearish" | "neutral";
    macroView: string;
    macroStance: "bullish" | "bearish" | "neutral";
  };
  keyCatalysts: string[];
  hiddenRisks: string[];
}

type Stance = "bullish" | "bearish" | "neutral";

export function computeAiCommitteeVerdict(
  ticker: string,
  quote: QuoteSummaryResult | null,
  guruScores: GuruScores,
  dcfValuation: DcfValuation,
  tradingSignals: TradingSignals,
  experimentalScores: ExperimentalScores,
  news: YahooNewsItem[],
): AiCommitteeVerdict {
  const roe = quote?.financialData?.returnOnEquity ?? null;
  const debtToEquity = quote?.financialData?.debtToEquity ?? null;
  const peg = quote?.defaultKeyStatistics?.pegRatio ?? null;
  const revenueGrowth = quote?.financialData?.revenueGrowth ?? null;
  const earningsGrowth = quote?.financialData?.earningsGrowth ?? null;
  const beta = quote?.summaryDetail?.beta ?? quote?.defaultKeyStatistics?.beta ?? null;
  const marginOfSafety = dcfValuation.marginOfSafetyPercent;

  // --- Value Investor (Buffett/Munger style) ---
  let valuePoints = 0;
  const valueFacts: string[] = [];
  if (marginOfSafety != null) {
    if (marginOfSafety > 15) {
      valuePoints += 2;
      valueFacts.push(
        `DCF suggests a ${marginOfSafety.toFixed(1)}% margin of safety versus intrinsic fair value`,
      );
    } else if (marginOfSafety < -15) {
      valuePoints -= 2;
      valueFacts.push(
        `shares appear ${Math.abs(marginOfSafety).toFixed(1)}% above estimated fair value, eroding margin of safety`,
      );
    } else {
      valueFacts.push("trades close to estimated intrinsic value");
    }
  }
  if (roe != null) {
    if (roe > 0.15) {
      valuePoints += 1;
      valueFacts.push(`durable competitive advantage signaled by ${(roe * 100).toFixed(1)}% ROE`);
    } else if (roe < 0.05) {
      valuePoints -= 1;
      valueFacts.push("returns on equity are thin, a quality concern");
    }
  }
  if (debtToEquity != null) {
    if (debtToEquity < 60) {
      valuePoints += 1;
      valueFacts.push("balance sheet is conservatively financed");
    } else if (debtToEquity > 150) {
      valuePoints -= 1;
      valueFacts.push("leverage is elevated, a balance-sheet risk");
    }
  }
  const valueStance: Stance = valuePoints >= 2 ? "bullish" : valuePoints <= -2 ? "bearish" : "neutral";
  const valueView = `${
    valueStance === "bullish" ? "Attractive" : valueStance === "bearish" ? "Unattractive" : "Fair"
  } from a Value lens (Buffett/Munger): ${
    valueFacts.length > 0 ? valueFacts.join("; ") + "." : "insufficient fundamental data to form a strong view."
  } Guru alignment score: Buffett ${guruScores.buffettScore}/100, Munger ${guruScores.mungerScore}/100.`;

  // --- Growth Hacker (Peter Lynch style) ---
  let growthPoints = 0;
  const growthFacts: string[] = [];
  if (peg != null) {
    if (peg > 0 && peg < 1) {
      growthPoints += 2;
      growthFacts.push(`PEG of ${peg.toFixed(2)} implies growth is underpriced relative to earnings momentum`);
    } else if (peg > 2.5) {
      growthPoints -= 2;
      growthFacts.push(`PEG of ${peg.toFixed(2)} suggests growth is already richly priced`);
    }
  }
  if (revenueGrowth != null) {
    if (revenueGrowth > 0.15) {
      growthPoints += 1;
      growthFacts.push(`revenue expanding at ${(revenueGrowth * 100).toFixed(1)}% year-over-year`);
    } else if (revenueGrowth < 0) {
      growthPoints -= 1;
      growthFacts.push("revenue is contracting, a growth-story red flag");
    }
  }
  if (earningsGrowth != null && earningsGrowth > 0.2) {
    growthPoints += 1;
    growthFacts.push(`earnings growth of ${(earningsGrowth * 100).toFixed(1)}% supports a compounding thesis`);
  }
  const growthStance: Stance = growthPoints >= 2 ? "bullish" : growthPoints <= -2 ? "bearish" : "neutral";
  const growthView = `${
    growthStance === "bullish" ? "Compelling" : growthStance === "bearish" ? "Fading" : "Middling"
  } from a Growth lens (Lynch): ${
    growthFacts.length > 0 ? growthFacts.join("; ") + "." : "growth signals are mixed or unavailable."
  } Lynch alignment score: ${guruScores.lynchScore}/100.`;

  // --- Macro Strategist (Dalio style) ---
  let macroPoints = 0;
  const macroFacts: string[] = [];
  if (beta != null) {
    if (beta > 1.5) {
      macroPoints -= 1;
      macroFacts.push(`beta of ${beta.toFixed(2)} implies high sensitivity to macro/rate shocks`);
    } else if (beta < 0.8) {
      macroPoints += 1;
      macroFacts.push(`beta of ${beta.toFixed(2)} suggests defensive, lower macro sensitivity`);
    }
  }
  if (tradingSignals.trend === "bullish") {
    macroPoints += 1;
    macroFacts.push("price is trending above both the 50- and 200-day moving averages");
  } else if (tradingSignals.trend === "bearish") {
    macroPoints -= 1;
    macroFacts.push("price is trending below key moving averages, a headwind in a tightening backdrop");
  }
  if (experimentalScores.dalioScore >= 65) {
    macroPoints += 1;
    macroFacts.push("balance-sheet resilience score suggests durability across economic regimes");
  } else if (experimentalScores.dalioScore <= 35) {
    macroPoints -= 1;
    macroFacts.push("all-weather resilience score is weak, exposing the name to macro drawdowns");
  }
  const macroStance: Stance = macroPoints >= 2 ? "bullish" : macroPoints <= -2 ? "bearish" : "neutral";
  const macroView = `${
    macroStance === "bullish" ? "Resilient" : macroStance === "bearish" ? "Vulnerable" : "Balanced"
  } from a Macro lens (Dalio): ${
    macroFacts.length > 0 ? macroFacts.join("; ") + "." : "insufficient macro-sensitivity data."
  } All-Weather score: ${experimentalScores.dalioScore}/100.`;

  // --- Committee consensus ---
  const stanceScore = (s: Stance) => (s === "bullish" ? 1 : s === "bearish" ? -1 : 0);
  const totalScore =
    stanceScore(valueStance) + stanceScore(growthStance) + stanceScore(macroStance);

  let agentVerdict: "BUY" | "HOLD" | "SELL";
  if (totalScore >= 2) agentVerdict = "BUY";
  else if (totalScore <= -2) agentVerdict = "SELL";
  else agentVerdict = "HOLD";

  const bullishVotes = [valueStance, growthStance, macroStance].filter((s) => s === "bullish").length;
  const bearishVotes = [valueStance, growthStance, macroStance].filter((s) => s === "bearish").length;
  const confidence = Math.round((Math.max(bullishVotes, bearishVotes) / 3) * 100);

  const keyCatalysts: string[] = [];
  if (marginOfSafety != null && marginOfSafety > 15) {
    keyCatalysts.push("Re-rating toward DCF fair value if the market closes the current valuation gap");
  }
  if (revenueGrowth != null && revenueGrowth > 0.15) {
    keyCatalysts.push("Continued top-line acceleration sustaining the growth narrative");
  }
  if (tradingSignals.trend === "bullish") {
    keyCatalysts.push("Technical momentum (price above 50/200-day averages) attracting trend-following flows");
  }
  if (experimentalScores.aiBenefitScore >= 65) {
    keyCatalysts.push("Sector tailwinds from AI/productivity-driven demand");
  }
  if (news.length > 0) {
    keyCatalysts.push(`Recent coverage (${news[0].publisher}): "${news[0].title}"`);
  }
  if (keyCatalysts.length === 0) {
    keyCatalysts.push("No standout near-term catalysts identified from current data");
  }

  const hiddenRisks: string[] = [];
  if (debtToEquity != null && debtToEquity > 150) {
    hiddenRisks.push("Elevated leverage could amplify downside in a rate-shock or earnings-miss scenario");
  }
  if (peg != null && peg > 2.5) {
    hiddenRisks.push("Growth expectations already priced in — any deceleration risks a valuation reset");
  }
  if (beta != null && beta > 1.5) {
    hiddenRisks.push("High beta means outsized drawdowns are likely in a broad market correction");
  }
  if (tradingSignals.rsi14 != null && tradingSignals.rsi14 > 70) {
    hiddenRisks.push("RSI signals near-term overbought conditions, raising pullback risk");
  }
  if (roe != null && roe < 0.05) {
    hiddenRisks.push("Weak returns on equity suggest limited pricing power or competitive moat");
  }
  if (hiddenRisks.length === 0) {
    hiddenRisks.push("No material red flags surfaced in the current quantitative screen");
  }

  return {
    ticker,
    isHeuristic: true,
    methodologyNote:
      "This is a deterministic, rules-based synthesis of the app's own quant signals (guru scores, DCF, technical trend, experimental scores) — not a live generative-AI response. It mimics an investment-committee format for readability but every judgment traces back to a transparent, reproducible rule.",
    agentVerdict,
    confidence,
    reasoningBreakdown: {
      valueView,
      valueStance,
      growthView,
      growthStance,
      macroView,
      macroStance,
    },
    keyCatalysts,
    hiddenRisks,
  };
}
