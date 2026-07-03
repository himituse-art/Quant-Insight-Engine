import { useGetAiCommitteeVerdict } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Gavel,
  Sprout,
  Globe2,
  Flame,
  ShieldAlert,
} from "lucide-react";

export default function AiCommitteeTab({ ticker }: { ticker: string }) {
  const { data, isLoading, error } = useGetAiCommitteeVerdict(ticker, {
    query: { queryKey: ["aiCommittee", ticker] },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Could not load AI committee verdict.
      </div>
    );
  }

  const verdictColor =
    data.agentVerdict === "BUY"
      ? "text-up border-up"
      : data.agentVerdict === "SELL"
        ? "text-down border-down"
        : "text-muted-foreground border-muted-foreground";

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>{data.methodologyNote}</p>
      </div>

      {/* Verdict Banner */}
      <Card className="overflow-hidden border-border">
        <div className="bg-black text-green-400 font-mono p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs text-green-500/70 uppercase tracking-widest mb-1">
                &gt; investment_committee.exe --ticker={data.ticker}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-4xl font-bold tracking-tight",
                    data.agentVerdict === "BUY"
                      ? "text-up"
                      : data.agentVerdict === "SELL"
                        ? "text-down"
                        : "text-yellow-400",
                  )}
                >
                  {data.agentVerdict}
                </span>
                <Badge variant="outline" className={cn("font-mono", verdictColor)}>
                  {data.confidence}% consensus
                </Badge>
              </div>
            </div>
            <div className="flex gap-3">
              <StanceIcon label="Value" stance={data.reasoningBreakdown.valueStance} />
              <StanceIcon label="Growth" stance={data.reasoningBreakdown.growthStance} />
              <StanceIcon label="Macro" stance={data.reasoningBreakdown.macroStance} />
            </div>
          </div>
        </div>
      </Card>

      {/* Reasoning Breakdown - terminal style */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PersonaCard
          icon={<Gavel className="w-5 h-5" />}
          name="The Value Investor"
          subtitle="Buffett / Munger style"
          stance={data.reasoningBreakdown.valueStance}
          text={data.reasoningBreakdown.valueView}
        />
        <PersonaCard
          icon={<Sprout className="w-5 h-5" />}
          name="The Growth Hacker"
          subtitle="Peter Lynch style"
          stance={data.reasoningBreakdown.growthStance}
          text={data.reasoningBreakdown.growthView}
        />
        <PersonaCard
          icon={<Globe2 className="w-5 h-5" />}
          name="The Macro Strategist"
          subtitle="Ray Dalio style"
          stance={data.reasoningBreakdown.macroStance}
          text={data.reasoningBreakdown.macroView}
        />
      </div>

      {/* Catalysts & Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-up/20 bg-up/5">
          <CardContent className="p-5">
            <div className="flex items-center font-mono text-sm font-bold uppercase tracking-wider mb-3 text-up">
              <Flame className="w-4 h-4 mr-2" /> Key Catalysts
            </div>
            <ul className="space-y-2">
              {data.keyCatalysts.map((c, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-up mt-1">▲</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-down/20 bg-down/5">
          <CardContent className="p-5">
            <div className="flex items-center font-mono text-sm font-bold uppercase tracking-wider mb-3 text-down">
              <ShieldAlert className="w-4 h-4 mr-2" /> Hidden Risks
            </div>
            <ul className="space-y-2">
              {data.hiddenRisks.map((r, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-down mt-1">▼</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StanceIcon({ label, stance }: { label: string; stance: "bullish" | "bearish" | "neutral" }) {
  const Icon = stance === "bullish" ? TrendingUp : stance === "bearish" ? TrendingDown : Minus;
  const color = stance === "bullish" ? "text-up" : stance === "bearish" ? "text-down" : "text-yellow-400";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("rounded-full border border-current p-2", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-[10px] text-green-500/70 uppercase">{label}</span>
    </div>
  );
}

function PersonaCard({
  icon,
  name,
  subtitle,
  stance,
  text,
}: {
  icon: React.ReactNode;
  name: string;
  subtitle: string;
  stance: "bullish" | "bearish" | "neutral";
  text: string;
}) {
  const stanceColor =
    stance === "bullish" ? "border-up/40 text-up" : stance === "bearish" ? "border-down/40 text-down" : "border-border text-muted-foreground";

  return (
    <Card className="h-full">
      <CardContent className="p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            <div>
              <div className="font-serif font-bold text-sm leading-tight">{name}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{subtitle}</div>
            </div>
          </div>
          <Badge variant="outline" className={cn("uppercase text-[10px] font-mono", stanceColor)}>
            {stance}
          </Badge>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 font-mono text-xs leading-relaxed flex-1 text-muted-foreground">
          {text}
        </div>
      </CardContent>
    </Card>
  );
}
