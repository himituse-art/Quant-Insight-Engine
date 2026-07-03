import { Link } from "wouter";
import { useGetScreeners } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers } from "lucide-react";

function formatMetric(value: number | null, key: string): string {
  if (value == null) return "--";
  if (key === "three-year-return" || key === "undervalued") {
    return `${value.toFixed(1)}%`;
  }
  return value.toFixed(1);
}

function formatPrice(value: number | null): string {
  if (value == null) return "--";
  return `$${value.toFixed(2)}`;
}

export function ScreenerBoard() {
  const { data: screeners, isLoading } = useGetScreeners();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold font-serif">Thematic Top 10 Screeners</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-96 w-full rounded-xl" />
          ))}
        </div>
      ) : screeners && screeners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {screeners.map((screener) => (
            <Card key={screener.key} className="flex flex-col" data-testid={`card-screener-${screener.key}`}>
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm uppercase tracking-wide text-primary">
                  {screener.title}
                </CardTitle>
                <CardDescription className="text-xs leading-snug line-clamp-3">
                  {screener.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pt-0">
                {screener.stocks.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                    No stocks currently meet the screening criteria.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {screener.stocks.map((stock) => (
                      <Link
                        key={stock.symbol}
                        href={`/stock/${stock.symbol}`}
                        className="flex items-center gap-2 py-2 group hover:bg-muted/40 -mx-2 px-2 rounded transition-colors"
                        data-testid={`link-screener-${screener.key}-${stock.symbol}`}
                      >
                        <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">
                          {stock.rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-mono font-bold text-sm text-primary group-hover:underline">
                              {stock.symbol}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate">
                              {formatPrice(stock.price)}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {stock.name}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-mono font-semibold">
                            {formatMetric(stock.metricValue, screener.key)}
                          </div>
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
                            {stock.metricLabel}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed rounded-xl bg-card text-muted-foreground">
          Screener data is not available at the moment.
        </div>
      )}
    </div>
  );
}
