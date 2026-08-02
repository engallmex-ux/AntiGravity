import json
import os
from pathlib import Path

def compare_schemas(old_schema_path, new_schema_path):
    """
    Compara dois arquivos de schema capturados em datas diferentes (Diff de Versões)
    e identifica alterações no portal GETS (novas páginas, seletores alterados ou removidos).
    """
    diff_report = {
        "novas_paginas": [],
        "paginas_removidas": [],
        "campos_alterados": [],
        "timestamp_comparacao": str(Path(new_schema_path).stat().st_mtime)
    }

    if not os.path.exists(old_schema_path) or not os.path.exists(new_schema_path):
        diff_report["erro"] = "Um dos arquivos de schema para comparação não foi encontrado."
        return diff_report

    try:
        with open(old_schema_path, "r", encoding="utf-8") as f:
            old_data = json.load(f)
        with open(new_schema_path, "r", encoding="utf-8") as f:
            new_data = json.load(f)

        old_urls = {p["url"]: p for p in old_data}
        new_urls = {p["url"]: p for p in new_data}

        # Páginas adicionadas
        for url in new_urls:
            if url not in old_urls:
                diff_report["novas_paginas"].append(url)

        # Páginas removidas
        for url in old_urls:
            if url not in new_urls:
                diff_report["paginas_removidas"].append(url)

        # Alterações em formulários nas páginas existentes
        for url in new_urls:
            if url in old_urls:
                old_forms = len(old_urls[url].get("formularios", []))
                new_forms = len(new_urls[url].get("formularios", []))
                if old_forms != new_forms:
                    diff_report["campos_alterados"].append({
                        "url": url,
                        "tipo": "Mudança no número de formulários/campos",
                        "antes": old_forms,
                        "depois": new_forms
                    })

    except Exception as e:
        diff_report["erro"] = str(e)

    return diff_report
