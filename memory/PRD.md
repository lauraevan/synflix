# Synflix — Product Requirements & Status

## Original problem statement
Build a movie streaming site ("Synflix") that scrapes real video streams off vidup.to
and other sources server-side, serves them through our own backend, and plays them in a
custom vidfast.vc-inspired player GUI ("Synapse Player"). Movies/TV metadata via TMDB.

## Architecture
- **Frontend**: React 19 + CRA/craco, Tailwind, shadcn/ui, framer-motion, react-router,
  react-query, hls.js. Dark cinematic theme (Bebas Neue / Outfit / JetBrains Mono).
- **Backend**: FastAPI. TMDB proxy + multi-provider stream scraper + referer-aware HLS/media proxy.
- **Scraper** (`backend/providers/`): pure-Python resolvers (no browser) that replay each
  provider's own API/handshake to return direct CDN URLs. Providers wired: VixSrc (branded
  "VidUp", primary/cleanest HLS), VidLink ("Nova", mp4), Castle ("Orbit"), VidNest ("Nest"),
  Vidzee ("Zen"), Vidrock ("Rock"). Aggregated + ranked by `scraper.scrape_streams`.
- **Proxy** (`/api/hls`): fetches manifests/segments/keys/mp4 with the correct per-provider
  Referer/Origin, rewrites m3u8 media+key URIs back through the proxy, strips PNG/JPG-masked
  TS, supports Range for mp4. This is why streams play cross-origin in the browser.

## Key learning
- vidup.to itself hardened to heavy state-machine obfuscation + anti-bot; server-side
  resolve of vidup's own player is blocked from datacenter IPs. Solved by scraping equivalent
  streams from sibling providers (VixSrc etc.) which DO resolve server-side and play in our
  custom player. "VidUp" is presented as the primary server (backed by VixSrc HLS).

## Implemented (2026-06)
- TMDB browse: trending, popular/top-rated movies & TV, now playing, upcoming, genres, discover.
- Search (multi), title detail (cast, seasons/episodes, similar), Browse by genre.
- **Synapse Player**: custom HLS + mp4 player GUI — play/pause, ±10s, scrubber w/ buffered,
  volume, time, quality (HLS levels), subtitles, speed, PiP, fullscreen, next-episode,
  keyboard shortcuts + help, source/server switcher (11-12 scraped servers), scraping overlay.
- Continue Watching + Watchlist via localStorage.
- Verified: real playback of Fight Club (movie) and scraping for Breaking Bad (TV), Interstellar.

## Backlog / next
- P1: Subtitle sourcing (OpenSubtitles) for HLS streams that lack embedded tracks.
- P1: Per-title poster art on Continue Watching + skip-intro.
- P2: Hover video previews on cards; genre landing pages; infinite scroll on Browse/Search.
