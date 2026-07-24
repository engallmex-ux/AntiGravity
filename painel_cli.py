import os
import sys
import json
import urllib.parse
from datetime import datetime
import time
import re

sys.stdout.reconfigure(encoding='utf-8')

HISTORY_PATH = r"C:\Users\Holter\.gemini\antigravity\scratch\analysis_history.json"
PAINEL_PATH = r"C:\Users\Holter\.gemini\antigravity\scratch\painel_investigador_site.md"
ANALYZER_PATH = r"C:\Users\Holter\.gemini\antigravity\scratch\site_analyzer.py"

def load_env_defaults():
    defaults = {
        "GETS_USER": "lucas.fonseca.4@hubrasil.gov.br",
        "GETS_PASS": "140921",
        "NEOVERO_USER": "lucas.fonseca",
        "NEOVERO_PASS": "Orbis@2026"
    }
    env_path = r"C:\Users\Holter\.gemini\antigravity\scratch\gets_neovero_integration\.env"
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if "=" in line and not line.startswith("#"):
                        k, v = line.strip().split("=", 1)
                        defaults[k.strip()] = v.strip()
        except Exception:
            pass
    return defaults

def save_to_history(url, pages_count, status="Sucesso"):
    """Salva a execução no arquivo de histórico JSON."""
    history = []
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            pass
            
    history.append({
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "url": url,
        "paginas_mapeadas": pages_count,
        "status": status
    })
    
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

def show_history():
    """Exibe o histórico de análises na tela de forma organizada."""
    print("\n" + "=" * 65)
    print("📜 HISTÓRICO DE SITES INVESTIGADOS E MAPEADOS")
    print("=" * 65)
    
    if not os.path.exists(HISTORY_PATH):
        print("   Nenhum site foi analisado ainda. O histórico está vazio.")
        print("=" * 65)
        input("\nPressione [Enter] para voltar ao menu principal...")
        return
        
    try:
        with open(HISTORY_PATH, "r", encoding="utf-8") as f:
            history = json.load(f)
    except Exception as e:
        print(f"   Erro ao ler histórico: {e}")
        return
        
    if not history:
        print("   O histórico está vazio.")
    else:
        print(f"{'Data/Hora':<20} | {'URL Alvo':<40} | {'Págs':<6} | {'Status':<15}")
        print("-" * 90)
        for h in history[-10:]:
            url_short = h['url']
            if len(url_short) > 40:
                url_short = url_short[:37] + "..."
            print(f"{h['timestamp']:<20} | {url_short:<40} | {h['paginas_mapeadas']:<6} | {h['status']:<15}")
            
    print("=" * 65)
    input("\nPressione [Enter] para voltar ao menu principal...")

def run_investigation(target_url, username, password, label_site, headless=True, scan_mode="static"):
    """Orquestra a análise do site, gerando relatórios e atualizando o painel."""
    print("\n" + "=" * 65)
    print(f"🤖 INICIANDO INVESTIGAÇÃO PROFUNDA: {label_site}")
    print(f"   Alvo: {target_url}")
    print(f"   Modo de Varredura: {scan_mode.upper()}")
    print("=" * 65)
    
    # 1. Configura o arquivo painel_investigador_site.md com os dados selecionados
    if os.path.exists(PAINEL_PATH):
        try:
            with open(PAINEL_PATH, "r", encoding="utf-8") as f:
                content = f.read()
            
            content = re_replace_field(content, "🌐 URL Inicial do Site", target_url)
            content = re_replace_field(content, "🔑 Usuário / E-mail", username)
            content = re_replace_field(content, "🔒 Senha de Acesso", password)
            
            val_scan = "Cliques Reais" if scan_mode == "clicking" else "Estático"
            content = re_replace_field(content, "🔍 Método de Varredura", val_scan)
            content = content.replace("`[ ] Executar Análise`", "`[x] Executar Análise`")
            
            with open(PAINEL_PATH, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            print(f"[!] Aviso ao atualizar painel.md: {e}")

    # 2. Executa a análise importando o site_analyzer
    sys.path.append(os.path.dirname(ANALYZER_PATH))
    try:
        from site_analyzer import SiteAnalyzer
        
        login_config = None
        if username and password:
            if "gets.ceb" in target_url:
                login_config = {
                    "url": target_url,
                    "username_selector": "input[name='j_username']",
                    "password_selector": "input[name='j_password']",
                    "submit_selector": "input[type='submit'][value='Entrar']",
                    "username": username,
                    "password": password
                }
            elif "neovero" in target_url:
                login_config = {
                    "url": target_url,
                    "username_selector": "input[id*='username'], input[type='text']",
                    "password_selector": "input[id*='password'], input[type='password']",
                    "submit_selector": "button[type='submit'], input[type='submit']",
                    "username": username,
                    "password": password
                }
            else:
                login_config = {
                    "url": target_url,
                    "username_selector": "input[type='text'], input[type='email']",
                    "password_selector": "input[type='password']",
                    "submit_selector": "button[type='submit'], input[type='submit']",
                    "username": username,
                    "password": password
                }

        analyzer = SiteAnalyzer(target_url, login_config, max_pages=8, headless=headless, scan_mode=scan_mode)
        schema_data = analyzer.analyze()
        
        if not schema_data:
            raise Exception("Nenhum dado de navegação ou menu foi retornado.")
            
        domain_clean = analyzer.domain.replace(".", "_")
        json_output = os.path.join(os.path.dirname(PAINEL_PATH), f"{domain_clean}_schema.json")
        with open(json_output, "w", encoding="utf-8") as f:
            json.dump(schema_data, f, ensure_ascii=False, indent=2)

        md_output = os.path.join(os.path.dirname(PAINEL_PATH), f"mapa_mental_{domain_clean}.md")
        analyzer.generate_markdown_mindmap(md_output)

        # Atualiza a UI em markdown
        import run_painel_updater
        run_painel_updater.update_painel_results(analyzer.domain, schema_data, analyzer.transitions)
        run_painel_updater.update_painel_status("CONCLUÍDO COM SUCESSO", "🟢")
        
        save_to_history(target_url, len(schema_data), "Sucesso")
        
        print("\n" + "=" * 65)
        print("🎉 ANÁLISE CONCLUÍDA COM SUCESSO!")
        print(f"   Páginas Mapeadas: {len(schema_data)}")
        print(f"   Transições Registradas: {len(analyzer.transitions)}")
        print(f"   Relatório salvo em: mapa_mental_{domain_clean}.md")
        print("   O Painel de Controle painel_investigador_site.md foi atualizado!")
        print("=" * 65)
        
    except Exception as e:
        print(f"\n❌ Erro durante o processamento do site: {e}")
        save_to_history(target_url, 0, f"Erro: {str(e)}")
        try:
            import run_painel_updater
            run_painel_updater.update_painel_status(f"ERRO: {str(e)}", "❌")
        except Exception:
            pass

    input("\nPressione [Enter] para continuar...")

def re_replace_field(content, field_label, new_value):
    pattern = rf"\*\s+\*\*{field_label}:\*\*\s+`([^`]+)`"
    if re.search(pattern, content):
        return re.sub(pattern, f"* **{field_label}:** `{new_value}`", content)
    return content

def main_menu():
    defaults = load_env_defaults()
    
    while True:
        os.system('cls' if os.name == 'nt' else 'clear')
        print("=" * 65)
        print("🛡️ INVESTIGADOR DE SITES - MENU INTERATIVO DE AUTOMAÇÃO")
        print("   Selecione o site alvo digitando o número correspondente")
        print("=" * 65)
        print(" [1] Analisar Portal GETS (Hospital Unicamp)")
        print(" [2] Analisar Portal Orbis NeoVero")
        print(" [3] Analisar Novo Site Personalizado (Digitar URL e Acessos)")
        print(" [4] Visualizar Histórico de Análises Realizadas")
        print(" [5] Sair do Sistema")
        print("=" * 65)
        
        opcao = input("Digite a sua opção (1-5): ").strip()
        
        if opcao in ["1", "2", "3"]:
            ver_navegador = input("Deseja ver o navegador em tempo real na tela? (s/n): ").strip().lower() == "s"
            print("\nEscolha o Método de Varredura:")
            print(" [1] Estático (Rápido - mapeia links HTML)")
            print(" [2] Cliques Reais (Profundo - clica elemento por elemento e mapeia rota)")
            metodo_opt = input("Opção (1-2) [Padrão: 1]: ").strip()
            scan_mode = "clicking" if metodo_opt == "2" else "static"
            
            if os.path.exists(PAINEL_PATH):
                try:
                    with open(PAINEL_PATH, "r", encoding="utf-8") as f:
                        content = f.read()
                    val_tela = "Sim" if ver_navegador else "Não"
                    val_scan = "Cliques Reais" if scan_mode == "clicking" else "Estático"
                    content = re_replace_field(content, "👁️ Visualizar Navegador \\(Modo com Tela\\)", val_tela)
                    content = re_replace_field(content, "🔍 Método de Varredura", val_scan)
                    with open(PAINEL_PATH, "w", encoding="utf-8") as f:
                        f.write(content)
                except Exception:
                    pass

        if opcao == "1":
            target = "https://gets.ceb.unicamp.br/nec/"
            user = defaults.get("GETS_USER", "")
            pword = defaults.get("GETS_PASS", "")
            run_investigation(target, user, pword, "GETS (Hospital Unicamp)", headless=not ver_navegador, scan_mode=scan_mode)
            
        elif opcao == "2":
            target = "https://orbis.neovero.com/UI/Base/Menu.aspx#/"
            user = defaults.get("NEOVERO_USER", "")
            pword = defaults.get("NEOVERO_PASS", "")
            run_investigation(target, user, pword, "Orbis NeoVero", headless=not ver_navegador, scan_mode=scan_mode)
            
        elif opcao == "3":
            target = input("\nDigite a URL Inicial do site: ").strip()
            if not target.startswith("http"):
                print("❌ URL Inválida. Deve começar com http:// ou https://")
                time.sleep(2)
                continue
            user = input("Digite o Usuário/E-mail de Acesso (Deixe em branco se público): ").strip()
            pword = input("Digite a Senha de Acesso (Deixe em branco se público): ").strip()
            run_investigation(target, user, pword, "Site Personalizado", headless=not ver_navegador, scan_mode=scan_mode)
            
        elif opcao == "4":
            show_history()
            
        elif opcao == "5":
            print("\nSaindo do Investigador de Sites. Até logo!")
            break
        else:
            print("\n❌ Opção inválida. Escolha de 1 a 5.")
            time.sleep(1.5)

if __name__ == "__main__":
    main_menu()
