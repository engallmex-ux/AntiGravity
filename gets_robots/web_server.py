import os
import sys
import json
import threading
import time
import sqlite3
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from gets_robots.config import GETS_BASE_URL, GETS_USER, GETS_PASS, HISTORY_FILE, DB_FILE
from gets_robots.core.crawler import GETSNavCrawler
from gets_robots.core.querier_os import GETSOSQuerier
from gets_robots.exports.database import init_db

ROBOT_STATE = {
    "running": False,
    "stop_requested": False,
    "visited": 0,
    "total": 0,
    "percentage": 0.0,
    "current_url": "",
    "status": "Inativo (Aguardando início...)",
    "log_line": ""
}

class GETSWebHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/status":
            self.send_json(ROBOT_STATE)
        elif path == "/" or path == "/index.html":
            self.serve_file(os.path.join(os.path.dirname(__file__), "web", "index.html"), "text/html")
        elif path.startswith("/screenshots/"):
            file_p = os.path.join(os.path.dirname(__file__), path[1:])
            self.serve_file(file_p, "image/png")
        elif path.startswith("/web/"):
            file_p = os.path.join(os.path.dirname(__file__), path[1:])
            mime = "text/css" if path.endswith(".css") else ("application/javascript" if path.endswith(".js") else "text/plain")
            self.serve_file(file_p, mime)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        data = json.loads(body) if body else {}

        if parsed.path == "/api/mapper/start":
            if not ROBOT_STATE["running"]:
                ROBOT_STATE["stop_requested"] = False
                threading.Thread(target=run_crawler_bg, args=(data,)).start()
                self.send_json({"status": "started"})
            else:
                self.send_json({"status": "already_running"})

        elif parsed.path == "/api/mapper/stop":
            ROBOT_STATE["stop_requested"] = True
            ROBOT_STATE["running"] = False
            ROBOT_STATE["status"] = "Interrompido pelo Usuário"
            ROBOT_STATE["log_line"] = "[🛑] Robô interrompido pelo usuário. Navegador encerrado."
            self.send_json({"status": "stopped"})

        elif parsed.path == "/api/robot/run":
            robot_id = data.get("robot_id", "01")
            if not ROBOT_STATE["running"]:
                ROBOT_STATE["stop_requested"] = False
                threading.Thread(target=run_robot_single_real_bg, args=(robot_id,)).start()
                self.send_json({"status": "started", "robot": robot_id})
            else:
                self.send_json({"status": "already_running"})

    def serve_file(self, filepath, content_type):
        if os.path.exists(filepath):
            self.send_response(200)
            self.send_header("Content-Type", f"{content_type}; charset=utf-8")
            self.end_headers()
            with open(filepath, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "File Not Found")

    def send_json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

def run_robot_single_real_bg(robot_id):
    """Dispara a execução REAL do Playwright para o robô selecionado."""
    ROBOT_STATE["running"] = True
    ROBOT_STATE["status"] = f"Executando Robô {robot_id} no Chrome Real..."
    ROBOT_STATE["log_line"] = f"[🤖 Playwright Real] Disparando navegação do Robô {robot_id}..."

    def on_progress(p_data):
        ROBOT_STATE["visited"] = p_data["visited"]
        ROBOT_STATE["total"] = p_data["total"]
        ROBOT_STATE["percentage"] = p_data["percentage"]
        ROBOT_STATE["current_url"] = p_data["current_url"]
        ROBOT_STATE["status"] = p_data["status"]
        ROBOT_STATE["log_line"] = f"[{p_data['percentage']:.1f}%] {p_data['status']}: {p_data['current_url']}"

    def check_stop():
        return ROBOT_STATE["stop_requested"]

    crawler = GETSNavCrawler(
        target_url=GETS_BASE_URL,
        login_config={
            "url": GETS_BASE_URL,
            "username": GETS_USER,
            "password": GETS_PASS
        },
        max_pages=5,
        headless=False, # Abre o Chrome VISÍVEL na tela do usuário!
        scan_mode="clicking",
        progress_callback=on_progress,
        stop_check=check_stop
    )

    try:
        crawler.run()
        ROBOT_STATE["log_line"] = f"[✅ Sucesso] Robô {robot_id} finalizou e salvou os Print Screens na pasta screenshots/!"
    except Exception as e:
        ROBOT_STATE["status"] = f"Erro no Robô {robot_id}: {e}"
    finally:
        ROBOT_STATE["running"] = False
        ROBOT_STATE["status"] = "Concluído"

def run_crawler_bg(config_data):
    ROBOT_STATE["running"] = True
    ROBOT_STATE["status"] = "Iniciando Mapeamento Cartográfico..."

    def on_progress(p_data):
        ROBOT_STATE["visited"] = p_data["visited"]
        ROBOT_STATE["total"] = p_data["total"]
        ROBOT_STATE["percentage"] = p_data["percentage"]
        ROBOT_STATE["current_url"] = p_data["current_url"]
        ROBOT_STATE["status"] = p_data["status"]
        ROBOT_STATE["log_line"] = f"[{p_data['percentage']:.1f}%] {p_data['status']}: {p_data['current_url']}"

    def check_stop():
        return ROBOT_STATE["stop_requested"]

    max_p = config_data.get("max_pages", 8)
    if max_p == 0: max_p = 9999

    crawler = GETSNavCrawler(
        target_url=config_data.get("target_url", GETS_BASE_URL),
        login_config={
            "url": config_data.get("target_url", GETS_BASE_URL),
            "username": config_data.get("username", GETS_USER),
            "password": config_data.get("password", GETS_PASS)
        },
        max_pages=max_p,
        headless=config_data.get("headless", True),
        scan_mode=config_data.get("scan_mode", "clicking"),
        progress_callback=on_progress,
        stop_check=check_stop
    )

    try:
        crawler.run()
    except Exception as e:
        ROBOT_STATE["status"] = f"Erro: {e}"
    finally:
        ROBOT_STATE["running"] = False
        ROBOT_STATE["status"] = "Concluído"

def start_server(port=5000):
    init_db(DB_FILE)
    server_address = ('', port)
    httpd = HTTPServer(server_address, GETSWebHandler)
    print(f"============================================================")
    print(f"🌐 GETS ROBOTS DASHBOARD (2 ABAS - DISPARO 100% REAL NAS TELAS)")
    print(f"👉 Acesse no navegador: http://localhost:{port}")
    print(f"============================================================")
    httpd.serve_forever()

if __name__ == "__main__":
    start_server(5000)
