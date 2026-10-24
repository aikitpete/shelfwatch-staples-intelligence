# Shelfwatch

Mobile-first price comparison for everyday staples across **Korea, Taiwan, Slovakia and Germany**.
Every price is compared per kg, per litre or per piece, shown in EUR with the native currency beneath, and
stored with its source, origin and date. Prices are append-only, so price history is never lost.

**Live demo:** https://aikitpete.github.io/shelfwatch-staples-intelligence/ (demo data, edits stay in your browser)

<p><img src="docs/compare.png" width="260"> <img src="docs/item.png" width="260"></p>

## What it does
- **Compare** staples per unit, with a ladder of the best shops, promo end dates and "old price" warnings.
- **In-store mode**: pick the shop you are in and see only its prices and where it beats the rest.
- **Import**: photo of a shelf or receipt (Claude vision), pasted text, or JSON from any LLM.
  Rows are checked before saving. Units that differ from the item's comparison unit are converted and highlighted.
- **Data**: price history, freshness, coverage, a failed-fetch report ranked by fixability, SQL export for Supabase.
- **Guide**: buying rules, loyalty programs and a scored register of price sources.

## Architecture
One HTML file, no framework. The app talks to a tiny storage interface
(`db.collection().onSnapshot`, `db.doc().set/update/delete`), with two backends:

| Target | Backend | Use |
|---|---|---|
| `claude` | Claude artifact database | private, real data, photo reading, scheduled research |
| `demo` | static JSON in `data/demo/` + browser localStorage | public showcase, GitHub Pages |

Swap the data by replacing the files in `data/demo/` (or set `window.SHELFWATCH_DATA` to another folder).
A future Supabase backend only needs to implement the same few calls; `schema.sql` is the matching Postgres schema.

## Run
```bash
python3 scripts/build.py demo            # writes dist/demo/
cd dist/demo && python3 -m http.server   # open http://localhost:8000
python3 scripts/build.py claude          # writes dist/claude/page.html (publish as a Claude artifact)
```

## Keeping private data private
- `data/private/` is git-ignored. Never commit a real export.
- `scripts/scrub.py <private-dump-dir>` rebuilds `data/demo/` from a private dump: it drops photos, auto-check logs
  and personal text, and replaces the guide with generic rules. Prices, store links and USDA reference nutrition are public facts and stay.
- Review `git diff data/demo` before every push. API keys never belong in the repo.

## Data notes
Demo prices come from public shelf and web prices plus the Korea Consumer Agency price survey (public data, data.go.kr).
Treat them as illustrative, not a live price feed.

MIT licence.
