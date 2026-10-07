# Travel

A small travel companion for any country. Keep separate trips, search saved places by name or address, and open transit, driving, or walking directions in Google Maps. Convert local prices to Philippine pesos with dated daily reference rates and an offline fallback.

The interface has editable trip names, countries, and time zones, a compact responsive planner, searchable place pickers, and removal Undo. Existing Taiwan Together places migrate into the first Taiwan trip. Sharing copies one trip; JSON backups contain all trips. Imports add copies without overwriting current data. Sharing and backups live in the Trip tools (•••) menu.

## Run and test

Requires Node 24; no npm dependencies, database, or API keys.

```sh
node server.mjs
node --test
```

Local preview: `http://127.0.0.1:4174`. Production listens on Railway's `PORT`.

## Deployment

Git remote: `https://github.com/arviecalaguasmilag-png/travel.git`

Deploy branch: `main`. Railway builds the included Dockerfile. The service is `taiwan-together` in project `jubilant-trust`; the public address is https://arvie-travel-planner.up.railway.app. The app's visible name is Travel. Browser data is specific to each domain; export a backup before changing the address again and import it at the new address.

Runtime settings are saved in Railway: Serverless enabled, healthcheck `/health` with a 90-second timeout, and On Failure restart with 3 retries. `railway.json` records the same values for legacy services; this new service uses dashboard settings because Railway has deprecated that config format.

No deployment token belongs in this repository. Railway's GitHub integration watches the main branch. Serverless sleeping is configured to reduce usage. Free hosting has finite credits; no paid Maps APIs are used.

## Data and limitations

Trips are stored in the visitor's browser under `travel-trips-v2`. The previous `taiwan-together-free-places-v1` key is retained during migration. Shared data is encoded in URL fragments. The server serves static files and does not store trip addresses. Full addresses should include their city and country. Travel does not automatically rank transport options or supply real-time fares/departures; Google Maps supplies route information.

## Currency conversion

The active trip's country suggests a local currency; unrecognized countries prompt for a selection. Manual currency preferences are saved as an optional `currency` field in the existing version-2 trip format and included in backups and sharing. Philippine pesos are the fixed target currency. Rates are estimates, not bank or card quotes.

`GET /api/rates?base=TWD` requests the PHP reference rate from [Frankfurter v2](https://frankfurter.dev/). Only an allowlisted currency code is forwarded, never trip addresses or entered amounts. The server validates responses, uses an eight-second upstream timeout, shares concurrent requests, caches rates for six hours, and backs off after failures. Previous rates are returned with `stale: true` if an update fails. No API key or new dependency is needed.

Validated browser rates are stored separately under `travel-peso-rates-v1`. Offline or failed updates show a saved-rate label and the original rate date. Dates older than four days are explicitly marked older; missing rates never produce a fabricated conversion. Clearing browser data removes this cache. The `travel-shell-v3` service-worker cache includes the new client modules; API responses are not stored in the app-shell cache.

See [START-HERE.txt](START-HERE.txt) for everyday use and backups.
