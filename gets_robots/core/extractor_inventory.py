import os
import sys
import time
import json
import urllib.parse
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

def extract_master_inventory(user, password, base_url="https://gets.ceb.unicamp.br/nec/", db_path=None, headless=True, progress_cb=None):
    """
    Extrai o Inventário Master Completo de Equipamentos/Ativos do Hospital no GETS.
    """
    inventory_items = []
    
    def _notify(msg):
        if progress_cb:
            progress_cb(msg)
        else:
            print(f"[📦 GETS MasterInventory] {msg}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()

        try:
            _notify("Efetuando login para extração do Inventário Master...")
            page.goto(base_url, wait_until="networkidle")

            if page.query_selector("input[name='j_username']"):
                page.fill("input[name='j_username']", user)
                page.fill("input[name='j_password']", password)
                page.click("input[type='submit']")
                page.wait_for_load_state("networkidle")

            # Navega para o Cadastro/Consulta de Equipamentos
            inventario_url = urllib.parse.urljoin(base_url, "view/equipamentos/consulta.jsf")
            _notify(f"Acessando consulta de inventário: {inventario_url}")
            page.goto(inventario_url, wait_until="networkidle")

            # Clica em Pesquisar sem filtros para carregar todos os equipamentos
            search_btn = page.query_selector("input[value*='Pesquisar'], button:has-text('Pesquisar'), input[type='submit']")
            if search_btn:
                search_btn.click()
                page.wait_for_load_state("networkidle")
                time.sleep(2.0)

            # Processa as páginas do inventário
            page_count = 1
            while True:
                _notify(f"Extraindo página {page_count} do Inventário Master...")
                html = page.content()
                soup = BeautifulSoup(html, "html.parser")

                rows = soup.find_all("tr")
                page_items = 0
                for r in rows:
                    cols = [c.get_text().strip() for c in r.find_all(["td", "th"])]
                    if cols and len(cols) >= 4 and not cols[0].lower().startswith("patrim"):
                        item = {
                            "patrimonio": cols[0],
                            "tag_setor": cols[1] if len(cols) > 1 else "",
                            "nome": cols[2] if len(cols) > 2 else "",
                            "marca_modelo": cols[3] if len(cols) > 3 else "",
                            "localizacao": cols[4] if len(cols) > 4 else ""
                        }
                        inventory_items.append(item)
                        page_items += 1

                _notify(f"Página {page_count}: {page_items} ativos capturados.")

                next_btn = page.query_selector("a:has-text('Próximo'), input[value='>']")
                if next_btn and next_btn.is_visible() and page_count < 50:
                    next_btn.click()
                    page.wait_for_load_state("networkidle")
                    page_count += 1
                    time.sleep(1.0)
                else:
                    break

        except Exception as e:
            _notify(f"Erro na extração de inventário: {e}")
        finally:
            browser.close()

    _notify(f"Inventário Master concluído! Total de {len(inventory_items)} equipamentos mapeados.")
    return inventory_items
