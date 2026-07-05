import { useGetFundFlow } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLargeCurrency, formatLargeNumber, formatPercent, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Info, Building2, Waves, Users, TrendingUp, TrendingDown, Activity } from "lucide-react";

export default function FundFlowTab({ ticker }: { ticker: string }) {
  const { data, isLoading, error } = useGetFundFlow(ticker, {
    query: { queryKey: ["fundFlow", ticker] },
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
        Could not load fund flow data.
      </div>
    );
  }

  const shockColor =
    data.volumeShockStatus === "accumulation"
      ? "text-up border-up bg-up/5"
      : data.volumeShockStatus === "distribution"
        ? "text-down border-down bg-down/5"
        : "text-muted-foreground border-muted-foreground bg-muted/10";

  const momentumIcon =
    data.institutionalMomentum === "increasing" ? (
      <TrendingUp className="w-4 h-4 text-up" />
    ) : data.institutionalMomentum === "decreasing" ? (
      <TrendingDown className="w-4 h-4 text-down" />
    ) : (
      <Activity className="w-4 h-4 text-muted-foreground" />
    );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>{data.methodologyNote}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Institutional Ownership */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center font-serif text-lg">
              <Building2 className="w-5 h-5 mr-2 text-primary" />
              Institutional Ownership
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-mono">Institutions Hold</div>
                <div className="font-mono font-bold text-2xl">{formatPercent((data.institutionsPercentHeld ?? 0) * 100)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-mono">Reporting Institutions</div>
                <div className="font-mono font-bold text-2xl">{formatLargeNumber(data.institutionsCount)}</div>
              </div>
            </div>
            <Progress value={(data.institutionsPercentHeld ?? 0) * 100} className="h-1.5" />
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> Insiders Hold
              </span>
              <span className="font-mono text-sm font-bold">
                {formatPercent((data.insidersPercentHeld ?? 0) * 100)}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-3">
              {momentumIcon}
              <div>
                <div className="text-xs font-mono font-bold capitalize">{data.institutionalMomentum} momentum</div>
                <div className="text-[11px] text-muted-foreground">{data.institutionalMomentumNote}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volume Shock */}
        <Card className={cn("border", shockColor)}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center font-serif text-lg">
              <Waves className="w-5 h-5 mr-2" />
              Volume Shock Detector
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={cn("uppercase font-mono text-xs", shockColor)}>
                {data.volumeShockStatus}
              </Badge>
              <span className="font-mono text-sm">
                {data.volumeRatio != null ? `${formatNumber(data.volumeRatio)}x avg` : "—"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-mono">Current Volume</div>
                <div className="font-mono font-bold">{formatLargeNumber(data.currentVolume)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-mono">Avg Volume (proxy)</div>
                <div className="font-mono font-bold">{formatLargeNumber(data.averageVolume)}</div>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-mono">Price Change</div>
              <div
                className={cn(
                  "font-mono font-bold",
                  (data.priceChangePercent ?? 0) >= 0 ? "text-up" : "text-down",
                )}
              >
                {(data.priceChangePercent ?? 0) >= 0 ? "+" : ""}
                {formatPercent(data.priceChangePercent)}
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">{data.volumeShockNote}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Whale Holders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            Top Whale Holders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col divide-y divide-border/50">
            {data.topWhaleHolders.length > 0 ? (
              data.topWhaleHolders.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-sm font-medium">{h.organization}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {formatLargeNumber(h.shares)} shares &middot; {formatLargeCurrency(h.value)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm">
                      {h.pctHeld != null ? formatPercent(h.pctHeld * 100) : "—"}
                    </div>
                    <div
                      className={cn(
                        "text-xs font-mono",
                        (h.pctChange ?? 0) >= 0 ? "text-up" : "text-down",
                      )}
                    >
                      {h.pctChange != null
                        ? `${h.pctChange >= 0 ? "+" : ""}${formatPercent(h.pctChange * 100)}`
                        : "—"}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No institutional holder data available.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
