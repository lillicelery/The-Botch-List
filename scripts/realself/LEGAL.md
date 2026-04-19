# RealSelf — Legal Compliance Decision

**Decision: SKIP RealSelf scraping entirely.**

## robots.txt Findings (checked 2026-04-17)

RealSelf's `robots.txt` disallows the paths needed for surgeon directory scraping:

- `Disallow: /find/*?rangev2` — blocks filtered directory queries
- `Disallow: /drsearch` — blocks doctor search
- `Disallow: /search?*` — blocks all search results
- General `/find/*` patterns with parameters are restricted

Only GPTBot receives an explicit `Allow: /` override. No other crawlers are granted access to listing pages.

## ToS Review

RealSelf's Terms of Service prohibit automated data collection from their platform without prior written consent from RealSelf.

## Alternative

Use the **Yelp Fusion API** (official, legally permitted) for cosmetic surgeon directory data in Seattle. Yelp's business data is richer and specifically allows fetching business metadata and a limited number of reviews via their official API with attribution requirements.
