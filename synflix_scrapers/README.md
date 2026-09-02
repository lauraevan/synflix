# Synflix Scrapers
Standalone TMDB-id -> stream resolvers. Each returns JSON {status, playable_urls:[{url,type,quality,headers}]}.

- vidup.py  (VidUp  / VixSrc)  -> clean HLS
- orbit.py  (Orbit  / Castle)  -> HLS
- nova.py   (Nova   / Vidlink) -> HLS/MP4
- nest.py   (Nest   / VidNest) -> HLS

## Usage
    pip install -r requirements.txt
    python3 vidup.py 550 --type movie --pretty
    python3 nest.py 1396 --type tv --season 1 --episode 1 --pretty
