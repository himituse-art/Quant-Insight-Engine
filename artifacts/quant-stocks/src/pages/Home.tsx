import { useState } from "react";
import { useSearchStocks, useGetPopularStocks } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Search, TrendingUp, AlertCircle, ChevronRight, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { Badge } from "@/components/ui/badge";
import { ScreenerBoard } from "@/components/ScreenerBoard";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data: searchResults, isLoading: isSearchLoading } = useSearchStocks(
    { q: debouncedSearch },
    { query: { enabled: debouncedSearch.length > 0, queryKey: ["search", debouncedSearch] } }
  );

  const { data: popularStocks, isLoading: isPopularLoading } = useGetPopularStocks();

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">
          Professional Grade Equity Analysis
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          Access institutional-quality data, DCF valuations, guru scoring models, and trading signals in one dense, powerful interface.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            type="text"
            placeholder="Search by ticker or company name (e.g., AAPL, Microsoft)..."
            className="w-full pl-12 pr-4 py-6 text-lg bg-card border-2 border-border focus:border-primary rounded-xl shadow-sm font-mono"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-ticker"
          />
        </div>

        {debouncedSearch.length > 0 && (
          <Card className="mt-4 absolute z-20 w-full max-w-2xl border-primary/20 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="max-h-[400px] overflow-y-auto">
              {isSearchLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <div className="divide-y">
                  {searchResults.map((result) => (
                    <Link
                      key={result.symbol}
                      href={`/stock/${result.symbol}`}
                      className="block hover:bg-muted/50 p-4 transition-colors"
                      data-testid={`link-search-result-${result.symbol}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-lg text-primary">{result.symbol}</span>
                            {result.exchange && (
                              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                {result.exchange}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{result.name}</div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                  <p>No symbols found matching "{debouncedSearch}"</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold font-serif">Market Movers & Popular Tickers</h2>
        </div>

        {isPopularLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : popularStocks && popularStocks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularStocks.map((stock) => (
              <Link key={stock.symbol} href={`/stock/${stock.symbol}`} className="block group">
                <Card className="h-full hover:border-primary/50 transition-colors group-hover:bg-muted/20">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="font-mono text-xl text-primary">{stock.symbol}</CardTitle>
                      <Activity className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <CardDescription className="line-clamp-1">{stock.name}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed rounded-xl bg-card text-muted-foreground">
            No popular stocks available at the moment.
          </div>
        )}
      </div>

      <ScreenerBoard />
    </div>
  );
}
