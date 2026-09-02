import asyncio
from playwright.async_api import async_playwright
CHROME="/usr/bin/google-chrome"
URL="https://synflix-preview.preview.emergentagent.com/watch/movie/550"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME, headless=True, args=["--no-sandbox","--disable-dev-shm-usage","--autoplay-policy=no-user-gesture-required"])
        ctx=await b.new_context(viewport={"width":1600,"height":900})
        pg=await ctx.new_page()
        await pg.goto(URL, wait_until="domcontentloaded", timeout=45000)
        for _ in range(16):
            await pg.wait_for_timeout(3000)
            ct=await pg.evaluate("()=>{const v=document.querySelector('[data-testid=synapse-video-element]');return v?v.currentTime:0}")
            if ct and ct>2: break
        await pg.wait_for_timeout(1500)
        await pg.mouse.move(800,300); await pg.mouse.move(800,700)
        await pg.wait_for_timeout(500)
        await pg.screenshot(path="/app/tests/player.png")
        # open quality menu for a second shot
        try:
            await pg.click("[data-testid=synapse-quality-menu]")
            await pg.wait_for_timeout(500)
            await pg.screenshot(path="/app/tests/player_menu.png")
        except Exception as e:
            print("menu err", e)
        print("done")
        await b.close()
asyncio.run(main())
