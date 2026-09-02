import logging
import os
from pathlib import Path
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
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
UA = scraper.USER_AGENT

app = FastAPI(title="Synflix API")
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
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
    return {"message": "Synflix API", "sources": [p[0] for p in scraper.PROVIDERS]}


# ----------------------- TMDB -----------------------
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
    results = await asyncio.gather(*[tmdb_get(p, q) for p, q in keys.values()], return_exceptions=True)
    return {name: (res.get("results", []) if isinstance(res, dict) else []) for name, res in zip(keys.keys(), results)}


@api_router.get("/search")
async def search(q: str = Query(...), page: int = 1):
    data = await tmdb_get("search/multi", {"query": q, "page": page, "include_adult": "false"})
    data["results"] = [r for r in data.get("results", []) if r.get("media_type") in ("movie", "tv")]
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


# ----------------------- Stream scraping -----------------------
def _play_url(url, ref, origin):
    q = f"/api/hls?url={quote(url, safe='')}"
    if ref:
        q += f"&ref={quote(ref, safe='')}"
    if origin:
        q += f"&origin={quote(origin, safe='')}"
    return q


@api_router.get("/streams")
async def streams(type: str = "movie", id: str = Query(...),
                  season: int | None = None, episode: int | None = None):
    servers = await scraper.scrape_streams(type, id, season, episode)
    out = []
    for s in servers:
        out.append({
            "id": s["id"], "name": s["name"], "provider": s["provider"],
            "primary": s["primary"], "type": s["type"], "quality": s["quality"],
            "play_url": _play_url(s["url"], s["referer"], s["origin"]),
        })
    return {"type": type, "id": id, "season": season, "episode": episode,
            "count": len(out), "servers": out}


@api_router.get("/hls")
async def hls(url: str = Query(...), ref: str | None = None,
              origin: str | None = None, request: Request = None):
    path = url.split("?")[0].lower()
    headers = {"User-Agent": UA, "Accept": "*/*"}
    if ref:
        headers["Referer"] = ref
    if origin:
        headers["Origin"] = origin
    is_m3u8 = path.endswith(".m3u8")
    is_media = any(path.endswith(e) for e in (".mp4", ".mkv", ".webm"))

    cors = {"Access-Control-Allow-Origin": "*"}

    if is_media:
        # stream with Range passthrough (mp4/mkv)
        rng = request.headers.get("range") if request else None
        if rng:
            headers["Range"] = rng
        aclient = httpx.AsyncClient(timeout=None, follow_redirects=True)
        req = aclient.build_request("GET", url, headers=headers)
        r = await aclient.send(req, stream=True)
        resp_headers = {**cors, "Accept-Ranges": "bytes"}
        for h in ("content-length", "content-range", "content-type"):
            if h in r.headers:
                resp_headers[h] = r.headers[h]

        async def gen():
            try:
                async for chunk in r.aiter_bytes(65536):
                    yield chunk
            finally:
                await r.aclose()
                await aclient.aclose()

        return StreamingResponse(gen(), status_code=r.status_code, headers=resp_headers,
                                 media_type=r.headers.get("content-type", "video/mp4"))

    # m3u8 or segment/key: fetch fully
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
            r = await c.get(url, headers=headers)
            r.raise_for_status()
            ct = r.headers.get("content-type", "").lower()
            if is_m3u8 or "mpegurl" in ct:
                body = scraper.rewrite_m3u8(r.text, url, ref or "", origin or "")
                return Response(body, media_type="application/vnd.apple.mpegurl",
                                headers={**cors, "Cache-Control": "no-cache"})
            data = scraper.strip_png_ts(r.content)
            return Response(data, media_type=ct or "video/mp2t",
                            headers={**cors, "Cache-Control": "public, max-age=3600"})
    except Exception as e:  # noqa: BLE001
        logger.warning("hls proxy failed %s: %s", url[:80], e)
        raise HTTPException(502, "upstream error")


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
