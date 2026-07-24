import os
import sys
import re
import json
import time
import urllib.parse
from datetime import datetime

# Garante saída UTF-8 no console Windows
sys.stdout.reconfigure(encoding='utf-8')

# Caminhos dos arquivos
PAINEL_PATH = r"C:\Users\Holter\.gemini\antigravity\scratch\painel_investigador_site.md"
ANALYZER_PATH = r"C:\Users\Holter\.gemini\antigravity\scratch\site_analyzer.py"
HISTORY_PATH = r"C:\Users\Holter\.gemini\antigravity\scratch\analysis_history.json"

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

def read_painel_config():
    """Lê as configurações fornecidas pelo usuário no arquivo markdown."""
    if not os.path.exists(PAINEL_PATH):
        print(f"❌ Painel não encontrado em {PAINEL_PATH}")
        return None

    with open(PAINEL_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Expressões regulares para capturar as entradas do usuário
    url_match = re.search(r"\*\s+\*\*🌐 URL Inicial do Site:\*\*\s+`([^`]+)`", content)
    user_match = re.search(r"\*\s+\*\*🔑 Usuário / E-mail:\*\*\s+`([^`]+)`", content)
    pass_match = re.search(r"\*\s+\*\*🔒 Senha de Acesso:\*\*\s+`([^`]+)`", content)
    pages_match = re.search(r"\*\s+\*\*⏱️ Limite de Páginas para Mapear:\*\*\s+`([^`]+)`", content)
    visible_match = re.search(r"\*\s+\*\*👁️ Visualizar Navegador \(Modo com Tela\):\*\*\s+`([^`]+)`", content)
    scan_match = re.search(r"\*\s+\*\*🔍 Método de Varredura:\*\*\s+`([^`]+)`", content)
    action_match = re.search(r"\*\s+\*\*⚙️ Ação Desejada:\*\*\s+`\[x\] Executar Análise`", content)

    if not url_match:
        print("❌ URL Inicial não localizada no Painel.")
        return None

    is_visible = True if visible_match and visible_match.group(1).strip().lower() == "sim" else False
    scan_mode = "clicking" if scan_match and "clique" in scan_match.group(1).strip().lower() else "static"

    config = {
        "target_url": url_match.group(1).strip(),
        "username": user_match.group(1).strip() if user_match else "",
        "password": pass_match.group(1).strip() if pass_match else "",
        "max_pages": int(pages_match.group(1).strip()) if pages_match else 5,
        "headless": not is_visible,
        "scan_mode": scan_mode,
        "should_run": True if action_match else False
    }
    return config

def update_painel_status(status_text, color_emoji="🟡"):
    """Atualiza a seção de Status no arquivo markdown."""
    with open(PAINEL_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    new_status = f"* **Estado Atual:** {color_emoji} **{status_text}**"
    content = re.sub(r"\*\s+\*\*Estado Atual:\*\*\s+.*", new_status, content)
    
    now_str = datetime.now().strftime("%Y-%m-%d às %H:%M:%S")
    content = re.sub(r"\*\s+\*\*Última Execução:\*\*\s+.*", f"* **Última Execução:** {now_str}", content)

    with open(PAINEL_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def update_painel_results(domain, schema_data, transitions):
    """Insere o diagrama Mermaid, tabela de transições e seletores de volta no painel."""
    with open(PAINEL_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Desmarca a caixa de seleção de ação [x] -> [ ]
    content = content.replace("`[x] Executar Análise`", "`[ ] Executar Análise`")

    # 2. Atualiza os links dos arquivos locais gerados
    domain_clean = domain.replace(".", "_")
    links_section = (
        f"* **Arquivos Locais Gerados:**\n"
        f"  * 🗄️ [Esquema JSON do Site](file:///C:/Users/Holter/.gemini/antigravity/scratch/{domain_clean}_schema.json)\n"
        f"  * 🗺️ [Relatório Técnico Detalhado](file:///C:/Users/Holter/.gemini/antigravity/scratch/mapa_mental_{domain_clean}.md)"
    )
    content = re.sub(r"\*\s+\*\*Arquivos Locais Gerados:\*\*\n(\s+\*.*?\n)*", links_section + "\n", content)

    # 2.5 Atualiza a tabela de transições de rotas (De qual lugar -> Leva para onde)
    trans_lines = [
        "| De qual página (Origem) | Ação / Link Clicado | Seletor de Automação | Leva para onde (Destino) |",
        "| :--- | :--- | :--- | :--- |"
    ]
    if transitions:
        for t in transitions:
            de_path = urllib.parse.urlparse(t["de_url"]).path or "/"
            para_path = urllib.parse.urlparse(t["para_url"]).path or "/"
            trans_lines.append(f"| `{de_path}` | **{t['texto_clique']}** | `{t['seletor']}` | `{para_path}` |")
    else:
        trans_lines.append("| *Nenhuma transição de cliques registrada* | | | |")
        
    trans_block = "\n".join(trans_lines)
    pattern_trans = r"(## 🛣️ 2\.5 RASTREAMENTO DE FLUXO \(De onde para onde\?\)\n\*.*?\n\n).*?(\n\n---)"
    content = re.sub(pattern_trans, r"\1" + trans_block + r"\2", content, flags=re.DOTALL)

    # 3. Reconstrói o diagrama Mermaid com base nas páginas mapeadas
    mermaid_lines = ["```mermaid\ngraph TD", "    classDef page fill:#9bf,stroke:#333,stroke-width:2px;", "    classDef form fill:#ffe26b,stroke:#333,stroke-width:2px;\n"]
    
    for idx, page in enumerate(schema_data):
        clean_title = re.sub(r'[\\/*?:"<>|]', "_", page["titulo"])
        parsed_url = urllib.parse.urlparse(page["url"])
        path_display = parsed_url.path if parsed_url.path else "/"
        mermaid_lines.append(f'    P{idx}["📄 {clean_title}<br/>{path_display}"]:::page')
        
        for f_idx, form in enumerate(page["formularios"]):
            form_id = form["id"] or f"Form_{f_idx+1}"
            mermaid_lines.append(f'    P{idx}F{f_idx}["📝 {form_id}"]:::form')
            mermaid_lines.append(f'    P{idx} --> P{idx}F{f_idx}')
            
        if idx > 0:
            mermaid_lines.append(f'    P0 --> P{idx}')
            
    mermaid_lines.append("```")
    mermaid_block = "\n".join(mermaid_lines)

    pattern_mermaid = r"(## 🗺️ 3\. MAPA MENTAL DA ARQUITETURA \(Atualizado pelo Agente\)\n\n).*?(\n\n---)"
    content = re.sub(pattern_mermaid, r"\1" + mermaid_block + r"\2", content, flags=re.DOTALL)

    # 4. Reconstrói o detalhamento de campos e botões
    detalhes = []
    for page in schema_data:
        parsed_url = urllib.parse.urlparse(page["url"])
        path_display = parsed_url.path if parsed_url.path else "/"
        detalhes.append(f"### 📄 Página: {page['titulo']} (`{path_display}`)")
        
        if page["formularios"]:
            for form in page["formularios"]:
                form_id = form["id"] or "Sem ID"
                detalhes.append(f"#### 📝 Formulário: {form_id}")
                detalhes.append("| Campo do Formulário | Tipo de Elemento | Seletor de Automação (CSS) | Descrição do Campo |")
                detalhes.append("| :--- | :--- | :--- | :--- |")
                
                if not form["campos"] and not form["botoes"]:
                    detalhes.append("| *Nenhum campo interativo identificado* | | | |")
                    
                for campo in form["campos"]:
                    label = campo["label"] or campo["name"] or "Rótulo Oculto"
                    detalhes.append(f"| **{label}** | `{campo['tipo']}` | `{campo['selector']}` | \"{campo['placeholder']}\" |")
                for btn in form["botoes"]:
                    detalhes.append(f"| **Botão: {btn['texto']}** | `click` | `{btn['selector']}` | Gatilho de Envio |")
                detalhes.append("")
        else:
            detalhes.append("*Nenhum formulário identificado nesta página.*\n")
            
    detalhes_block = "\n".join(detalhes)
    
    pattern_detalhes = r"(## 🔍 4\. DETALHAMENTO DE CAMPOS, BOTÕES E SELETORES \(Atualizado pelo Agente\)\n\n).*?(\n\n---)"
    content = re.sub(pattern_detalhes, r"\1" + detalhes_block + r"\2", content, flags=re.DOTALL)

    with open(PAINEL_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def run():
    print("[+] Lendo painel de controle...")
    config = read_painel_config()
    
    if not config:
        return

    if not config["should_run"]:
        print("[ℹ️] Ação 'Executar Análise' não está marcada. Pulando execução.")
        return

    print(f"[+] Iniciando processo de engenharia reversa para: {config['target_url']}")
    update_painel_status("ROBÔ INICIADO - ACESSANDO SITE...", "🔴")

    try:
        sys.path.append(os.path.dirname(ANALYZER_PATH))
        from site_analyzer import SiteAnalyzer
        
        login_config = None
        if config["username"] and config["password"]:
            if "gets.ceb.unicamp.br" in config["target_url"]:
                login_config = {
                    "url": config["target_url"],
                    "username_selector": "input[name='j_username']",
                    "password_selector": "input[name='j_password']",
                    "submit_selector": "input[type='submit'][value='Entrar']",
                    "username": config["username"],
                    "password": config["password"]
                }
            else:
                login_config = {
                    "url": config["target_url"],
                    "username_selector": "input[type='text'], input[type='email']",
                    "password_selector": "input[type='password']",
                    "submit_selector": "button[type='submit'], input[type='submit']",
                    "username": config["username"],
                    "password": config["password"]
                }
        
        analyzer = SiteAnalyzer(
            config["target_url"], 
            login_config, 
            max_pages=config["max_pages"], 
            headless=config.get("headless", True),
            scan_mode=config.get("scan_mode", "static")
        )
        update_painel_status("MAPEANDO MENUS E EXTRAINDO SELETORES...", "🟠")
        
        schema_data = analyzer.analyze()
        
        if not schema_data:
            raise Exception("Nenhum dado pôde ser mapeado do site alvo.")

        domain_clean = analyzer.domain.replace(".", "_")
        json_output = os.path.join(os.path.dirname(PAINEL_PATH), f"{domain_clean}_schema.json")
        with open(json_output, "w", encoding="utf-8") as f:
            json.dump(schema_data, f, ensure_ascii=False, indent=2)

        md_output = os.path.join(os.path.dirname(PAINEL_PATH), f"mapa_mental_{domain_clean}.md")
        analyzer.generate_markdown_mindmap(md_output)

        # Atualiza a interface interativa (painel_investigador_site.md)
        update_painel_results(analyzer.domain, schema_data, analyzer.transitions)
        update_painel_status("CONCLUÍDO COM SUCESSO", "🟢")
        save_to_history(config["target_url"], len(schema_data), "Sucesso")
        print("\n[✓] Painel atualizado com sucesso com todos os dados da engenharia reversa!")
        
    except Exception as e:
        print(f"❌ Erro durante o mapeamento: {e}")
        update_painel_status(f"ERRO: {str(e)}", "❌")
        save_to_history(config["target_url"], 0, f"Erro: {str(e)}")

if __name__ == "__main__":
    run()
