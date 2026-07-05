import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
} from "recharts";
import { useGetFundFlow } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLargeCurrency, formatLargeNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Info, Building2, Waves, Users, Siren, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

const INFLOW_COLOR = "#10b981";
const OUTFLOW_COLOR = "#f43f5e";

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
        Could not load Smart Money Flow data.
      </div>
    );
  }

  const alerts = data.timeSeries.filter((p) => p.whaleAlert !== "NORMAL").reverse();
  const institutionalPct = (data.institutionsPercentHeld ?? 0) * 100;
  const insidersPct = (data.insidersPercentHeld ?? 0) * 100;
  const retailPct = Math.max(0, 100 - institutionalPct - insidersPct);

  const pieData = [
    { name: "Institutional", value: Number(institutionalPct.toFixed(2)), color: "hsl(var(--primary))" },
    { name: "Insiders", value: Number(insidersPct.toFixed(2)), color: "#eab308" },
    { name: "Public / Retail", value: Number(retailPct.toFixed(2)), color: "hsl(var(--muted-foreground))" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>{data.methodologyNote}</p>
      </div>

      {/* Whale Alert Timeline Feed */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center font-serif text-lg">
            <Siren className="w-5 h-5 mr-2 text-primary" />
            Whale Alert Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {alerts.length > 0 ? (
            <div className="flex flex-col divide-y divide-border/50 max-h-72 overflow-y-auto">
              {alerts.map((a, i) => {
                const isInflow = a.whaleAlert === "MEGA_INFLOW";
                return (
                  <div key={i} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      {isInflow ? (
                        <ArrowUpCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <ArrowDownCircle className="w-5 h-5 text-rose-500 shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-medium font-mono">{a.date}</div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase mt-0.5",
                            isInflow ? "border-emerald-500 text-emerald-500" : "border-rose-500 text-rose-500",
                          )}
                        >
                          {a.whaleAlert.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          "font-mono font-bold",
                          isInflow ? "text-emerald-500" : "text-rose-500",
                        )}
                      >
                        {isInflow ? "+" : ""}
                        {formatLargeCurrency(a.netDollarFlow)}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">close {a.close.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No statistically significant whale flow detected in the observed window.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Visualizer: Bi-directional Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center font-serif text-xl">
            <Waves className="w-5 h-5 mr-2 text-primary" />
            Daily Net Dollar Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  minTickGap={40}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  tickFormatter={(v: number) => formatLargeCurrency(v)}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, _name, item) => [
                    formatLargeCurrency(value),
                    item.payload.whaleAlert !== "NORMAL" ? `Net Flow (${item.payload.whaleAlert})` : "Net Flow",
                  ]}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                <Bar dataKey="netDollarFlow" radius={[2, 2, 2, 2]}>
                  {data.timeSeries.map((point, i) => {
                    const isInflow = point.netDollarFlow >= 0;
                    const isAlert = point.whaleAlert !== "NORMAL";
                    return (
                      <Cell
                        key={i}
                        fill={isInflow ? INFLOW_COLOR : OUTFLOW_COLOR}
                        fillOpacity={isAlert ? 1 : 0.55}
                        stroke={isAlert ? (isInflow ? INFLOW_COLOR : OUTFLOW_COLOR) : "transparent"}
                        strokeWidth={isAlert ? 2 : 0}
                        style={
                          isAlert
                            ? { filter: `drop-shadow(0 0 6px ${isInflow ? INFLOW_COLOR : OUTFLOW_COLOR})` }
                            : undefined
                        }
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: INFLOW_COLOR }} /> Inflow
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: OUTFLOW_COLOR }} /> Outflow
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm inline-block border-2"
                style={{ borderColor: INFLOW_COLOR, boxShadow: `0 0 4px ${INFLOW_COLOR}` }}
              />
              Whale Alert (&gt;2 SD)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Support Elements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ownership Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center font-serif text-lg">
              <Building2 className="w-5 h-5 mr-2 text-primary" />
              Institutional vs Retail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {pieData.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                    {entry.name}
                  </span>
                  <span className="font-mono font-bold">{formatPercent(entry.value)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> Reporting Institutions
              </span>
              <span className="font-mono text-sm font-bold">{formatLargeNumber(data.institutionsCount)}</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">Top 3 Whale Concentration</span>
              <span className="font-mono text-sm font-bold text-primary">
                {formatPercent(data.top3WhaleConcentrationPercent)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Top Whales Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Top 5 Whale Holders
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
    </div>
  );
}
