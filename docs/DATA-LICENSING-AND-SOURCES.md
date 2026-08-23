# Data licensing and source strategy

Elite Estimating must win on interoperability, normalization, workflow, intelligence, and cost efficiency—not by unlawfully copying competitors' proprietary databases.

## Allowed source classes

### 1. Licensed commercial data
Examples include OEM-derived repair data, labor times, parts catalogs, valuation, ADAS/calibration, regional material pricing, property pricing, and weather/catastrophe feeds.

Requirements:
- Contract/license recorded by provider and tenant scope.
- API/bulk-feed terms enforced technically.
- Provider attribution and source IDs retained.
- Redistribution restrictions enforced at export.

### 2. OEM/direct sources
- OEM service information subscriptions/APIs
- build/configuration data
- position statements
- recalls/campaigns
- repair procedures
- calibration requirements

### 3. Public/regulatory sources
- building codes where lawfully available
- public tax/rate tables
- public recall/safety data
- weather and catastrophe data
- public geographic and currency data

### 4. Customer-owned data
- negotiated labor rates
- custom parts/material catalogs
- historical estimates and outcomes
- carrier guidelines
- shop rules
- fleet/equipment catalogs

Customer-owned data remains tenant isolated unless an explicit agreement permits aggregation.

## Forbidden ingestion patterns

- Unauthorized scraping of CCC, Mitchell, Audatex/Solera, Xactimate/Verisk, DAT, GT Motive, ALLDATA, MOTOR, or other licensed databases.
- Circumventing access controls or copying subscription-only content.
- Repackaging provider data beyond license rights.
- Training models on restricted customer/provider data without contractual permission.

## Canonical-source principle

Every external record must preserve:
- provider
- source identifier
- retrieval timestamp
- effective/as-of date when available
- market/region
- license class
- confidence/quality signal
- transformation version

## Provider abstraction

The internal model must never require one vendor. A tenant may configure:
1. preferred provider
2. fallback provider(s)
3. region-specific provider
4. customer-owned override
5. conflict-resolution policy

This lets Elite Estimating lower cost and increase resilience while respecting licenses.

## Global launch gates

A country/market is enabled only when:
- required data rights are documented
- applicable privacy/data-residency requirements are configured
- currency/tax/unit rules are tested
- asset identity coverage is adequate
- repair/property procedures have authoritative sources
- estimate disclosures comply with local requirements
