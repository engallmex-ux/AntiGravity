import os
import sys
import json
import urllib.parse
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

class FormCopier:
    def __init__(self, target_url, login_config=None, headless=True):
        self.target_url = target_url
        self.login_config = login_config or {}
        self.headless = headless
        
        parsed = urllib.parse.urlparse(target_url)
        self.domain = parsed.netloc

    def extract_forms(self):
        """Acessa o site via Playwright e mapeia a estrutura de formulários."""
        print(f"[FormCopier] Acessando {self.target_url}...")
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            context = browser.new_context(no_viewport=True)
            page = context.new_page()
            
            try:
                # 1. Login se configurado
                if self.login_config:
                    login_url = self.login_config.get("url", self.target_url)
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
                        print("[FormCopier] Login efetuado com sucesso!")
                
                # 2. Mapeia a página principal do formulário
                page.goto(self.target_url, wait_until="networkidle")
                html = page.content()
                soup = BeautifulSoup(html, "html.parser")
                
                cloned_forms = []
                
                # Extrai dados de cada form
                for form in soup.find_all("form"):
                    form_info = {
                        "form_id": form.get("id", ""),
                        "action": form.get("action", ""),
                        "method": form.get("method", "post").lower(),
                        "campos": []
                    }
                    
                    # Mapeia os inputs, selects e textareas
                    for element in form.find_all(["input", "textarea", "select"]):
                        el_name = element.get("name")
                        if not el_name:
                            continue
                            
                        el_id = element.get("id", "")
                        el_type = element.get("type", element.name).lower()
                        el_placeholder = element.get("placeholder", "")
                        
                        # Label correspondente
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
                                text = opt.get_text().strip()
                                options.append({"value": val, "text": text})
                                
                        form_info["campos"].append({
                            "id": el_id,
                            "name": el_name,
                            "tipo": el_type,
                            "label": label_text or el_name,
                            "placeholder": el_placeholder,
                            "opcoes": options if options else None,
                            "selector": f"{element.name}#{el_id}" if el_id else f"{element.name}[name='{el_name}']"
                        })
                        
                    cloned_forms.append(form_info)
                
                return {
                    "site_nome": self.domain,
                    "url": self.target_url,
                    "campos_schema": json.dumps(cloned_forms, ensure_ascii=False),
                    "layout_html": html[:100000] # Limita tamanho do HTML guardado
                }
                
            except Exception as e:
                print(f"[FormCopier] Erro na extração: {e}")
                return None
            finally:
                browser.close()
