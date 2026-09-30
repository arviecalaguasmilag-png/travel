# Travel

A small travel companion for any country. Keep separate trips, save and edit places, and open transit, driving, or walking directions in Google Maps. Uber opens separately for fare checks and booking.

The interface has editable trip names, countries, and time zones. Existing Taiwan Together places migrate into the first Taiwan trip. Sharing copies one trip; JSON backups contain all trips. Imports add copies without overwriting current data.

## Run and test

Requires Node 24; no npm dependencies, database, or API keys.

```sh
node server.mjs
node --test
```

Local preview: `http://127.0.0.1:4174`. Production listens on Railway's `PORT`.

## Deployment

Git remote: `https://github.com/arviecalaguasmilag-png/travel.git`

Deploy branch: `main`. Railway uses the included Dockerfile and railway.json. The existing service is `taiwan-together` in project `jubilant-trust`; the stable address is https://taiwan-together-production.up.railway.app. The service/domain keeps its old identifier so saved browser data stays available. The app's visible name is Travel.

No deployment token belongs in this repository. Railway's GitHub integration watches the main branch. Serverless sleeping is configured to reduce usage. Free hosting has finite credits; no paid Maps APIs are used.

## Data and limitations

Trips are stored in the visitor's browser under `travel-trips-v2`. The previous `taiwan-together-free-places-v1` key is retained during migration. Shared data is encoded in URL fragments. The server serves static files and does not store trip addresses. Full addresses should include their city and country. Travel does not automatically rank transport options or supply real-time fares/departures; Google Maps and Uber supply their own information.

See [START-HERE.txt](START-HERE.txt) for everyday use and backups.
