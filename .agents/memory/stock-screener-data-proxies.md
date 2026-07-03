---
name: Stock screener data proxies
description: Data-availability workarounds used when implementing thematic Top-10 stock screeners against free Yahoo Finance JSON endpoints (no API key).
---

The free/public Yahoo Finance JSON endpoints (quoteSummary, chart, search) do not expose: historical PE series (5Y), multi-year revenue/earnings CAGR, forward analyst consensus EPS targets (e.g. 2029), or R&D expense.

**Why:** These endpoints are unauthenticated-adjacent (session cookie + crumb only, see yahoo-finance-crumb-auth.md) convenience endpoints, not the full paid Yahoo/Bloomberg data feed — they only return present-day snapshot fields.

**How to apply:** When a screener/algorithm spec calls for one of these unavailable series, substitute a same-session proxy computed from data that IS available, and document the substitution inline as a code comment plus in the UI description text so it reads as a stated methodology rather than a silent approximation:
- "5Y PE percentile" → cross-sectional percentile rank of trailing PE against the same screening universe.
- "3Y revenue/EPS CAGR" or "2029 consensus EPS" → compound the available YoY earningsGrowth/revenueGrowth fields forward N years, capped at a sane ceiling (e.g. 40%) to avoid runaway outliers dominating rankings.
- "R&D expense ratio" → gross margin as a proxy for R&D-intensity (tech/AI names with high margins).
- Universe-wide screeners (needing data for 50-100 tickers) should batch-fetch with limited concurrency (e.g. 8) and cache the whole computed result for several minutes — do not recompute per-request or fetch fully serially.
