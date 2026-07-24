import os
import sys
import json
import time
import urllib.parse
import re
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("[!] Erro: A biblioteca 'playwright' não está instalada.")
    print("    Por favor, instale-a rodando: .venv\\Scripts\\pip install playwright")
    print("    E execute o comando: .venv\\Scripts\\playwright install")
    sys.exit(1)

class SiteAnalyzer:
    def __init__(self, target_url, login_config=None, max_pages=15, headless=True, scan_mode="static"):
        self.target_url = target_url
        self.login_config = login_config or {}
        self.max_pages = max_pages
        self.headless = headless
        self.scan_mode = scan_mode
        self.transitions = []
        
        parsed_url = urllib.parse.urlparse(target_url)
        self.domain = parsed_url.netloc
        self.base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        self.visited_urls = set()
        self.site_schema = []
        self.menu_links = []

    def clean_filename(self, text):
        return re.sub(r'[\\/*?:"<>|]', "_", text)

    def _is_url_allowed(self, url):
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        return parsed.netloc == self.domain

    def extract_page_elements(self, page_url, html_content):
        """Extrai todos os elementos interativos (campos, botões, menus) do HTML."""
        soup = BeautifulSoup(html_content, "html.parser")
        
        page_info = {
            "url": page_url,
            "titulo": soup.title.string.strip() if soup.title else "Sem título",
            "mecanismos_busca": [],
            "menus_navegacao": [],
            "formularios": [],
            "botoes_soltos": []
        }
        
        # 1. Identificar Mecanismos de Busca
        for inp in soup.find_all("input"):
            inp_type = inp.get("type", "text").lower()
            inp_id = inp.get("id", "")
            inp_name = inp.get("name", "")
            inp_placeholder = inp.get("placeholder", "").lower()
            
            is_search = False
            for kw in ["busca", "search", "pesquisa", "filtrar", "filter"]:
                if kw in inp_id.lower() or kw in inp_name.lower() or kw in inp_placeholder:
                    is_search = True
                    break
            
            if is_search:
                page_info["mecanismos_busca"].append({
                    "id": inp_id,
                    "name": inp_name,
                    "placeholder": inp.get("placeholder", ""),
                    "selector": f"input#{inp_id}" if inp_id else f"input[name='{inp_name}']"
                })

        # 2. Identificar Links de Menus e Submenus
        for link in soup.find_all("a"):
            href = link.get("href")
            text = link.get_text().strip()
            
            if href and text and len(text) > 2:
                clean_href = href.split("#")[0]
                absolute_href = urllib.parse.urljoin(page_url, clean_href)
                
                is_menu = False
                for p in link.parents:
                    if p.name in ["nav", "aside", "header"]:
                        is_menu = True
                        break
                    classes = p.get("class", [])
                    if any(c in ["menu", "nav", "sidebar", "aside", "navigation", "submenu"] for c in classes):
                        is_menu = True
                        break
                
                if is_menu or len(text) < 30:
                    menu_item = {
                        "texto": text,
                        "url": absolute_href,
                        "href_original": href
                    }
                    if menu_item not in page_info["menus_navegacao"]:
                        page_info["menus_navegacao"].append(menu_item)
                        
                    if absolute_href.startswith(self.base_url) and absolute_href not in self.visited_urls:
                        if absolute_href not in [x["url"] for x in self.menu_links]:
                            self.menu_links.append(menu_item)

        # 3. Mapear Formulários e Caixas de Texto (Cadastro/Filtros)
        for form in soup.find_all("form"):
            form_info = {
                "id": form.get("id", ""),
                "action": form.get("action", ""),
                "method": form.get("method", "post").lower(),
                "campos": [],
                "botoes": []
            }
            
            for element in form.find_all(["input", "textarea", "select"]):
                el_name = element.get("name")
                if not el_name:
                    continue
                    
                el_id = element.get("id", "")
                el_type = element.get("type", element.name).lower()
                el_placeholder = element.get("placeholder", "")
                
                label_text = ""
                if el_id:
                    label_el = soup.find("label", {"for": el_id})
                    if label_el:
                        label_text = label_el.get_text().strip()
                if not label_text:
                    parent_label = element.find_parent("label")
                    if parent_label:
                        label_text = parent_label.get_text().strip()
                
                options = []
                if element.name == "select":
                    for opt in element.find_all("option"):
                        val = opt.get("value", "")
                        opt_text = opt.get_text().strip()
                        options.append({"value": val, "text": opt_text})

                form_info["campos"].append({
                    "id": el_id,
                    "name": el_name,
                    "tipo": el_type,
                    "label": label_text,
                    "placeholder": el_placeholder,
                    "opcoes": options if options else None,
                    "selector": f"{element.name}#{el_id}" if el_id else f"{element.name}[name='{el_name}']"
                })

            for btn in form.find_all(["button", "input"]):
                if btn.name == "input" and btn.get("type") not in ["submit", "button", "reset"]:
                    continue
                    
                btn_id = btn.get("id", "")
                btn_name = btn.get("name", "")
                btn_text = btn.get_text().strip() if btn.name == "button" else btn.get("value", "")
                btn_type = btn.get("type", "submit").lower()
                
                form_info["botoes"].append({
                    "id": btn_id,
                    "name": btn_name,
                    "texto": btn_text or btn_type,
                    "tipo": btn_type,
                    "selector": f"button#{btn_id}" if btn_id and btn.name == "button" else (
                        f"input#{btn_id}" if btn_id else (
                            f"button[name='{btn_name}']" if btn_name and btn.name == "button" else f"input[value='{btn_text}']"
                        )
                    )
                })
                
            page_info["formularios"].append(form_info)
            
        return page_info

    def generate_markdown_mindmap(self, output_file):
        """Gera um arquivo de relatório detalhado e mapa mental no formato Markdown."""
        lines = []
        lines.append(f"# 🧠 Mapa Mental Arquitetural: {self.domain}\n")
        lines.append(f"> **Mapeamento de Engenharia Reversa para Robôs de Automação**\n")
        lines.append(f"> **Data de Geração:** {time.strftime('%d/%m/%Y %H:%M:%S')}\n")
        lines.append(f"> **URL Alvo:** {self.target_url}\n")
        lines.append(f"> **Modo de Varredura:** {self.scan_mode.upper()}\n\n")
        
        # Adiciona a tabela de transições de rotas (Fluxo passo-a-passo)
        lines.append("## 🛣️ 1. Rastreamento de Fluxo de Navegação (De onde para onde?)\n")
        lines.append("Esta tabela mapeia as conexões dinâmicas do site (origem, ação de clique e destino):\n")
        lines.append("| De qual página (Origem) | Ação / Link Clicado | Seletor de Automação | Leva para onde (Destino) |")
        lines.append("| :--- | :--- | :--- | :--- |")
        if self.transitions:
            for t in self.transitions:
                de_path = urllib.parse.urlparse(t["de_url"]).path or "/"
                para_path = urllib.parse.urlparse(t["para_url"]).path or "/"
                lines.append(f"| `{de_path}` | **{t['texto_clique']}** | `{t['seletor']}` | `{para_path}` |")
        else:
            lines.append("| *Nenhuma transição de cliques registrada* | | | |")
        lines.append("\n\n---\n")

        lines.append("## 📈 2. Fluxograma da Arquitetura do Site (Mermaid)\n")
        lines.append("```mermaid\ngraph TD")
        lines.append("    classDef page fill:#9bf,stroke:#333,stroke-width:2px;")
        lines.append("    classDef form fill:#ffe26b,stroke:#333,stroke-width:2px;")
        
        for i, page in enumerate(self.site_schema):
            clean_title = self.clean_filename(page["titulo"])
            lines.append(f'    P{i}["📄 {clean_title}<br/>URL: {urllib.parse.urlparse(page["url"]).path}"]:::page')
            for f_idx, form in enumerate(page["formularios"]):
                form_id = form["id"] or f"Form_{f_idx}"
                lines.append(f'    P{i}F{f_idx}["📝 Form: {form_id}"]:::form')
                lines.append(f'    P{i} --> P{i}F{f_idx}')
                
        lines.append("```\n\n---\n")
        
        lines.append("## 📦 3. Detalhamento das Páginas, Campos e Seletores\n")
        
        for i, page in enumerate(self.site_schema):
            lines.append(f"### {i+1}. 📄 Página: {page['titulo']}\n")
            lines.append(f"- **URL de Acesso:** `{page['url']}`\n")
            
            if page["mecanismos_busca"]:
                lines.append("#### 🔍 Mecanismos de Busca / Filtros Identificados\n")
                lines.append("| Nome/ID | Seletor de Automação | Placeholder |")
                lines.append("| :--- | :--- | :--- |")
                for sb in page["mecanismos_busca"]:
                    lines.append(f"| `{sb['name'] or sb['id']}` | `{sb['selector']}` | \"{sb['placeholder']}\" |")
                lines.append("\n")
                
            if page["formularios"]:
                for f_idx, form in enumerate(page["formularios"]):
                    form_id = form["id"] or f"Formulário {f_idx+1}"
                    lines.append(f"#### 📝 Formulário: {form_id} (Método: `{form['method'].upper()}`)\n")
                    
                    if form["campos"]:
                        lines.append("##### 🔤 Caixas de Texto, Campos de Entrada e Cadastro\n")
                        lines.append("| Label/Campo | Tipo | Seletor do Campo | Placeholder |")
                        lines.append("| :--- | :--- | :--- | :--- |")
                        for campo in form["campos"]:
                            label = campo["label"] or campo["name"] or "Sem Rótulo"
                            lines.append(f"| **{label}** | `{campo['tipo']}` | `{campo['selector']}` | \"{campo['placeholder']}\" |")
                        lines.append("\n")
                        
                    if form["botoes"]:
                        lines.append("##### 🔘 Botões e Gatilhos de Ação\n")
                        lines.append("| Texto do Botão | Tipo | Seletor de Clique |")
                        lines.append("| :--- | :--- | :--- |")
                        for btn in form["botoes"]:
                            lines.append(f"| **{btn['texto']}** | `{btn['tipo']}` | `{btn['selector']}` |")
                        lines.append("\n")
            else:
                lines.append("*Nenhum formulário ou caixa de texto de cadastro identificada nesta página.*\n\n")
                
            if page["menus_navegacao"]:
                lines.append("#### 🔗 Links de Navegação / Menu Encontrados nesta Página\n")
                lines.append("| Texto do Link | URL Destino |")
                lines.append("| :--- | :--- |")
                for menu in page["menus_navegacao"][:10]:
                    lines.append(f"| {menu['texto']} | `{menu['url']}` |")
                if len(page["menus_navegacao"]) > 10:
                    lines.append(f"| *... e mais {len(page['menus_navegacao']) - 10} links* | |")
                lines.append("\n")
                
            lines.append("---\n")
            
        with open(output_file, "w", encoding="utf-8") as f:
            f.writelines("\n".join(lines))
        print(f"[✅] Relatório detalhado salvo em: {output_file}")

    def analyze_by_clicking(self, page, current_depth=0):
        """Simula o cursor clicando elemento por elemento e registrando transições de URL."""
        url = page.url
        if url in self.visited_urls or len(self.visited_urls) >= self.max_pages or current_depth > 2:
            return
            
        self.visited_urls.add(url)
        print(f"[+] Mapeando por cliques (Nível {current_depth}): {url}")
        
        # Extrai os elementos da página atual
        html = page.content()
        page_info = self.extract_page_elements(url, html)
        self.site_schema.append(page_info)
        
        # Encontra elementos clicáveis (links e botões)
        clickables = page.query_selector_all("a, button, [role='menuitem']")
        print(f"   [🔍] Encontrados {len(clickables)} elementos clicáveis em {url}")
        
        targets = []
        for idx, el in enumerate(clickables):
            try:
                if not el.is_visible():
                    continue
                text = el.inner_text().strip()
                if not text or len(text) < 2:
                    continue
                # Ignora ações de logout
                if any(x in text.lower() for x in ["sair", "logout", "excluir", "deletar"]):
                    continue
                href = el.get_attribute("href")
                if href:
                    abs_href = urllib.parse.urljoin(url, href)
                    if not self._is_url_allowed(abs_href):
                        continue
                
                targets.append({"index": idx, "text": text, "href": href})
            except Exception:
                pass
                
        for item in targets[:15]: # Limita cliques por página para performance
            try:
                elements = page.query_selector_all("a, button, [role='menuitem']")
                if item["index"] >= len(elements):
                    continue
                el = elements[item["index"]]
                
                el.scroll_into_view_if_needed()
                time.sleep(0.3)
                print(f"      [🖱️] Clicando em '{item['text']}'...")
                el.click(timeout=8000)
                page.wait_for_load_state("networkidle", timeout=8000)
                time.sleep(1.5)
                
                new_url = page.url
                if new_url != url:
                    print(f"      [➡️] Navegou para: {new_url}")
                    transition = {
                        "de_url": url,
                        "texto_clique": item["text"],
                        "seletor": f"xpath=(//a|//button|//*[@role='menuitem'])[{item['index']+1}]",
                        "para_url": new_url
                    }
                    if transition not in self.transitions:
                        self.transitions.append(transition)
                        
                    # Recursão se for do mesmo domínio
                    if self._is_url_allowed(new_url) and new_url not in self.visited_urls:
                        self.analyze_by_clicking(page, current_depth + 1)
                        
                    # Volta para a página original
                    page.goto(url, wait_until="networkidle")
                    time.sleep(1.5)
            except Exception as e:
                try:
                    page.goto(url, wait_until="networkidle")
                except Exception:
                    pass

    def analyze(self):
        print(f"[+] Iniciando investigação Playwright em: {self.target_url}")
        print(f"[+] Modo de Varredura: {self.scan_mode.upper()}")
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            context = browser.new_context(no_viewport=True)
            page = context.new_page()
            
            try:
                if self.login_config:
                    login_url = self.login_config.get("url", self.target_url)
                    print(f"[+] Efetuando login em: {login_url}")
                    page.goto(login_url, wait_until="networkidle")
                    
                    user_sel = self.login_config.get("username_selector")
                    pass_sel = self.login_config.get("password_selector")
                    submit_sel = self.login_config.get("submit_selector")
                    user_val = self.login_config.get("username")
                    pass_val = self.login_config.get("password")
                    
                    if user_sel and pass_sel and submit_sel:
                        page.fill(user_sel, user_val)
                        page.fill(pass_sel, pass_val)
                        page.click(submit_sel)
                        page.wait_for_load_state("networkidle")
                        time.sleep(2)
                        print("   [✓] Login efetuado com sucesso!")
                
                if self.scan_mode == "clicking":
                    page.goto(self.target_url, wait_until="networkidle")
                    self.analyze_by_clicking(page)
                else:
                    # Mapeador estático clássico
                    current_url = page.url
                    self.visited_urls.add(current_url)
                    print(f"[+] Mapeando página: {current_url}")
                    page.goto(self.target_url, wait_until="networkidle")
                    html = page.content()
                    page_info = self.extract_page_elements(self.target_url, html)
                    self.site_schema.append(page_info)
                    
                    count = 1
                    while self.menu_links and count < self.max_pages:
                        next_menu = self.menu_links.pop(0)
                        next_url = next_menu["url"]
                        
                        if next_url in self.visited_urls:
                            continue
                            
                        self.visited_urls.add(next_url)
                        print(f"[+] Acessando submenu ({count}/{self.max_pages}): {next_menu['texto']} -> {next_url}")
                        
                        try:
                            self.transitions.append({
                                "de_url": self.target_url,
                                "texto_clique": next_menu["texto"],
                                "seletor": f"a:has-text('{next_menu['texto']}')",
                                "para_url": next_url
                            })
                            page.goto(next_url, wait_until="networkidle", timeout=15000)
                            html = page.content()
                            info = self.extract_page_elements(next_url, html)
                            self.site_schema.append(info)
                            count += 1
                            time.sleep(1)
                        except Exception as e:
                            print(f"   [⚠️] Falha ao acessar {next_url}: {e}")
                            
            except Exception as e:
                print(f"   [❌] Falha crítica na análise do site: {e}")
            finally:
                browser.close()
                
        return self.site_schema

def run_analysis_from_config(config_filepath):
    if not os.path.exists(config_filepath):
        print(f"❌ Arquivo de configuração não encontrado: {config_filepath}")
        return
        
    with open(config_filepath, "r", encoding="utf-8") as f:
        config = json.load(f)
        
    target_url = config.get("target_url")
    login_config = config.get("login")
    max_pages = config.get("max_pages", 10)
    scan_mode = config.get("scan_mode", "static")
    
    analyzer = SiteAnalyzer(target_url, login_config, max_pages, scan_mode=scan_mode)
    schema = analyzer.analyze()
    
    domain_clean = analyzer.domain.replace(".", "_")
    json_output = f"{domain_clean}_schema.json"
    md_output = f"mapa_mental_{domain_clean}.md"
    
    with open(json_output, "w", encoding="utf-8") as f:
        json.dump(schema, f, ensure_ascii=False, indent=2)
        
    print(f"\n[OK] Varredura do site concluída!")
    print(f"     Schema JSON salvo em: {json_output}")
    analyzer.generate_markdown_mindmap(md_output)

if __name__ == "__main__":
    config_file = "analysis_config.json"
    if len(sys.argv) > 1:
        config_file = sys.argv[1]
    run_analysis_from_config(config_file)
