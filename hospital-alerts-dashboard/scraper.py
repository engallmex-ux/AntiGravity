import os
import json
import time
import requests
from playwright.sync_api import sync_playwright

# Configurações do Portal
PORTAL_URL = "http://127.0.0.1:5000/mock-portal"  # Mudar para a URL real: https://gets.ceb.unicamp.br/nec/view/pendencias/consulta.jsf
ORDERS_FILE = "orders.json"

# Seletor da tabela de Ordens de Serviço (ajustar conforme o portal real)
TABLE_SELECTOR = "table#osTable"
ROW_SELECTOR = "table#osTable tbody tr"

def send_whatsapp_alert(order):
    """
    Função simulada para enviar alertas de WhatsApp.
    Em produção, você pode integrar com Twilio ou outra API de envio.
    """
    message = (
        f"🚨 *NOVA ORDEM DE SERVIÇO DETECTADA!* 🚨\n\n"
        f"📄 *OS:* {order['id']}\n"
        f"📍 *Local:* {order['local']}\n"
        f"🔧 *Equipamento:* {order['equipamento']}\n"
        f"⚠️ *Problema:* {order['problema']}\n"
        f"🕒 *Abertura:* {order['data_hora']}\n"
        f"⚡ *Urgência:* {order['urgencia']}\n"
        f"📌 *Status:* {order['status']}"
    )
    print(f"\n[ALERT] Enviando WhatsApp:\n{message}\n")
    
    # Exemplo de requisição real para webhook de WhatsApp
    # try:
    #     requests.post("https://api.twilio.com/...", json={"to": "+55...", "message": message})
    # except Exception as e:
    #     print("Erro ao enviar alerta real:", e)

def load_stored_orders():
    if os.path.exists(ORDERS_FILE):
        try:
            with open(ORDERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_orders(orders):
    with open(ORDERS_FILE, "w", encoding="utf-8") as f:
        json.dump(orders, f, ensure_ascii=False, indent=4)

def run_scraper(headless=True):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Iniciando varredura no portal...")
    stored_orders = load_stored_orders()
    stored_ids = {order["id"] for order in stored_orders}
    
    new_orders_found = []
    
    with sync_playwright() as p:
        # Abrir navegador
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        
        try:
            # Acessar a página
            page.goto(PORTAL_URL, timeout=30000)
            
            # Se for o portal real, podemos adicionar etapas de login aqui:
            # if "login" in page.url:
            #     page.fill("input#username", "usuario_teste")
            #     page.fill("input#password", "senha_teste")
            #     page.click("button#login-btn")
            #     page.wait_for_load_state("networkidle")
            
            # Aguardar a tabela carregar
            page.wait_for_selector(ROW_SELECTOR, timeout=5000)
            
            # Capturar linhas da tabela
            rows = page.query_selector_all(ROW_SELECTOR)
            
            current_orders = []
            for row in rows:
                cols = row.query_selector_all("td")
                if len(cols) >= 7:
                    os_id = cols[0].inner_text().strip()
                    local = cols[1].inner_text().strip()
                    equipamento = cols[2].inner_text().strip()
                    problema = cols[3].inner_text().strip()
                    data_hora = cols[4].inner_text().strip()
                    urgencia = cols[5].inner_text().strip()
                    status = cols[6].inner_text().strip()
                    
                    order_data = {
                        "id": os_id,
                        "local": local,
                        "equipamento": equipamento,
                        "problema": problema,
                        "data_hora": data_hora,
                        "urgencia": urgencia,
                        "status": status
                    }
                    current_orders.append(order_data)
                    
                    # Se for uma nova OS, dispara o alerta
                    if os_id not in stored_ids:
                        new_orders_found.append(order_data)
            
            # Atualiza o arquivo local
            # Mantemos as ordens existentes e colocamos as novas no topo
            updated_orders = new_orders_found + [o for o in stored_orders if o["id"] not in {x["id"] for x in new_orders_found}]
            
            # Limitar a 100 ordens na memória para fins de teste
            save_orders(updated_orders[:100])
            
            # Disparar alertas para novas OS
            for new_order in reversed(new_orders_found): # Enviar da mais antiga para a mais recente
                send_whatsapp_alert(new_order)
                
            print(f"Varredura concluída. Encontradas {len(new_orders_found)} novas ordens de serviço.")
            
        except Exception as e:
            print("Erro durante a execução do scraper:", e)
        finally:
            browser.close()

if __name__ == "__main__":
    # Quando rodar diretamente, executa uma varredura de teste
    # Usaremos headless=True em background
    run_scraper(headless=True)
