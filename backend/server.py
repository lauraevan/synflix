import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware

import scraper

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

TMDB_TOKEN = os.environ["TMDB_TOKEN"]
TMDB_BASE = "https://api.themoviedb.org/3"

app = FastAPI(title="Synflix API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("synflix")


async def tmdb_get(path: str, params: dict | None = None) -> dict:
    params = dict(params or {})
    params.setdefault("language", "en-US")
    headers = {"Authorization": f"Bearer {TMDB_TOKEN}", "accept": "application/json"}
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(f"{TMDB_BASE}/{path.lstrip('/')}", params=params, headers=headers)
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=f"TMDB error: {r.text[:200]}")
    return r.json()


@api_router.get("/")
async def root():
    return {"message": "Synflix API", "source": "vidup.to (primary)"}


# ----------------------- TMDB passthrough & helpers -----------------------
@api_router.get("/tmdb/{full_path:path}")
async def tmdb_proxy(full_path: str, request: Request):
    return await tmdb_get(full_path, dict(request.query_params))


@api_router.get("/home")
async def home_feed():
    import asyncio

    keys = {
        "trending": ("trending/all/week", {}),
        "popular_movies": ("movie/popular", {}),
        "top_rated_movies": ("movie/top_rated", {}),
        "now_playing": ("movie/now_playing", {}),
        "popular_tv": ("tv/popular", {}),
        "top_rated_tv": ("tv/top_rated", {}),
        "upcoming": ("movie/upcoming", {}),
    }
    results = await asyncio.gather(
        *[tmdb_get(p, q) for p, q in keys.values()], return_exceptions=True
    )
    out = {}
    for name, res in zip(keys.keys(), results):
        out[name] = (res.get("results", []) if isinstance(res, dict) else [])
    return out


@api_router.get("/search")
async def search(q: str = Query(...), page: int = 1):
    data = await tmdb_get("search/multi", {"query": q, "page": page, "include_adult": "false"})
    data["results"] = [r for r in data.get("results", [])
                       if r.get("media_type") in ("movie", "tv")]
    return data


@api_router.get("/details/{media_type}/{tmdb_id}")
async def details(media_type: str, tmdb_id: int):
    if media_type not in ("movie", "tv"):
        raise HTTPException(400, "media_type must be movie or tv")
    return await tmdb_get(
        f"{media_type}/{tmdb_id}",
        {"append_to_response": "credits,videos,images,similar,recommendations,content_ratings,release_dates"},
    )


@api_router.get("/tv/{tmdb_id}/season/{season}")
async def tv_season(tmdb_id: int, season: int):
    return await tmdb_get(f"tv/{tmdb_id}/season/{season}")


@api_router.get("/genre/{media_type}")
async def genre_list(media_type: str):
    return await tmdb_get(f"genre/{media_type}/list")


@api_router.get("/discover/{media_type}")
async def discover(media_type: str, request: Request):
    params = dict(request.query_params)
    params.setdefault("sort_by", "popularity.desc")
    return await tmdb_get(f"discover/{media_type}", params)


# ----------------------- Streaming sources -----------------------
def _build_sources(media_type, tmdb_id, season, episode):
    m = media_type == "movie"

    def u(base_movie, base_tv):
        return base_movie if m else base_tv

    vidup = (f"{scraper.VIDUP_ORIGIN}/movie/{tmdb_id}" if m
             else f"{scraper.VIDUP_ORIGIN}/tv/{tmdb_id}/{season}/{episode}")
    return [
        {"id": "vidup", "name": "VidUp", "label": "Primary", "primary": True,
         "resolvable": True, "embed_url": vidup},
        {"id": "vidsrccc", "name": "VidCloud", "label": "Mirror", "primary": False,
         "resolvable": False,
         "embed_url": u(f"https://vidsrc.cc/v2/embed/movie/{tmdb_id}",
                        f"https://vidsrc.cc/v2/embed/tv/{tmdb_id}/{season}/{episode}")},
        {"id": "vidsrcto", "name": "VidStream", "label": "Mirror", "primary": False,
         "resolvable": False,
         "embed_url": u(f"https://vidsrc.to/embed/movie/{tmdb_id}",
                        f"https://vidsrc.to/embed/tv/{tmdb_id}/{season}/{episode}")},
        {"id": "autoembed", "name": "FastEmbed", "label": "Mirror", "primary": False,
         "resolvable": False,
         "embed_url": u(f"https://player.autoembed.cc/embed/movie/{tmdb_id}",
                        f"https://player.autoembed.cc/embed/tv/{tmdb_id}/{season}/{episode}")},
        {"id": "twoembed", "name": "SuperStream", "label": "Mirror", "primary": False,
         "resolvable": False,
         "embed_url": u(f"https://www.2embed.cc/embed/{tmdb_id}",
                        f"https://www.2embed.cc/embedtv/{tmdb_id}&s={season}&e={episode}")},
    ]


@api_router.get("/sources")
async def sources(type: str = "movie", id: str = Query(...),
                  season: int | None = None, episode: int | None = None):
    return {"type": type, "id": id, "season": season, "episode": episode,
            "sources": _build_sources(type, id, season, episode)}


@api_router.get("/scrape/token")
async def scrape_token_ep(type: str = "movie", id: str = Query(...),
                          season: int | None = None, episode: int | None = None):
    return await scraper.scrape_token(type, id, season, episode)


@api_router.get("/resolve")
async def resolve_ep(type: str = "movie", id: str = Query(...),
                     season: int | None = None, episode: int | None = None):
    from urllib.parse import quote

    res = await scraper.resolve_vidup(type, id, season, episode)
    play_url = None
    if res.get("ok") and res.get("stream_url"):
        play_url = f"/api/hls?url={quote(res['stream_url'], safe='')}"
    return {
        "ok": res.get("ok", False),
        "play_url": play_url,
        "stream_url": res.get("stream_url"),
        "token_preview": res.get("token_preview"),
        "servers": res.get("servers", []),
        "reason": res.get("reason"),
    }


@api_router.get("/hls")
async def hls_proxy(url: str = Query(...)):
    try:
        content, media_type = await scraper.proxy_hls(url)
    except Exception as e:  # noqa: BLE001
        logger.warning("hls proxy failed %s: %s", url[:80], e)
        raise HTTPException(502, "upstream error")
    headers = {"Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*"}
    return Response(content=content, media_type=media_type, headers=headers)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
