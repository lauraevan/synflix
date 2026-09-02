"""Synflix multi-source stream scraper.

Scrapes real playable stream URLs (HLS .m3u8 / .mp4) off several embed providers
server-side, with VidUp attempted first. Each provider is a self-contained resolver
that replays the provider's own API/handshake and returns direct CDN URLs, which we
then relay through our own HLS/segment proxy (referer-aware).
"""
import asyncio
import json
import os
import re
import time

from providers.vidlink import VidlinkResolver
from providers.vidnest import VidNestResolver
from providers.castle import CastleResolver
from providers.vidrock import VidrockResolver
from providers.vidzee import VidzeeResolver

VIDUP_ORIGIN = os.environ.get("VIDUP_ORIGIN", "https://vidup.to")
USER_AGENT = os.environ.get(
    "SCRAPER_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
)

# Friendly Synflix server names -> resolver classes, in priority order.
PROVIDERS = [
    ("Orbit", "castle", CastleResolver),      # primary
    ("Nova", "vidlink", VidlinkResolver),
    ("Nest", "vidnest", VidNestResolver),
    ("Zen", "vidzee", VidzeeResolver),
    ("Rock", "vidrock", VidrockResolver),
]

_cache: dict[str, tuple[float, list]] = {}
_TTL = 480


def _key(t, i, s, e):
    return f"{t}:{i}:{s}:{e}"


def _stream_type(url: str) -> str:
    u = url.lower()
    if ".m3u8" in u:
        return "hls"
    if ".mp4" in u or ".mkv" in u:
        return "mp4"
    return "hls"


def _run_one(cls, media_type, tmdb_id, season, episode):
    try:
        r = cls()
        out = r.resolve(str(tmdb_id), media_type=media_type, season=season, episode=episode)
        data = json.loads(out) if isinstance(out, str) else out
        if data.get("status") != "success":
            return []
        streams = []
        for pu in data.get("playable_urls", []):
            url = pu.get("url")
            if not url or not url.startswith("http"):
                continue
            headers = pu.get("headers", {}) or {}
            streams.append({
                "url": url,
                "type": pu.get("type") or _stream_type(url),
                "quality": pu.get("quality", "Auto"),
                "referer": headers.get("Referer", ""),
                "origin": headers.get("Origin", ""),
                "user_agent": headers.get("User-Agent", USER_AGENT),
            })
        return streams
    except Exception:
        return []


async def scrape_streams(media_type: str, tmdb_id, season=None, episode=None) -> list:
    """Return a normalized, ranked list of playable servers scraped from all providers."""
    ck = _key(media_type, tmdb_id, season, episode)
    hit = _cache.get(ck)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]

    async def run(name, pid, cls):
        streams = await asyncio.to_thread(_run_one, cls, media_type, tmdb_id, season, episode)
        return name, pid, streams

    results = await asyncio.gather(
        *[run(n, p, c) for n, p, c in PROVIDERS], return_exceptions=True
    )

    servers = []
    for res in results:
        if isinstance(res, Exception):
            continue
        name, pid, streams = res
        for idx, s in enumerate(streams):
            servers.append({
                "id": f"{pid}-{idx}",
                "name": name if idx == 0 else f"{name} {idx + 1}",
                "provider": pid,
                "primary": pid == "castle",
                **s,
            })

    # rank: primary first, then hls before mp4
    servers.sort(key=lambda s: (0 if s["primary"] else 1, 0 if s["type"] == "hls" else 1))
    _cache[ck] = (time.time(), servers)
    return servers


# --------------- referer-aware HLS / media proxy ---------------
def strip_png_ts(buf: bytes) -> bytes:
    if len(buf) < 4 or buf[0] == 0x47:
        return buf
    if buf[:4] == b"\x89PNG":
        idx = buf.find(b"IEND")
        if idx >= 0 and idx + 8 < len(buf):
            return buf[idx + 8:]
    for i in range(min(len(buf), 65536)):
        if buf[i] == 0x47 and i + 188 < len(buf) and buf[i + 188] == 0x47:
            return buf[i:]
    return buf


def rewrite_m3u8(text: str, base_url: str, ref: str, origin: str) -> str:
    from urllib.parse import quote, urljoin

    def prox(u):
        abs_u = urljoin(base_url, u)
        q = f"/api/hls?url={quote(abs_u, safe='')}"
        if ref:
            q += f"&ref={quote(ref, safe='')}"
        if origin:
            q += f"&origin={quote(origin, safe='')}"
        return q

    out = []
    for line in text.split("\n"):
        s = line.strip()
        if not s:
            out.append(line)
        elif s.startswith("#"):
            m = re.search(r'URI="([^"]+)"', line)
            if m:
                line = line.replace(m.group(1), prox(m.group(1)))
            out.append(line)
        else:
            out.append(prox(s))
    return "\n".join(out)
