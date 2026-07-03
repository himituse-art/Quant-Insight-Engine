---
name: Yahoo Finance API crumb auth
description: Yahoo Finance's quoteSummary JSON endpoint rejects requests without a session cookie + crumb token, even with a valid browser User-Agent.
---

Calling `https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}` directly (even with a realistic `User-Agent` header) returns `{"finance":{"result":null,"error":{"code":"Unauthorized","description":"Invalid Crumb"}}}`.

**Why:** Yahoo tightened auth on this endpoint — it now requires a session cookie plus a matching crumb token appended as a query param.

**How to apply:** Before calling quoteSummary (or similar authenticated Yahoo Finance endpoints), first GET `https://fc.yahoo.com` to obtain a session cookie (from `set-cookie`), then GET `https://query1.finance.yahoo.com/v1/test/getcrumb` with that cookie attached to get the crumb (plain text response). Attach both the cookie header and `?crumb=<value>` on subsequent authenticated requests. Cache the (cookie, crumb) pair for a while (e.g. 30 min) to avoid re-fetching on every request. Unauthenticated endpoints like `/v8/finance/chart/{ticker}` and `/v1/finance/search` work fine without this.
