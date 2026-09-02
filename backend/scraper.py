"""Synflix stream scraper.

Primary source is vidup.to. We reproduce the site's own client lifecycle:
  1. fetch the embed page (/movie/{id} or /tv/{id}/{s}/{e})
  2. deobfuscate the Next.js flight payload and extract the short-lived `en` token
  3. drive the site's real (heavily obfuscated) client JS in a headless browser so
     its own runtime decrypts the catalog + unlock responses, and we capture the
     resulting HLS .m3u8 straight off the network.

vidup.to ships aggressive anti-automation, so a raw .m3u8 is best-effort. When it
cannot be recovered server-side we fall back to embedding the provider player.
"""
import asyncio
import os
import re
import time

import httpx

VIDUP_ORIGIN = os.environ.get("VIDUP_ORIGIN", "https://vidup.to")
USER_AGENT = os.environ.get(
    "SCRAPER_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
)
CHROME_PATH = os.environ.get("CHROME_PATH", "/usr/bin/google-chrome")

# in-memory TTL caches
_resolve_cache: dict[str, tuple[float, dict]] = {}
_RESOLVE_TTL = 600  # 10 min


def content_path(media_type: str, tmdb_id, season=None, episode=None) -> str:
    if media_type == "tv":
        return f"/tv/{tmdb_id}/{season}/{episode}"
    return f"/movie/{tmdb_id}"


def _parse_page_token(html: str):
    """Deobfuscate the Next.js flight chunks and pull the `en` session token."""
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)', html)
    if chunks:
        joined = "".join(chunks).replace("\\n", "\n").replace('\\"', '"')
        m = re.search(r'"en":"([^"]+)"', joined)
        if m:
            return m.group(1)
    for pat in (r'\\"en\\":\\"([^\\"]+)\\"', r'"en":"([^"]+)"'):
        m = re.search(pat, html)
        if m:
            return m.group(1)
    return None


async def scrape_token(media_type: str, tmdb_id, season=None, episode=None) -> dict:
    """Step 1+2: fetch embed page, extract `en` token + basic meta."""
    path = content_path(media_type, tmdb_id, season, episode)
    url = f"{VIDUP_ORIGIN}{path}"
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        r = await client.get(url, headers={"User-Agent": USER_AGENT})
        html = r.text
    token = _parse_page_token(html)
    title = None
    tm = re.search(r'"title":"([^"]{1,120})"', html)
    if tm:
        title = tm.group(1)
    return {
        "url": url,
        "path": path,
        "status": r.status_code if 'r' in dir() else None,
        "token": token,
        "token_preview": (token[:32] + "…") if token else None,
        "title": title,
        "ok": bool(token),
    }


async def resolve_vidup(media_type: str, tmdb_id, season=None, episode=None,
                        budget: float = 22.0) -> dict:
    """Drive the real vidup client in headless Chrome and capture the .m3u8.

    Returns {ok, stream_url, servers, token, reason}.
    """
    path = content_path(media_type, tmdb_id, season, episode)
    cache_key = path
    now = time.time()
    hit = _resolve_cache.get(cache_key)
    if hit and now - hit[0] < _RESOLVE_TTL:
        return hit[1]

    token_info = await scrape_token(media_type, tmdb_id, season, episode)
    result = {
        "ok": False,
        "path": path,
        "token": token_info.get("token"),
        "token_preview": token_info.get("token_preview"),
        "stream_url": None,
        "servers": [],
        "reason": "token missing" if not token_info.get("token") else None,
    }

    if not token_info.get("token"):
        _resolve_cache[cache_key] = (now, result)
        return result

    manifests: list[str] = []
    try:
        from playwright.async_api import async_playwright

        page_url = f"{VIDUP_ORIGIN}{path}"

        async def run():
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    executable_path=CHROME_PATH,
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-blink-features=AutomationControlled",
                        "--autoplay-policy=no-user-gesture-required",
                    ],
                )
                ctx = await browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": 1280, "height": 720},
                    locale="en-US",
                )
                await ctx.add_init_script(
                    "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
                )
                page = await ctx.new_page()

                def on_response(resp):
                    u = resp.url
                    ct = (resp.headers or {}).get("content-type", "")
                    if ".m3u8" in u or "mpegurl" in ct.lower():
                        if u not in manifests:
                            manifests.append(u)

                page.on("response", on_response)
                try:
                    await page.goto(page_url, wait_until="domcontentloaded", timeout=20000)
                except Exception:
                    pass
                deadline = time.time() + budget
                while time.time() < deadline and not manifests:
                    try:
                        await page.mouse.click(640, 360)
                    except Exception:
                        pass
                    await page.wait_for_timeout(2500)
                await browser.close()

        await asyncio.wait_for(run(), timeout=budget + 8)
    except Exception as e:  # noqa: BLE001
        result["reason"] = f"resolve error: {type(e).__name__}"

    if manifests:
        result["ok"] = True
        result["stream_url"] = manifests[0]
        result["servers"] = [{"name": "VidUp", "stream_url": m} for m in manifests]
        result["reason"] = None
    elif not result["reason"]:
        result["reason"] = "anti-bot blocked server-side resolve"

    _resolve_cache[cache_key] = (time.time(), result)
    return result


# ---------------- HLS proxy ----------------
_PROXY_PREFIX = "/api/hls?url="


def _strip_png_ts(buf: bytes) -> bytes:
    if len(buf) < 4 or buf[0] == 0x47:
        return buf
    if buf[:4] != b"\x89PNG":
        return buf
    idx = buf.find(b"IEND")
    if idx >= 0 and idx + 8 < len(buf):
        return buf[idx + 8:]
    for i in range(min(len(buf), 65536)):
        if buf[i] == 0x47 and i + 188 < len(buf) and buf[i + 188] == 0x47:
            return buf[i:]
    return buf


def _rewrite_m3u8(text: str, base_url: str) -> str:
    from urllib.parse import quote, urljoin

    out = []
    for line in text.split("\n"):
        s = line.strip()
        if not s or s.startswith("#"):
            # rewrite URI="..." inside EXT tags (keys, maps)
            m = re.search(r'URI="([^"]+)"', line)
            if m:
                abs_u = urljoin(base_url, m.group(1))
                line = line.replace(
                    m.group(1), f"{_PROXY_PREFIX}{quote(abs_u, safe='')}"
                )
            out.append(line)
        else:
            abs_u = urljoin(base_url, s)
            out.append(f"{_PROXY_PREFIX}{quote(abs_u, safe='')}")
    return "\n".join(out)


async def proxy_hls(target_url: str):
    """Fetch an HLS resource with vidup referer/origin; rewrite playlists,
    strip PNG-masked TS. Returns (content, media_type)."""
    headers = {
        "User-Agent": USER_AGENT,
        "Referer": f"{VIDUP_ORIGIN}/",
        "Origin": VIDUP_ORIGIN,
    }
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        r = await client.get(target_url, headers=headers)
        r.raise_for_status()
        ct = r.headers.get("content-type", "").lower()
        path = target_url.split("?")[0].lower()
        if "mpegurl" in ct or "m3u8" in ct or path.endswith(".m3u8"):
            return _rewrite_m3u8(r.text, target_url), "application/vnd.apple.mpegurl"
        data = _strip_png_ts(r.content)
        return data, ct or "application/octet-stream"
