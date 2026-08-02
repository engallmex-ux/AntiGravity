import os
import sys
import time
import json
import sqlite3
import urllib.parse
from bs4 import BeautifulSoup
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

class GETSOSQuerier:
    """
    Robô de Consulta de Alta Precisão do GETS (Modo 100% Somente Leitura / Read-Only).
    
    Permite:
    - Pesquisar Ordens de Serviço vinculadas a um Técnico/Solicitante específico (ex: 'Lucas').
    - Pesquisar equipamentos por Número de Série, TAG ou Patrimônio.
    - Gravar os resultados no banco de dados SQLite para Grafana.
    """
    def __init__(self, user, password, base_url="https://gets.ceb.unicamp.br/nec/", headless=True, progress_cb=None):
        self.user = user
        self.password = password
        self.base_url = base_url
        self.headless = headless
        self.progress_cb = progress_cb

    def _notify(self, msg):
        if self.progress_cb:
            self.progress_cb(msg)
        else:
            print(f"[🔍 GETS Querier] {msg}")

    def query_orders_by_person(self, target_name="Lucas", max_pages=3):
        results = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            context = browser.new_context()
            page = context.new_page()

            try:
                self._notify("Efetuando login no GETS...")
                page.goto(self.base_url, wait_until="networkidle")
                
                if page.query_selector("input[name='j_username']"):
                    page.fill("input[name='j_username']", self.user)
                    page.fill("input[name='j_password']", self.password)
                    page.click("input[type='submit']")
                    page.wait_for_load_state("networkidle")
                    time.sleep(1.0)

                pend_url = urllib.parse.urljoin(self.base_url, "view/pendencias/consulta.jsf")
                self._notify(f"Acessando consulta de pendências: {pend_url}")
                page.goto(pend_url, wait_until="networkidle")
                time.sleep(1.0)

                search_input = page.query_selector("input[type='text']")
                if search_input and target_name:
                    self._notify(f"Filtrando por: '{target_name}'")
                    search_input.fill(target_name)
                    page.keyboard.press("Enter")
                    page.wait_for_load_state("networkidle")
                    time.sleep(1.5)

                html = page.content()
                soup = BeautifulSoup(html, "html.parser")
                rows = soup.find_all("tr")
                
                for r in rows:
                    cols = [td.get_text().strip() for td in r.find_all("td")]
                    if len(cols) >= 3:
                        results.append({
                            "colunas": cols,
                            "linha_bruta": " | ".join(cols),
                            "pagina_url": page.url
                        })

                self._notify(f"Consulta concluída com sucesso! {len(results)} registros capturados.")
            except Exception as e:
                self._notify(f"Erro na consulta: {e}")
            finally:
                browser.close()

        return results
