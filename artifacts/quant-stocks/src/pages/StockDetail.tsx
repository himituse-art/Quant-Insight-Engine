import { useParams, Link } from "wouter";
import { useGetStockDetail } from "@workspace/api-client-react";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Activity,
  AlertTriangle,
  Newspaper,
  ExternalLink,
  Target,
  ShieldAlert,
  BrainCircuit,
  LineChart,
  Briefcase,
  DollarSign,
  BarChart4
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatNumber, formatPercent, formatLargeCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import HistoricalValuationTab from "@/components/HistoricalValuationTab";
import AiCommitteeTab from "@/components/AiCommitteeTab";
import FundFlowTab from "@/components/FundFlowTab";

// Helper for generic number formatting
const valOrDash = (val: number | null | undefined, formatter: (v: number) => string) => {
  if (val === null || val === undefined) return "-";
  return formatter(val);
};

export default function StockDetail() {
  const params = useParams<{ ticker: string }>();
  const ticker = params.ticker?.toUpperCase() || "";

  const { data: stock, isLoading, error } = useGetStockDetail(ticker, {
    query: { enabled: !!ticker, queryKey: ["stockDetail", ticker] }
  });

  if (isLoading) {
    return <StockDetailSkeleton />;
  }

  if (error || !stock) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Screener
        </Link>
        <div className="p-8 text-center border border-destructive/20 bg-destructive/5 rounded-xl text-destructive">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-bold font-serif mb-2">Symbol Not Found</h2>
          <p>Could not retrieve data for {ticker}. It may be delisted or unsupported.</p>
        </div>
      </div>
    );
  }

  const { marketData, guruScores, dcfValuation, tradingSignals, news, financialLinks, experimentalScores } = stock;
  const isPositive = marketData.change !== null && marketData.change >= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-500">
      {/* Navigation */}
      <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Screener
      </Link>

      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-border/50">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl md:text-5xl font-bold font-mono tracking-tight text-primary">
              {stock.ticker}
            </h1>
            {stock.sector && (
              <Badge variant="secondary" className="font-mono uppercase text-[10px]">
                {stock.sector}
              </Badge>
            )}
            {stock.industry && (
              <Badge variant="outline" className="font-mono uppercase text-[10px]">
                {stock.industry}
              </Badge>
            )}
          </div>
          <p className="text-xl text-muted-foreground font-serif">{stock.companyName}</p>
        </div>

        <div className="text-left md:text-right">
          <div className="text-4xl font-mono font-bold tracking-tight">
            {valOrDash(marketData.price, formatCurrency)}
          </div>
          <div className={cn(
            "flex items-center text-lg font-mono font-medium md:justify-end mt-1",
            isPositive ? "text-up" : "text-down"
          )}>
            {isPositive ? <TrendingUp className="w-5 h-5 mr-1.5" /> : <TrendingDown className="w-5 h-5 mr-1.5" />}
            {isPositive ? "+" : ""}{valOrDash(marketData.change, formatNumber)} 
            <span className="opacity-80 ml-2 text-sm">
              ({isPositive ? "+" : ""}{valOrDash(marketData.changePercent, formatPercent)})
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-2 font-mono">
            Last Updated: {new Date(marketData.lastUpdated).toLocaleString()}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="valuation">Historical Valuation</TabsTrigger>
          <TabsTrigger value="ai-committee">AI Committee</TabsTrigger>
          <TabsTrigger value="fund-flow">Smart Money Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
      {/* Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Main Data) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Key Stats Snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatBox label="Market Cap" value={valOrDash(marketData.marketCap, formatLargeCurrency)} />
            <StatBox label="P/E Ratio" value={valOrDash(marketData.peRatio, formatNumber)} />
            <StatBox label="Forward P/E" value={valOrDash(marketData.forwardPe, formatNumber)} />
            <StatBox label="PEG Ratio" value={valOrDash(marketData.pegRatio, formatNumber)} />
            <StatBox label="EPS (TTM)" value={valOrDash(marketData.epsTtm, formatCurrency)} />
            <StatBox label="ROE" value={valOrDash(marketData.roe, formatPercent)} />
            <StatBox label="Gross Margin" value={valOrDash(marketData.grossMargin, formatPercent)} />
            <StatBox label="Free Cash Flow" value={valOrDash(marketData.freeCashFlow, formatLargeCurrency)} />
          </div>

          {/* DCF Valuation */}
          <Card className="border-primary/20 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center font-serif text-2xl">
                <BarChart4 className="w-6 h-6 mr-2 text-primary" />
                Discounted Cash Flow (DCF) Fair Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4 col-span-1 md:col-span-2">
                  <div className="flex justify-between items-end border-b border-border/50 pb-4">
                    <div>
                      <div className="text-sm text-muted-foreground font-mono uppercase tracking-wider mb-1">Estimated Fair Value</div>
                      <div className="text-4xl font-mono font-bold text-primary">
                        {valOrDash(dcfValuation.fairValue, formatCurrency)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground font-mono uppercase tracking-wider mb-1">Margin of Safety</div>
                      <div className={cn(
                        "text-2xl font-mono font-bold",
                        (dcfValuation.marginOfSafetyPercent ?? 0) > 0 ? "text-up" : "text-down"
                      )}>
                        {valOrDash(dcfValuation.marginOfSafetyPercent, formatPercent)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-mono mb-1">1Y Expected</div>
                      <div className={cn("font-mono font-bold", (dcfValuation.expectedReturn1Y ?? 0) > 0 ? "text-up" : "text-down")}>
                        {valOrDash(dcfValuation.expectedReturn1Y, formatPercent)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-mono mb-1">3Y Expected</div>
                      <div className={cn("font-mono font-bold", (dcfValuation.expectedReturn3Y ?? 0) > 0 ? "text-up" : "text-down")}>
                        {valOrDash(dcfValuation.expectedReturn3Y, formatPercent)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-mono mb-1">5Y Expected</div>
                      <div className={cn("font-mono font-bold", (dcfValuation.expectedReturn5Y ?? 0) > 0 ? "text-up" : "text-down")}>
                        {valOrDash(dcfValuation.expectedReturn5Y, formatPercent)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assumed Growth:</span>
                    <span>{valOrDash(dcfValuation.assumedGrowthRate, formatPercent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Terminal Growth:</span>
                    <span>{formatPercent(dcfValuation.terminalGrowthRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount Rate:</span>
                    <span>{formatPercent(dcfValuation.discountRate)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Guru Scores */}
          <div className="space-y-4">
            <h3 className="text-xl font-serif font-bold flex items-center">
              <Briefcase className="w-5 h-5 mr-2 text-primary" />
              Legendary Investor Alignment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GuruCard name="Warren Buffett" score={guruScores.buffettScore} summary={guruScores.buffettSummary} />
              <GuruCard name="Peter Lynch" score={guruScores.lynchScore} summary={guruScores.lynchSummary} />
              <GuruCard name="Charlie Munger" score={guruScores.mungerScore} summary={guruScores.mungerSummary} />
            </div>
          </div>

          {/* Experimental / AI Scores */}
          <Card className="border-accent/30 bg-accent/5 overflow-hidden">
            <div className="bg-accent/10 border-b border-accent/20 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center text-accent-foreground font-mono text-sm uppercase tracking-wider font-bold">
                <BrainCircuit className="w-4 h-4 mr-2" />
                Experimental Heuristics
              </div>
              <Badge variant="outline" className="text-[10px] border-accent/30 text-accent-foreground">Beta</Badge>
            </div>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-mono text-sm font-bold">Soros Reflexivity Score</span>
                      <span className="font-mono text-sm">{experimentalScores.sorosScore}/100</span>
                    </div>
                    <Progress value={experimentalScores.sorosScore} className="h-1.5 mb-2" indicatorClassName="bg-accent" />
                    <p className="text-xs text-muted-foreground">{experimentalScores.sorosSummary}</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-mono text-sm font-bold">Dalio All-Weather Score</span>
                      <span className="font-mono text-sm">{experimentalScores.dalioScore}/100</span>
                    </div>
                    <Progress value={experimentalScores.dalioScore} className="h-1.5 mb-2" indicatorClassName="bg-accent" />
                    <p className="text-xs text-muted-foreground">{experimentalScores.dalioSummary}</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-mono text-sm font-bold">AI Disruption Benefit</span>
                      <span className="font-mono text-sm">{experimentalScores.aiBenefitScore}/100</span>
                    </div>
                    <Progress value={experimentalScores.aiBenefitScore} className="h-1.5 mb-2" indicatorClassName="bg-accent" />
                    <p className="text-xs text-muted-foreground">{experimentalScores.aiBenefitSummary}</p>
                  </div>
                  {experimentalScores.eps2027Estimate && (
                    <div className="bg-background rounded-lg p-4 border border-border/50">
                      <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">Heuristic 2027 EPS Est.</div>
                      <div className="text-2xl font-mono font-bold text-accent-foreground">
                        {formatCurrency(experimentalScores.eps2027Estimate)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column (Sidebar) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Trading Signals */}
          <Card className="border-border">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="flex items-center justify-between font-serif text-xl">
                <span className="flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-primary" />
                  Technical Signals
                </span>
                <Badge variant="outline" className={cn(
                  "font-mono uppercase px-2 py-0.5 text-xs",
                  tradingSignals.trend === 'bullish' ? "border-up text-up" :
                  tradingSignals.trend === 'bearish' ? "border-down text-down" :
                  "border-muted-foreground text-muted-foreground"
                )}>
                  {tradingSignals.trend}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono flex items-center">
                    <Target className="w-3 h-3 mr-1" /> Target 1
                  </span>
                  <div className="font-mono font-bold text-lg">{valOrDash(tradingSignals.targetPrice1, formatCurrency)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono flex items-center">
                    <Target className="w-3 h-3 mr-1" /> Target 2
                  </span>
                  <div className="font-mono font-bold text-lg">{valOrDash(tradingSignals.targetPrice2, formatCurrency)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono flex items-center">
                    <DollarSign className="w-3 h-3 mr-1" /> Entry Zone
                  </span>
                  <div className="font-mono font-bold text-lg text-primary">{valOrDash(tradingSignals.suggestedBuyPrice, formatCurrency)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono flex items-center">
                    <ShieldAlert className="w-3 h-3 mr-1" /> Stop Loss
                  </span>
                  <div className="font-mono font-bold text-lg text-destructive">{valOrDash(tradingSignals.stopLoss, formatCurrency)}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 grid grid-cols-3 gap-2">
                <div className="text-center bg-muted/20 rounded p-2">
                  <div className="text-[10px] text-muted-foreground font-mono mb-1">RSI (14)</div>
                  <div className={cn(
                    "font-mono font-bold",
                    (tradingSignals.rsi14 ?? 50) > 70 ? "text-down" : (tradingSignals.rsi14 ?? 50) < 30 ? "text-up" : ""
                  )}>{valOrDash(tradingSignals.rsi14, formatNumber)}</div>
                </div>
                <div className="text-center bg-muted/20 rounded p-2">
                  <div className="text-[10px] text-muted-foreground font-mono mb-1">SMA (50)</div>
                  <div className="font-mono font-bold">{valOrDash(tradingSignals.sma50, formatNumber)}</div>
                </div>
                <div className="text-center bg-muted/20 rounded p-2">
                  <div className="text-[10px] text-muted-foreground font-mono mb-1">SMA (200)</div>
                  <div className="font-mono font-bold">{valOrDash(tradingSignals.sma200, formatNumber)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Links */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">External Filings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col divide-y divide-border/50">
                <FinancialLink label="SEC Filings (EDGAR)" url={financialLinks.secFilingsUrl} />
                <FinancialLink label="Income Statement" url={financialLinks.incomeStatementUrl} />
                <FinancialLink label="Balance Sheet" url={financialLinks.balanceSheetUrl} />
                <FinancialLink label="Cash Flow" url={financialLinks.cashFlowUrl} />
              </div>
            </CardContent>
          </Card>

          {/* News Feed */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="flex items-center font-serif text-lg">
                <Newspaper className="w-4 h-4 mr-2" /> Recent Coverage
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col divide-y divide-border/50">
                {news.length > 0 ? (
                  news.map((item, i) => (
                    <a 
                      key={i} 
                      href={item.link} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-4 hover:bg-muted/30 transition-colors block group"
                    >
                      <div className="text-xs text-muted-foreground font-mono mb-1 flex justify-between">
                        <span>{item.publisher}</span>
                        <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h4>
                    </a>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No recent news available.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
        </TabsContent>

        <TabsContent value="valuation">
          <HistoricalValuationTab ticker={stock.ticker} />
        </TabsContent>

        <TabsContent value="ai-committee">
          <AiCommitteeTab ticker={stock.ticker} />
        </TabsContent>

        <TabsContent value="fund-flow">
          <FundFlowTab ticker={stock.ticker} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Subcomponents

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between group hover:border-primary/30 transition-colors">
      <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2">{label}</span>
      <span className="font-mono font-bold text-lg">{value}</span>
    </div>
  );
}

function GuruCard({ name, score, summary }: { name: string; score: number; summary: string }) {
  // Color code based on score
  const scoreColor = score >= 80 ? "bg-up" : score >= 50 ? "bg-primary" : "bg-down";
  
  return (
    <Card className="h-full hover:shadow-md transition-all duration-300">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex justify-between items-center mb-4">
          <span className="font-mono text-sm font-bold truncate pr-2">{name}</span>
          <div className="relative w-10 h-10 flex items-center justify-center rounded-full bg-muted/30 border border-border shrink-0">
            <span className="font-mono font-bold text-sm">{score}</span>
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-muted stroke-current"
                strokeWidth="3"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={cn("stroke-current", score >= 80 ? "text-up" : score >= 50 ? "text-primary" : "text-down")}
                strokeWidth="3"
                strokeDasharray={`${score}, 100`}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed flex-1">
          {summary}
        </p>
      </CardContent>
    </Card>
  );
}

function FinancialLink({ label, url }: { label: string; url: string }) {
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noreferrer"
      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
    >
      <span className="text-sm font-medium">{label}</span>
      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </a>
  );
}

function StockDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-pulse">
      <Skeleton className="h-6 w-32" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-border">
        <div className="space-y-3 w-full max-w-md">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-6 w-full" />
        </div>
        <div className="space-y-2 w-full md:w-48 md:text-right">
          <Skeleton className="h-10 w-32 md:ml-auto" />
          <Skeleton className="h-6 w-40 md:ml-auto" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[250px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[250px] w-full rounded-xl" />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
