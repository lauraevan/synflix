import asyncio
from playwright.async_api import async_playwright
CHROME="/usr/bin/google-chrome"
URL="https://synflix-preview.preview.emergentagent.com/watch/movie/550"
async def main():
    errs=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME, headless=True, args=["--no-sandbox","--disable-dev-shm-usage","--autoplay-policy=no-user-gesture-required"])
        ctx=await b.new_context(viewport={"width":1280,"height":720})
        pg=await ctx.new_page()
        pg.on("console", lambda m: errs.append(m.text[:140]) if m.type=="error" else None)
        await pg.goto(URL, wait_until="domcontentloaded", timeout=45000)
        played=False
        for t in range(16):
            await pg.wait_for_timeout(3000)
            info=await pg.evaluate("""()=>{const v=document.querySelector('[data-testid=synapse-video-element]');const e=document.querySelector('[data-testid=synapse-error]');const sv=document.querySelectorAll('[data-testid^=synapse-source-]').length;return v?{ct:+v.currentTime.toFixed(1),dur:isFinite(v.duration)?+v.duration.toFixed(0):0,rs:v.readyState,servers:sv,err:!!e}:{none:true}}""")
            print(f"[{(t+1)*3}s]", info)
            if info.get("ct",0)>1: played=True; break
            if info.get("err"): break
        print("=== PLAYED:", played)
        print("=== console errors:", errs[:8])
        await b.close()
asyncio.run(main())
