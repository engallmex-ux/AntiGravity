import sys
from playwright.sync_api import sync_playwright

def get_browser_context(playwright_instance, headless=True):
    browser = playwright_instance.chromium.launch(
        headless=headless,
        args=["--start-maximized"] if not headless else []
    )
    context = browser.new_context(
        no_viewport=True if not headless else False,
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    return browser, context
