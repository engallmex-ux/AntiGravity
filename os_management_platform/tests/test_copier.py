import os
import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

# Adiciona o diretório raiz ao path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engines.copier_engine import FormCopier

def test_local_copier():
    mock_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_form.html")
    file_url = urllib.request.pathname2url(mock_file_path)
    target_url = f"file://{file_url}" if not file_url.startswith("file:") else file_url
    
    print(f"[Teste] Inicializando FormCopier com URL local: {target_url}")
    copier = FormCopier(target_url, headless=True)
    res = copier.extract_forms()
    
    assert res is not None, "Falha na extração"
    
    schema = json.loads(res["campos_schema"])
    assert len(schema) > 0, "Nenhum formulário extraído"
    
    form = schema[0]
    assert form["form_id"] == "form_test_os", "Form ID incorreto"
    
    campos = form["campos"]
    print("\n[✓] Campos extraídos com sucesso do HTML local:")
    for c in campos:
        print(f"    - Label: {c['label']} | Seletor: {c['selector']} | Tipo: {c['tipo']}")
        
    print("\n🎉 TESTE DO COPIER CONCLUÍDO COM SUCESSO!")

if __name__ == "__main__":
    test_local_copier()
