import os
import json
import random
import time
import subprocess
from datetime import datetime
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__)

# Configurações do ambiente de trabalho
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ORDERS_FILE = os.path.join(BASE_DIR, "orders.json")
MOCK_PORTAL_FILE = os.path.join(BASE_DIR, "mock_portal.html")
SCRAPER_SCRIPT = os.path.join(BASE_DIR, "scraper.py")

# Lista de notificações enviadas em memória
whatsapp_logs = []

def init_files():
    # Garantir que a lista de OS padrão seja criada se não existir
    if not os.path.exists(ORDERS_FILE):
        default_orders = [
            {
                "id": "OS-2026-1042",
                "local": "U.T.I. Adulto - Leito 08",
                "equipamento": "Monitor Multiparamétrico",
                "problema": "Tela piscando e perda de comunicação com a central",
                "data_hora": "05/07/2026 19:10",
                "urgencia": "ALTA",
                "status": "Pendente"
            },
            {
                "id": "OS-2026-1043",
                "local": "Pronto Socorro - Triagem",
                "equipamento": "Esfigmomanômetro Digital",
                "problema": "Erro de calibração na braçadeira",
                "data_hora": "05/07/2026 19:25",
                "urgencia": "BAIXA",
                "status": "Em Andamento"
            },
            {
                "id": "OS-2026-1044",
                "local": "Centro Cirúrgico - Sala 3",
                "equipamento": "Bisturi Elétrico",
                "problema": "Cabo de placa dispersiva rompido",
                "data_hora": "05/07/2026 19:38",
                "urgencia": "ALTA",
                "status": "Pendente"
            }
        ]
        with open(ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(default_orders, f, ensure_ascii=False, indent=4)

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/styles.css')
def styles():
    return send_from_directory(BASE_DIR, 'styles.css')

@app.route('/app.js')
def app_js():
    return send_from_directory(BASE_DIR, 'app.js')

@app.route('/mock-portal')
def mock_portal():
    return send_from_directory(BASE_DIR, 'mock_portal.html')

@app.route('/api/orders', methods=['GET'])
def get_orders():
    if os.path.exists(ORDERS_FILE):
        try:
            with open(ORDERS_FILE, "r", encoding="utf-8") as f:
                orders = json.load(f)
            return jsonify(orders)
        except Exception:
            return jsonify([])
    return jsonify([])

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    return jsonify(whatsapp_logs)

@app.route('/api/simulate', methods=['POST'])
def simulate():
    """
    Simula uma nova ordem de serviço editando diretamente o mock_portal.html
    """
    try:
        with open(MOCK_PORTAL_FILE, "r", encoding="utf-8") as f:
            html = f.read()
            
        soup = BeautifulSoup(html, "html.parser")
        tbody = soup.find("tbody")
        
        setores = ["Pediatria", "Maternidade", "Hemodiálise", "U.T.I. Cardio", "Emergência", "Raio-X", "Almoxarifado"]
        equipamentos = ["Bomba de Infusão", "Ventilador Pulmonar", "Desfibrilador", "Eletrocardiógrafo", "Oxímetro de Pulso", "Aspirador Cirúrgico"]
        problemas = ["Fluxo obstruído constantemente", "Falha no ciclo inspiratório", "Bateria não segura carga", "Ruído excessivo no traçado", "Sensor com mau contato", "Não liga"]
        
        random_os = f"OS-2026-{random.randint(1000, 9999)}"
        random_setor = random.choice(setores)
        random_equip = random.choice(equipamentos)
        random_prob = random.choice(problemas)
        data_str = datetime.now().strftime("%d/%m/%Y %H:%M")
        
        new_tr = soup.new_tag("tr")
        
        td1 = soup.new_tag("td")
        td1.string = random_os
        new_tr.append(td1)
        
        td2 = soup.new_tag("td")
        td2.string = random_setor
        new_tr.append(td2)
        
        td3 = soup.new_tag("td")
        td3.string = random_equip
        new_tr.append(td3)
        
        td4 = soup.new_tag("td")
        td4.string = random_prob
        new_tr.append(td4)
        
        td5 = soup.new_tag("td")
        td5.string = data_str
        new_tr.append(td5)
        
        td6 = soup.new_tag("td")
        badge_urg = soup.new_tag("span", attrs={"class": "badge badge-high"})
        badge_urg.string = "ALTA"
        td6.append(badge_urg)
        new_tr.append(td6)
        
        td7 = soup.new_tag("td")
        badge_status = soup.new_tag("span", attrs={"class": "badge badge-pending"})
        badge_status.string = "Pendente"
        td7.append(badge_status)
        new_tr.append(td7)
        
        # Insere a nova linha no topo do tbody
        if tbody:
            tbody.insert(0, new_tr)
            
        with open(MOCK_PORTAL_FILE, "w", encoding="utf-8") as f:
            f.write(str(soup))
            
        return jsonify({"status": "success", "message": f"Ordem {random_os} adicionada ao mock_portal.html"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/scan', methods=['POST'])
def scan():
    """
    Roda o script de scraping em background usando o executável python correto
    e captura os logs para capturar o alerta enviado.
    """
    python_exe = r"C:\Users\Holter\AppData\Local\Programs\Python\Python312\python.exe"
    
    try:
        # Configurar variáveis de ambiente para forçar UTF-8 na saída do python filho
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        
        # Executa o script de raspagem
        result = subprocess.run(
            [python_exe, SCRAPER_SCRIPT],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore',
            env=env
        )
        
        # Parsear a saída padrão para registrar os alertas de WhatsApp
        output = result.stdout
        if "[ALERT] Enviando WhatsApp:" in output:
            parts = output.split("[ALERT] Enviando WhatsApp:")
            for part in parts[1:]:
                message = part.strip().split("\n\n")[0] # Captura o bloco da mensagem
                
                # Evitar duplicados no log de sessão
                if not any(log["message"] == message for log in whatsapp_logs):
                    whatsapp_logs.insert(0, {
                        "timestamp": time.time(),
                        "message": message
                    })
        
        return jsonify({
            "status": "success",
            "stdout": result.stdout,
            "stderr": result.stderr
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    init_files()
    print("Iniciando Servidor BioAlert local...")
    print("Painel de Controle: http://127.0.0.1:5000/")
    print("Portal do Hospital (Simulado): http://127.0.0.1:5000/mock-portal")
    app.run(host='127.0.0.1', port=5000, debug=False)
