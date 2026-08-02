import os
import sys
import time
import urllib.parse
from playwright.sync_api import sync_playwright

class GETSOrderCreator:
    """
    Robô de Abertura Automatizada de Ordens de Serviço (Chamados Corretivos) no GETS.
    Baseado no procedimento oficial do manual EBSERH / UFF / CEB Unicamp.
    """
    def __init__(self, user, password, base_url, headless=True, progress_cb=None):
        self.user = user
        self.password = password
        self.base_url = base_url
        self.headless = headless
        self.progress_cb = progress_cb

    def _notify(self, msg):
        if self.progress_cb:
            self.progress_cb(msg)
        else:
            print(f"[🤖 GETS OrderCreator] {msg}")

    def create_order(self, order_data):
        """
        order_data dict esperado:
        - solicitante: str
        - telefone: str
        - com_identificacao: bool (default True)
        - identificador_equipamento: str (patrimônio / TAG / ID / Série)
        - localizacao_tipo: str ('US' ou 'NEC')
        - situacao_equipamento: str ('Parado' ou 'Em Uso Parcial/Normal')
        - localizacao_fisica: str (ex: '4º ANDAR')
        - prioridade: str ('Normal', 'Urgente', 'Baixa')
        - responsavel: str (nome da pessoa no local)
        - sintomas: list[str] (ex: ['ALARME', 'BATERIA'])
        - informacoes_adicionais: str
        """
        result = {"success": False, "os_number": None, "error": None}

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            page = browser.new_page()

            try:
                self._notify("Acessando portal GETS e efetuando login...")
                page.goto(self.base_url, wait_until="networkidle")
                
                # Login
                if page.query_selector("input[name='j_username']"):
                    page.fill("input[name='j_username']", self.user)
                    page.fill("input[name='j_password']", self.password)
                    page.click("input[type='submit']")
                    page.wait_for_load_state("networkidle")
                    time.sleep(1.5)

                # Navegar para Solicitações -> Abertura de OS
                self._notify("Navegando para 'Solicitações' -> 'Abertura de OS'...")
                solicitacoes_url = urllib.parse.urljoin(self.base_url, "view/solicitacoes/abertura.jsf")
                page.goto(solicitacoes_url, wait_until="networkidle")

                # Preencher Solicitante e Telefone
                self._notify("Preenchendo Solicitante e Ramal/Telefone...")
                if order_data.get("solicitante"):
                    page.fill("input[id*='solicitante'], input[name*='solicitante']", order_data["solicitante"])
                if order_data.get("telefone"):
                    page.fill("input[id*='telefone'], input[name*='telefone']", order_data["telefone"])

                # Busca por Identificador / Patrimônio
                ident = order_data.get("identificador_equipamento")
                if ident:
                    self._notify(f"Pesquisando equipamento pelo identificador: {ident}...")
                    search_field = page.query_selector("input[id*='equipamento'], input[placeholder*='Identificador']")
                    if search_field:
                        search_field.fill(ident)
                        time.sleep(1.0)
                        # Seleciona primeira opção do autocompletar JSF
                        suggestion = page.query_selector(".ui-autocomplete-item, div[id*='equipamento'] li")
                        if suggestion:
                            suggestion.click()
                            time.sleep(1.0)

                # Localização do Equipamento (US vs NEC)
                if order_data.get("localizacao_tipo") == "NEC":
                    nec_radio = page.query_selector("input[value='NEC']")
                    if nec_radio: nec_radio.click()
                else:
                    us_radio = page.query_selector("input[value='US']")
                    if us_radio: us_radio.click()

                # Situação do Equipamento (Parado vs Em Uso)
                if order_data.get("situacao_equipamento") == "Parado":
                    parado_radio = page.query_selector("input[value='Parado']")
                    if parado_radio: parado_radio.click()

                # Localização Física
                if order_data.get("localizacao_fisica"):
                    page.fill("input[id*='localizacaoFisica'], input[name*='localizacao']", order_data["localizacao_fisica"])

                # Prioridade
                prio = order_data.get("prioridade", "Normal")
                page.select_option("select[id*='prioridade']", label=prio)

                # Responsável
                if order_data.get("responsavel"):
                    page.fill("input[id*='responsavel']", order_data["responsavel"])

                # Sintomas (Seleção múltipla)
                sintomas = order_data.get("sintomas", [])
                if sintomas:
                    for sint in sintomas:
                        page.select_option("select[id*='sintomas']", label=sint)

                # Informações Adicionais
                if order_data.get("informacoes_adicionais"):
                    page.fill("textarea[id*='informacoes'], textarea[name*='info']", order_data["informacoes_adicionais"])

                # Botão Solicitar Abertura OS
                self._notify("Enviando formulário de Abertura de OS...")
                submit_btn = page.query_selector("input[value='Solicitar Abertura OS'], button:has-text('Solicitar Abertura OS')")
                if submit_btn:
                    submit_btn.click()
                    page.wait_for_load_state("networkidle")
                    time.sleep(2.0)

                # Captura mensagem de sucesso/número da OS
                content = page.content()
                if "Manutenção Corretiva Aberta com Sucesso" in content:
                    import re
                    match = re.search(r'número é:\s*(\d{2}\.\d+)', content)
                    os_num = match.group(1) if match else "Aberta com Sucesso"
                    result["success"] = True
                    result["os_number"] = os_num
                    self._notify(f"✅ Sucesso! Ordem de Serviço Gerada: {os_num}")
                else:
                    result["error"] = "Não foi possível confirmar o número da OS no retorno do sistema."
                    self._notify(f"⚠️ Atenção: {result['error']}")

            except Exception as e:
                result["error"] = str(e)
                self._notify(f"❌ Erro na Abertura de OS: {e}")
            finally:
                browser.close()

        return result
