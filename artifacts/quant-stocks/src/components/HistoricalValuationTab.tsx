import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useGetHistoricalValuation } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { LineChart as LineChartIcon, Info } from "lucide-react";

export default function HistoricalValuationTab({ ticker }: { ticker: string }) {
  const { data, isLoading, error } = useGetHistoricalValuation(ticker, {
    query: { queryKey: ["historicalValuation", ticker] },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-[350px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Could not load historical valuation data.
      </div>
    );
  }

  const fiveYear = data.periods.fiveYear;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>{data.methodologyNote}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center font-serif text-xl">
            <LineChartIcon className="w-5 h-5 mr-2 text-primary" />
            5-Year PE Valuation River Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.chartSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  minTickGap={60}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="peBandPlus2SD" name="+2SD" stroke="hsl(var(--down))" strokeWidth={1} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="peBandPlus1SD" name="+1SD" stroke="hsl(var(--down))" strokeWidth={1} dot={false} strokeDasharray="2 2" opacity={0.6} />
                <Line type="monotone" dataKey="peBandMean" name="Mean" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="peBandMinus1SD" name="-1SD" stroke="hsl(var(--up))" strokeWidth={1} dot={false} strokeDasharray="2 2" opacity={0.6} />
                <Line type="monotone" dataKey="peBandMinus2SD" name="-2SD" stroke="hsl(var(--up))" strokeWidth={1} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="price" name="Price" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PeriodCard label="3-Year" stats={data.periods.threeYear} />
        <PeriodCard label="5-Year" stats={data.periods.fiveYear} />
        <PeriodCard label="10-Year" stats={data.periods.tenYear} />
      </div>

      {fiveYear && (
        <p className="text-xs text-muted-foreground">
          Current PE percentile within the 5-year window: {fiveYear.pePercentile ?? "—"}%. A high percentile
          suggests the stock is trading rich relative to its own history; a low percentile suggests it is cheap
          relative to its own history.
        </p>
      )}
    </div>
  );
}

function PeriodCard({
  label,
  stats,
}: {
  label: string;
  stats:
    | {
        currentPe: number | null;
        pePercentile: number | null;
        peMean: number | null;
        currentPb: number | null;
        pbPercentile: number | null;
      }
    | null;
}) {
  if (!stats) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Not enough history available for the {label} window.
        </CardContent>
      </Card>
    );
  }

  const percentileColor = (p: number | null) => {
    if (p == null) return "";
    if (p >= 80) return "text-down";
    if (p <= 20) return "text-up";
    return "text-foreground";
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-bold">{label}</span>
          <Badge variant="outline" className="text-[10px]">Heuristic</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-mono">PE Now</div>
            <div className="font-mono font-bold">{formatNumber(stats.currentPe)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-mono">PE Percentile</div>
            <div className={cn("font-mono font-bold", percentileColor(stats.pePercentile))}>
              {stats.pePercentile != null ? `${stats.pePercentile}%` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-mono">PB Now</div>
            <div className="font-mono font-bold">{formatNumber(stats.currentPb)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-mono">PB Percentile</div>
            <div className={cn("font-mono font-bold", percentileColor(stats.pbPercentile))}>
              {stats.pbPercentile != null ? `${stats.pbPercentile}%` : "—"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
