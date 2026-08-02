import time
import urllib.parse
import os

def generate_markdown_report(schema_list, transitions, target_url, output_path):
    lines = []
    lines.append(f"# 🧠 Mapa Mental Visual e Auditoria: Portal GETS\n")
    lines.append(f"> **Gerado em:** {time.strftime('%d/%m/%Y %H:%M:%S')}\n")
    lines.append(f"> **URL Alvo:** `{target_url}`\n")
    lines.append(f"> **Total de Páginas Capturadas:** {len(schema_list)}\n\n")

    lines.append("## 🛣️ 1. Fluxo de Transição Visual ('De onde para onde?')\n")
    lines.append("| Origem (De) | Elemento Clicado | Seletor de Automação | Destino (Para) | Print Screen |")
    lines.append("| :--- | :--- | :--- | :--- | :--- |")
    if transitions:
        for t in transitions:
            de_p = urllib.parse.urlparse(t["de_url"]).path or "/"
            para_p = urllib.parse.urlparse(t["para_url"]).path or "/"
            img_rel = t.get("screenshot_path", "")
            img_md = f"![Screenshot]({img_rel})" if img_rel else "-"
            lines.append(f"| `{de_p}` | **{t['texto_clique']}** | `{t['seletor']}` | `{para_p}` | {img_md} |")
    else:
        lines.append("| *Nenhuma transição registrada* | | | | |")
    lines.append("\n\n---\n")

    lines.append("## 📈 2. Fluxograma da Arquitetura do GETS (Mermaid)\n")
    lines.append("```mermaid\ngraph TD")
    lines.append("    classDef page fill:#9bf,stroke:#333,stroke-width:2px;")
    lines.append("    classDef form fill:#ffe26b,stroke:#333,stroke-width:2px;")
    
    for i, page in enumerate(schema_list):
        p_path = urllib.parse.urlparse(page["url"]).path or "/"
        lines.append(f'    P{i}["📄 {page["titulo"]}<br/>{p_path}"]:::page')
        for f_idx, form in enumerate(page.get("formularios", [])):
            f_id = form["id"] or f"Form_{f_idx+1}"
            lines.append(f'    P{i}F{f_idx}["📝 {f_id}"]:::form')
            lines.append(f'    P{i} --> P{i}F{f_idx}')
    lines.append("```\n\n---\n")

    lines.append("## 📸 3. Galeria Visual de Telas & Detalhamento de Seletores\n")
    for i, page in enumerate(schema_list):
        lines.append(f"### {i+1}. 📄 Tela: {page['titulo']}\n")
        lines.append(f"- **URL de Acesso:** `{page['url']}`\n")
        if page.get("screenshot"):
            lines.append(f"![Print Screen da Tela - {page['titulo']}]({page['screenshot']})\n")
        
        for f_idx, form in enumerate(page.get("formularios", [])):
            f_id = form["id"] or f"Formulário {f_idx+1}"
            lines.append(f"#### 📝 {f_id} (Método: `{form['method'].upper()}`)\n")
            
            if form.get("campos"):
                lines.append("| Label/Campo | Tipo | Seletor CSS / JSF | Placeholder |")
                lines.append("| :--- | :--- | :--- | :--- |")
                for c in form["campos"]:
                    lines.append(f"| **{c['label']}** | `{c['tipo']}` | `{c['selector']}` | "{c['placeholder']}" |")
                lines.append("\n")
                
            if form.get("botoes"):
                lines.append("| Botão | Tipo | Seletor de Clique |")
                lines.append("| :--- | :--- | :--- |")
                for b in form["botoes"]:
                    lines.append(f"| **{b['texto']}** | `{b['tipo']}` | `{b['selector']}` |")
                lines.append("\n")
        lines.append("---\n")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return output_path
