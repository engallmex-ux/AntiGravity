import os
import sys
import json
import sqlite3
import urllib.parse
import time
from playwright.sync_api import sync_playwright

STATUS_SIGLAS = {
    "SOS": "Solicitação de Ordem de Serviço",
    "OSP": "OS Pronta",
    "EE": "Em Execução",
    "AE": "Aguardando Execução",
    "AEE": "Aguardando Envio de Equipamento",
    "AM": "Aquisição de Material",
    "EA": "Em Análise",
    "EP": "Em Parecer",
    "ARE": "Aguardando Retirada de Equipamento",
    "ANF": "Aguardando Nota Fiscal",
    "ACE": "Aguardando Conserto Externo",
}

def extract_gets_orders(user, password, base_url, db_path, headless=True, max_pages=5, progress_cb=None):
    results = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        
        try:
            if progress_cb:
                progress_cb(1, max_pages, "Efetuando Login no GETS...")
                
            page.goto(base_url, wait_until="networkidle")
            page.fill("input[name='j_username']", user)
            page.fill("input[name='j_password']", password)
            page.click("input[type='submit']")
            page.wait_for_load_state("networkidle")
            
            pendencias_url = urllib.parse.urljoin(base_url, "view/pendencias/consulta.jsf")
            page.goto(pendencias_url, wait_until="networkidle")
            
            for current_p in range(1, max_pages + 1):
                if progress_cb:
                    progress_cb(current_p, max_pages, f"Extraindo página {current_p} de OS...")
                
                rows = page.query_selector_all("table tr")
                for r in rows:
                    txt = r.inner_text().strip()
                    if "Aberta em" in txt or any(s in txt for s in STATUS_SIGLAS.keys()):
                        results.append({"raw_text": txt, "pagina": current_p})
                        
                next_btn = page.query_selector("a:has-text('Próximo'), input[value='>']")
                if next_btn and next_btn.is_visible():
                    next_btn.click()
                    page.wait_for_load_state("networkidle")
                    time.sleep(1.0)
                else:
                    break
                    
        except Exception as e:
            print(f"Erro durante extração de OS: {e}")
        finally:
            browser.close()
            
    return results
