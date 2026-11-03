# Hosting the app and API

The desktop client contains the API contract, not the original API server. This
project's standalone API is a new implementation and starts with an empty
database. It does not import Liner accounts or data.

The app uses your API for authentication and personal account data, including
liked tracks, playlists, and listening history. Public music catalog requests
fall back to Liner's existing API by default. Configure `VITE_CATALOG_API_URL`
only if you have another authorized catalog-compatible service. Your account
token and listening-history list are not sent to Liner.

## Railway API and Neon database

1. Create a PostgreSQL database in Neon and copy its pooled connection string.
2. In Neon SQL Editor, run `api/migrations/001_initial.sql`.
3. In Railway, create a project from this GitHub repository and add a service
   for the API. Railway reads `railway.json`, installs the project, and runs
   `pnpm start:api`.
4. Configure these Railway environment variables:
   - `DATABASE_URL`: Neon pooled connection string.
   - `JWT_SECRET`: a randomly generated secret with at least 32 characters.
5. Deploy the service and generate a Railway public domain. The API health
   endpoint is `https://your-api-domain/v1/health`.
6. Set `VITE_API_URL` to that API domain for desktop builds and web builds.
   A mobile client can use the same URL.

The frontend can be hosted separately, including on Netlify. Add `VITE_API_URL`
to the frontend host's build environment and set it to the Railway API domain.
Do not use the frontend host's site URL as the API URL.

For local development, copy `.env.example` to `.env.local`, fill in
`DATABASE_URL` and a private `JWT_SECRET`, then run `pnpm start:api` and
`pnpm dev` in separate terminals. The standalone API loads `.env.local`;
do not commit that file.

To browse and play music without an account API, set
`VITE_MUSIC_ONLY_MODE=true`. This opens the app as a guest, skips account-backed
home data and playback history, and disables account API requests. Music catalog
search and playback remain available; library and account features are not.

## Current implementation boundary

The API implementation is independent and uses this client's public request and
response shapes. It includes account/session management, profiles, follows,
liked tracks, saved collections, playlists, and playback history. Daily
recommendations and leaderboards are not implemented by your API yet. Public
music catalog, radio, lyrics, and explore fallbacks are sent to Liner's existing
API; radio results are filtered against listening history on the client.
Availability depends on those endpoints allowing the app's public/signed
requests. Audio playback continues to use the app's client-side YouTube
fallback. Image proxying, update delivery, sharing, and telemetry are separate
integrations and still need their own configuration or replacement before the
entire product is independent of Liner-hosted services.
