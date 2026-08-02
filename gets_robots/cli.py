import os
import sys
import json
import time
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn
from rich.prompt import Prompt, Confirm
from rich.table import Table

from gets_robots.config import GETS_BASE_URL, GETS_USER, GETS_PASS, HISTORY_FILE, SCHEMA_OUTPUT, REPORT_OUTPUT, DB_FILE
from gets_robots.core.crawler import GETSNavCrawler
from gets_robots.core.creator_os import GETSOrderCreator
from gets_robots.exports.schema_generator import save_schema
from gets_robots.exports.report_generator import generate_markdown_report
from gets_robots.exports.database import init_db

console = Console()

def print_header():
    console.clear()
    console.print(Panel.fit(
        "[bold cyan]🤖 SUITE DE ROBÔS GETS (CEB / UNICAMP / EBSERH)[/bold cyan]\n"
        "[dim]Mapeamento com Progresso em Tempo Real • Extração de OS • Banco de Dados & Grafana[/dim]",
        border_style="cyan"
    ))

def save_to_history(url, pages_count, status="Sucesso"):
    history = []
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            pass
    history.append({
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "url": url,
        "paginas_mapeadas": pages_count,
        "status": status
    })
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

def show_history():
    print_header()
    console.print("[bold yellow]📜 HISTÓRICO DE EXECUÇÕES E AUDITORIAS[/bold yellow]\n")
    if not HISTORY_FILE.exists():
        console.print("[dim]Nenhuma execução registrada no histórico.[/dim]")
    else:
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
            table = Table(title="Últimas Execuções", show_header=True, header_style="bold green")
            table.add_column("Data/Hora", style="dim")
            table.add_column("URL Alvo")
            table.add_column("Páginas Mapeadas", justify="right")
            table.add_column("Status")
            
            for item in history[-10:]:
                table.add_row(item['timestamp'], item['url'], str(item['paginas_mapeadas']), item['status'])
            console.print(table)
        except Exception as e:
            console.print(f"[red]Erro ao ler histórico: {e}[/red]")
            
    Prompt.ask("\nPressione [Enter] para retornar ao menu principal")

def run_mapper_flow():
    print_header()
    console.print("[bold green]🌐 MAPEADOR DE NAVEGAÇÃO & GERADOR DE MAPA MENTAL[/bold green]\n")
    
    url = Prompt.ask("URL Inicial do GETS", default=GETS_BASE_URL)
    user = Prompt.ask("Usuário GETS", default=GETS_USER)
    password = Prompt.ask("Senha GETS", password=True, default=GETS_PASS)
    max_pages = int(Prompt.ask("Limite máximo de páginas para mapear", default="8"))
    
    scan_mode = Prompt.ask("Método de Varredura", choices=["clicking", "static"], default="clicking")
    headless = not Confirm.ask("Deseja visualizar o navegador durante a execução (headless=False)?", default=True)
    
    login_config = {
        "url": url,
        "username": user,
        "password": password,
        "username_selector": "input[name='j_username']",
        "password_selector": "input[name='j_password']",
        "submit_selector": "input[type='submit']"
    }

    console.print("\n[bold cyan]🚀 Iniciando Varredura do GETS...[/bold cyan]\n")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.1f}%"),
        TextColumn("•"),
        TimeRemainingColumn(),
        console=console
    ) as progress:
        task = progress.add_task("Mapeando portal...", total=100)

        def on_progress(p_data):
            pct = p_data["percentage"]
            url_short = p_data["current_url"]
            if len(url_short) > 45:
                url_short = url_short[:42] + "..."
            status = p_data["status"]
            
            progress.update(task, completed=pct, description=f"{status} ([dim]{url_short}[/dim])")

        crawler = GETSNavCrawler(
            target_url=url,
            login_config=login_config,
            max_pages=max_pages,
            headless=headless,
            scan_mode=scan_mode,
            progress_callback=on_progress
        )

        result = crawler.run()

    save_schema(result["schema"], SCHEMA_OUTPUT)
    generate_markdown_report(result["schema"], result["transitions"], url, REPORT_OUTPUT)
    save_to_history(url, len(result["visited_urls"]), "Sucesso")

    console.print("\n[bold green]✅ Varredura Concluída com Sucesso![/bold green]")
    console.print(f"📄 Schema JSON salvo em: [cyan]{SCHEMA_OUTPUT}[/cyan]")
    console.print(f"📝 Mapa Mental Markdown em: [cyan]{REPORT_OUTPUT}[/cyan]\n")
    
    Prompt.ask("Pressione [Enter] para retornar ao menu principal")

def run_create_order_flow():
    print_header()
    console.print("[bold yellow]🛠️ ROBÔ DE ABERTURA AUTOMATIZADA DE OS (GETS)[/bold yellow]\n")
    
    solic = Prompt.ask("Nome do Solicitante")
    tel = Prompt.ask("Ramal / Telefone", default="9104")
    ident = Prompt.ask("Patrimônio / TAG / ID do Equipamento")
    loc_fis = Prompt.ask("Localização Física (ex: 4º ANDAR / LEITO 02)")
    resp = Prompt.ask("Responsável pelo Equipamento no Local")
    sintoma = Prompt.ask("Sintoma Principal (ex: ALARME, BATERIA, CABO)", default="BATERIA")
    info = Prompt.ask("Informações Adicionais / Detalhes do Defeito", default="Abertura automatizada via suite GETS Robots.")

    headless = not Confirm.ask("Deseja visualizar o navegador executando a abertura?", default=True)

    order_data = {
        "solicitante": solic,
        "telefone": tel,
        "identificador_equipamento": ident,
        "localizacao_tipo": "US",
        "situacao_equipamento": "Parado",
        "localizacao_fisica": loc_fis,
        "prioridade": "Normal",
        "responsavel": resp,
        "sintomas": [sintoma],
        "informacoes_adicionais": info
    }

    creator = GETSOrderCreator(
        user=GETS_USER,
        password=GETS_PASS,
        base_url=GETS_BASE_URL,
        headless=headless
    )

    console.print("\n[bold cyan]⏳ Processando solicitação de abertura no GETS...[/bold cyan]")
    res = creator.create_order(order_data)

    if res["success"]:
        console.print(f"\n[bold green]🎉 CHAMADO ABERTO COM SUCESSO![/bold green] OS Número: [bold white]{res['os_number']}[/bold white]")
    else:
        console.print(f"\n[bold red]❌ Falha ao abrir chamado:[/bold red] {res['error']}")

    Prompt.ask("\nPressione [Enter] para retornar ao menu principal")

def setup_grafana_db():
    print_header()
    console.print("[bold cyan]📊 PREPARANDO BANCO DE DADOS PARA GRAFANA / DASHBOARDS[/bold cyan]\n")
    init_db(DB_FILE)
    console.print(f"✅ Banco de dados preparado em: [bold green]{DB_FILE}[/bold green]")
    console.print("📈 Views e Estruturas prontas para consulta via Grafana (SQLite Datasource)!")
    Prompt.ask("\nPressione [Enter] para retornar ao menu principal")

def main_menu():
    while True:
        print_header()
        console.print("[1] 🌐 Mapear e Auditar Portal GETS (Com Barra de Porcentagem em Tempo Real)")
        console.print("[2] 🛠️ Abertura Automatizada de Ordem de Serviço (Chamado Corretivo)")
        console.print("[3] 📊 Preparar Banco de Dados SQLite para Grafana & Dashboards")
        console.print("[4] 📜 Exibir Histórico de Execuções")
        console.print("[5] ❌ Sair")
        
        choice = Prompt.ask("\nEscolha uma opção", choices=["1", "2", "3", "4", "5"], default="1")
        
        if choice == "1":
            run_mapper_flow()
        elif choice == "2":
            run_create_order_flow()
        elif choice == "3":
            setup_grafana_db()
        elif choice == "4":
            show_history()
        elif choice == "5":
            console.print("[bold cyan]Encerrando suite GETS Robots... Até logo![/bold cyan]")
            break

if __name__ == "__main__":
    main_menu()
