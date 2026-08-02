import os
import sys
import time
import json
import urllib.parse
import re
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

class GETSNavCrawler:
    """
    Robô Mapeador com captura automatizada de Print Screens (Screenshots) e Snapshots HTML.
    """
    def __init__(self, target_url, login_config=None, max_pages=10, headless=True, scan_mode="clicking", progress_callback=None, stop_check=None):
        self.stop_check = stop_check
        self.target_url = target_url
        self.login_config = login_config or {}
        self.max_pages = max_pages
        self.headless = headless
        self.scan_mode = scan_mode
        self.progress_callback = progress_callback
        
        parsed = urllib.parse.urlparse(target_url)
        self.domain = parsed.netloc
        self.base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        self.visited_urls = set()
        self.site_schema = []
        self.transitions = []
        self.menu_links = []
        self.total_discovered = 1
        
        self.screenshots_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "screenshots"))
        self.snapshots_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "snapshots"))
        os.makedirs(self.screenshots_dir, exist_ok=True)
        os.makedirs(self.snapshots_dir, exist_ok=True)

    def _update_progress(self, current_url, status_msg="Mapeando..."):
        visited = len(self.visited_urls)
        total = max(self.total_discovered, self.max_pages)
        percentage = round((visited / total) * 100, 1) if total > 0 else 0.0
        if percentage > 100.0:
            percentage = 100.0
            
        if self.progress_callback:
            self.progress_callback({
                "visited": visited,
                "total": total,
                "percentage": percentage,
                "current_url": current_url,
                "status": status_msg
            })
        else:
            print(f"[{percentage:.1f}%] ({visited}/{total}) {status_msg}: {current_url}")

    def clean_filename(self, text):
        return re.sub(r'[\\/*?:"<>|]', "_", text.strip()) if text else "tela"

    def take_screenshot_and_snapshot(self, page, title_suffix):
        clean_title = self.clean_filename(title_suffix)
        filename = f"{len(self.visited_urls):02d}_{clean_title}"
        img_filename = f"{filename}.png"
        html_filename = f"{filename}.html"
        
        img_path = os.path.join(self.screenshots_dir, img_filename)
        html_path = os.path.join(self.snapshots_dir, html_filename)
        
        try:
            page.screenshot(path=img_path, full_page=True)
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(page.content())
            return f"screenshots/{img_filename}"
        except Exception:
            return None

    def _is_url_allowed(self, url):
        parsed = urllib.parse.urlparse(url)
        return parsed.scheme in ("http", "https") and parsed.netloc == self.domain

    def extract_page_elements(self, page_url, html_content):
        soup = BeautifulSoup(html_content, "html.parser")
        page_info = {
            "url": page_url,
            "titulo": soup.title.string.strip() if soup.title else "GETS Portal",
            "mecanismos_busca": [],
            "menus_navegacao": [],
            "formularios": [],
            "botoes_soltos": []
        }

        for inp in soup.find_all("input"):
            inp_id = inp.get("id", "")
            inp_name = inp.get("name", "")
            inp_ph = inp.get("placeholder", "")
            if any(kw in (inp_id + inp_name + inp_ph).lower() for kw in ["busca", "search", "pesquisa", "filtro", "filter"]):
                page_info["mecanismos_busca"].append({
                    "id": inp_id, "name": inp_name, "placeholder": inp_ph,
                    "selector": f"input#{inp_id}" if inp_id else f"input[name='{inp_name}']"
                })

        for link in soup.find_all("a"):
            href = link.get("href")
            text = link.get_text().strip()
            if href and text and len(text) > 1:
                abs_href = urllib.parse.urljoin(page_url, href.split("#")[0])
                menu_item = {"texto": text, "url": abs_href, "href_original": href}
                if menu_item not in page_info["menus_navegacao"]:
                    page_info["menus_navegacao"].append(menu_item)
                if abs_href.startswith(self.base_url) and abs_href not in self.visited_urls:
                    if abs_href not in [x["url"] for x in self.menu_links]:
                        self.menu_links.append(menu_item)

        self.total_discovered = max(len(self.menu_links) + len(self.visited_urls), self.total_discovered)

        for form in soup.find_all("form"):
            form_info = {
                "id": form.get("id", ""), "action": form.get("action", ""),
                "method": form.get("method", "post").lower(), "campos": [], "botoes": []
            }
            for el in form.find_all(["input", "textarea", "select"]):
                el_name = el.get("name")
                if not el_name: continue
                el_id = el.get("id", "")
                el_type = el.get("type", el.name).lower()
                el_ph = el.get("placeholder", "")
                label_text = ""
                if el_id:
                    lbl = soup.find("label", {"for": el_id})
                    if lbl: label_text = lbl.get_text().strip()
                if not label_text:
                    p_lbl = el.find_parent("label")
                    if p_lbl: label_text = p_lbl.get_text().strip()

                options = []
                if el.name == "select":
                    for opt in el.find_all("option"):
                        options.append({"value": opt.get("value", ""), "text": opt.get_text().strip()})

                form_info["campos"].append({
                    "id": el_id, "name": el_name, "tipo": el_type,
                    "label": label_text or el_name, "placeholder": el_ph,
                    "opcoes": options if options else None,
                    "selector": f"{el.name}#{el_id}" if el_id else f"{el.name}[name='{el_name}']"
                })

            for btn in form.find_all(["button", "input"]):
                if btn.name == "input" and btn.get("type") not in ["submit", "button", "reset"]: continue
                btn_id = btn.get("id", "")
                btn_name = btn.get("name", "")
                btn_text = btn.get_text().strip() if btn.name == "button" else btn.get("value", "")
                btn_type = btn.get("type", "submit").lower()
                form_info["botoes"].append({
                    "id": btn_id, "name": btn_name, "texto": btn_text or btn_type,
                    "tipo": btn_type, "selector": f"#{btn_id}" if btn_id else f"[name='{btn_name}']"
                })
            page_info["formularios"].append(form_info)
            
        return page_info

    def analyze_by_clicking(self, page, current_depth=0):
        url = page.url
        if (self.stop_check and self.stop_check()) or url in self.visited_urls or len(self.visited_urls) >= self.max_pages or current_depth > 2:
            return
            return

        self.visited_urls.add(url)
        self._update_progress(url, f"Mapeando e tirando Print Screen (Nível {current_depth})")

        html = page.content()
        page_info = self.extract_page_elements(url, html)
        
        # Tira print screen da tela navegada
        screenshot_path = self.take_screenshot_and_snapshot(page, page_info["titulo"])
        page_info["screenshot"] = screenshot_path

        self.site_schema.append(page_info)

        clickables = page.query_selector_all("a, button, input[type='submit'], [role='menuitem']")
        targets = []
        for idx, el in enumerate(clickables):
            try:
                if not el.is_visible(): continue
                text = el.inner_text().strip() or el.get_attribute("value") or ""
                if not text or len(text) < 2 or any(x in text.lower() for x in ["sair", "logout", "excluir"]): continue
                href = el.get_attribute("href")
                if href and not self._is_url_allowed(urllib.parse.urljoin(url, href)): continue
                targets.append({"index": idx, "text": text})
            except Exception: pass

        for item in targets[:12]:
            if self.stop_check and self.stop_check():
                print('[🛑] Interrupção imediata solicitada pelo usuário.')
                break
            if len(self.visited_urls) >= self.max_pages: break
            try:
                elements = page.query_selector_all("a, button, input[type='submit'], [role='menuitem']")
                if item["index"] >= len(elements): continue
                el = elements[item["index"]]
                el.scroll_into_view_if_needed()
                time.sleep(0.3)
                
                self._update_progress(url, f"Clicando em '{item['text']}'")
                el.click(timeout=6000)
                page.wait_for_load_state("networkidle", timeout=6000)
                time.sleep(1.0)
                
                new_url = page.url
                if new_url != url:
                    transition = {
                        "de_url": url, "texto_clique": item["text"],
                        "seletor": f"text='{item['text']}'", "para_url": new_url,
                        "screenshot_path": screenshot_path
                    }
                    if transition not in self.transitions:
                        self.transitions.append(transition)
                        
                    if self._is_url_allowed(new_url) and new_url not in self.visited_urls:
                        self.analyze_by_clicking(page, current_depth + 1)
                        
                    page.goto(url, wait_until="networkidle")
                    time.sleep(1.0)
            except Exception:
                try: page.goto(url, wait_until="networkidle")
                except Exception: pass

    def run(self):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            context = browser.new_context(no_viewport=True if not self.headless else False)
            page = context.new_page()
            
            try:
                if self.login_config:
                    login_url = self.login_config.get("url", self.target_url)
                    self._update_progress(login_url, "Efetuando Login GETS")
                    page.goto(login_url, wait_until="networkidle")
                    
                    u_sel = self.login_config.get("username_selector", "input[name='j_username']")
                    p_sel = self.login_config.get("password_selector", "input[name='j_password']")
                    s_sel = self.login_config.get("submit_selector", "input[type='submit']")
                    
                    if page.query_selector(u_sel):
                        page.fill(u_sel, self.login_config.get("username", ""))
                        page.fill(p_sel, self.login_config.get("password", ""))
                        page.click(s_sel)
                        page.wait_for_load_state("networkidle")
                        time.sleep(1.5)

                if self.scan_mode == "clicking":
                    page.goto(self.target_url, wait_until="networkidle")
                    self.analyze_by_clicking(page)
                else:
                    current_url = self.target_url
                    page.goto(current_url, wait_until="networkidle")
                    self.visited_urls.add(page.url)
                    
                    html = page.content()
                    info = self.extract_page_elements(page.url, html)
                    screenshot_path = self.take_screenshot_and_snapshot(page, info["titulo"])
                    info["screenshot"] = screenshot_path
                    self.site_schema.append(info)
                    
                    count = 1
                    while self.menu_links and count < self.max_pages:
                        next_menu = self.menu_links.pop(0)
                        next_url = next_menu["url"]
                        if next_url in self.visited_urls: continue
                            
                        self.visited_urls.add(next_url)
                        self._update_progress(next_url, f"Acessando Submenu ({count}/{self.max_pages})")
                        
                        try:
                            page.goto(next_url, wait_until="networkidle", timeout=12000)
                            html = page.content()
                            page_info = self.extract_page_elements(next_url, html)
                            s_path = self.take_screenshot_and_snapshot(page, page_info["titulo"])
                            page_info["screenshot"] = s_path
                            
                            self.transitions.append({
                                "de_url": self.target_url,
                                "texto_clique": next_menu["texto"],
                                "seletor": f"a:has-text('{next_menu['texto']}')",
                                "para_url": next_url,
                                "screenshot_path": s_path
                            })
                            
                            self.site_schema.append(page_info)
                            count += 1
                            time.sleep(1.0)
                        except Exception: pass

                self._update_progress(self.target_url, "Mapeamento Visual Concluído com Sucesso!")
            except Exception as e:
                self._update_progress(self.target_url, f"Erro no mapeamento: {e}")
            finally:
                browser.close()
                
        return {
            "schema": self.site_schema,
            "transitions": self.transitions,
            "visited_urls": list(self.visited_urls)
        }
