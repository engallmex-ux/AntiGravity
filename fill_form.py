import csv
import sys
import time
import random
import re
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

CSV_PATH = r"C:\Users\Holter\.gemini\antigravity\scratch\Inspeções_Eng_Clínica_OrbisTracker_HU-BR - Inspeções.csv"
FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfW7GSzOU-Ed9v4PzqJ1pTCG2wahh4pmNIb1rTdaksZqL8qGA/viewform"

def fuzzy_match(options, value):
    val_clean = value.strip().lower()
    if not val_clean:
        return None
    # 1. Correspondência exata
    for opt in options:
        if opt.strip().lower() == val_clean:
            return opt
    # 2. Ignora busca parcial se for a palavra "teste" para evitar falsos positivos
    if val_clean == "teste":
        return None
    # 3. Correspondência se a opção iniciar com o valor (comprimento >= 4)
    for opt in options:
        opt_clean = opt.strip().lower()
        if len(val_clean) >= 4 and opt_clean.startswith(val_clean):
            return opt
    return None

def click_element(driver, element):
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    time.sleep(0.3)
    try:
        WebDriverWait(driver, 5).until(EC.element_to_be_clickable(element))
        element.click()
    except Exception:
        print("Clique normal interceptado, utilizando clique via JavaScript...")
        driver.execute_script("arguments[0].click();", element)

def human_type(driver, element, text):
    click_element(driver, element)
    time.sleep(random.uniform(0.1, 0.3))
    element.clear()
    time.sleep(0.1)
    for char in text:
        element.send_keys(char)
        time.sleep(random.uniform(0.08, 0.25)) # Atraso de 80ms a 250ms por tecla
    time.sleep(random.uniform(0.5, 1.2)) # Pausa de conferência visual

def fill_text_field(driver, label_text, value):
    print(f"Preenchendo campo de texto '{label_text}' com '{value}'...")
    container_xpath = f"//div[@role='listitem'][descendant::span[contains(text(), '{label_text}')] or descendant::div[contains(text(), '{label_text}')]]"
    container = driver.find_element(By.XPATH, container_xpath)
    try:
        input_el = container.find_element(By.XPATH, ".//input[@type='text' or @type='number' or @type='email']")
    except Exception:
        input_el = container.find_element(By.XPATH, ".//textarea")
    human_type(driver, input_el, value)

def fill_date_field(driver, label_text, date_str):
    print(f"Preenchendo campo de data '{label_text}' com '{date_str}'...")
    container_xpath = f"//div[@role='listitem'][descendant::span[contains(text(), '{label_text}')] or descendant::div[contains(text(), '{label_text}')]]"
    container = driver.find_element(By.XPATH, container_xpath)
    
    day, month, year = date_str.split('/')
    inputs = container.find_elements(By.XPATH, ".//input[@type='text' or @type='number' or @role='combobox']")
    
    month_input, day_input, year_input = None, None, None
    for inp in inputs:
        label = (inp.get_attribute("aria-label") or "").lower()
        if "month" in label or "mês" in label or "mes" in label:
            month_input = inp
        elif "day" in label or "dia" in label:
            day_input = inp
        elif "year" in label or "ano" in label:
            year_input = inp
            
    # Fallback por ordem
    if not month_input and len(inputs) >= 3:
        month_input = inputs[0]
        day_input = inputs[1]
        year_input = inputs[2]
        
    if month_input and day_input and year_input:
        human_type(driver, month_input, month)
        human_type(driver, day_input, day)
        human_type(driver, year_input, year)
    else:
        raise Exception(f"Inputs de data não localizados no card '{label_text}'")

def select_dropdown_value(driver, label_text, value, options):
    print(f"Selecionando no dropdown '{label_text}' o valor '{value}'...")
    container_xpath = f"//div[@role='listitem'][descendant::span[contains(text(), '{label_text}')] or descendant::div[contains(text(), '{label_text}')]]"
    container = driver.find_element(By.XPATH, container_xpath)
    
    best_opt = fuzzy_match(options, value)
    if not best_opt:
        print(f"Aviso: Valor '{value}' não mapeado nas opções. Pulando seleção do dropdown.")
        return False
        
    listbox = container.find_element(By.XPATH, ".//div[@role='listbox']")
    click_element(driver, listbox)
    time.sleep(random.uniform(0.5, 0.8)) # Pausa para renderização das opções
    
    opts_els = driver.find_elements(By.XPATH, "//div[@role='option' and @data-value]")
    matched_el = None
    for opt in opts_els:
        opt_val = opt.get_attribute("data-value")
        if opt_val and opt_val.strip().lower() == best_opt.strip().lower():
            matched_el = opt
            break
            
    if matched_el:
        click_element(driver, matched_el)
        time.sleep(random.uniform(0.5, 1.2))
        return True
    else:
        print(f"Erro: Opção '{best_opt}' visível não encontrada no DOM.")
        return False

def select_radio_value(driver, label_text, value, options):
    print(f"Selecionando botão de rádio '{label_text}' para '{value}'...")
    container_xpath = f"//div[@role='listitem'][descendant::span[contains(text(), '{label_text}')] or descendant::div[contains(text(), '{label_text}')]]"
    container = driver.find_element(By.XPATH, container_xpath)
    
    best_opt = fuzzy_match(options, value)
    if not best_opt:
        raise Exception(f"Opção de rádio '{value}' não mapeada em {options}")
        
    radios = container.find_elements(By.XPATH, ".//div[@role='radio']")
    matched_radio = None
    for r in radios:
        parent_label = r.find_element(By.XPATH, "./ancestor::label")
        r_text = parent_label.text.strip().lower()
        if best_opt.strip().lower() in r_text or r_text in best_opt.strip().lower():
            matched_radio = r
            break
            
    if matched_radio:
        click_element(driver, matched_radio)
        time.sleep(random.uniform(0.5, 1.2))
    else:
        raise Exception(f"Botão de rádio com texto correspondente a '{best_opt}' não encontrado.")

def main():
    if len(sys.argv) < 2:
        print("Uso: python fill_form.py <indice_linha_csv>")
        sys.exit(1)
        
    target_row_idx = int(sys.argv[1])
    
    # 1. Ler o CSV
    row_data = None
    with open(CSV_PATH, encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        adjusted_header = [
            "Código do Ativo", "Data e Hora do Registro", "Equipamento", "Fabricante", "Modelo",
            "Número de Série (S/N)", "Número de Patrimônio / TAG", "Setor / Localização",
            "Observações / Diagnósticos", "Condição de Uso", "Auditor / Técnico", "E-mail do Auditor",
            "Possui Calibração?", "Executado por (Calibração)", "Data Calibração", "Próxima Calibração",
            "Possui Preventiva?", "Executado por (Preventiva)", "Data Preventiva", "Próxima Preventiva",
            "Possui Seg. Elétrica?", "Executado por (Seg. Elétrica)", "Data Seg. Elétrica", "Próxima Seg. Elétrica",
            "Link das Imagens no Google Drive", "Latitude", "Longitude", "Equipamento Novo?", "Nº O.S. (GETS)",
            "Propriedade", "Manual (Instruções)", "Pasta Google Drive", "Lista de Acessórios"
        ]
        
        current_idx = 1
        for row in reader:
            current_idx += 1
            if current_idx == target_row_idx:
                row_data = dict(zip(adjusted_header, row))
                break
                
    if not row_data:
        print(f"Erro: Linha {target_row_idx} não encontrada no CSV.")
        sys.exit(1)
        
    print(f"Registro selecionado: {row_data['Código do Ativo']} - {row_data['Equipamento']}")

    # 2. Carregar definições do Forms
    import json
    with open("fields.json", encoding="utf-8") as fj:
        fields = json.load(fj)
        
    # Inicializa o Chrome em modo padrão (limpo) mas sem as flags de automação
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-gpu")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_experimental_option("detach", True)

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    # Oculta a flag navigator.webdriver para que o Google não detecte a automação e permita o login
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    })
    
    try:
        print(f"Navegando ate o formulario: {FORM_URL}")
        driver.get(FORM_URL)
        
        # 3. Loop robusto para detectar login e aguardar carregamento
        print("Aguardando carregamento do formulario (e login do Google se for exigido)...")
        logged_in = False
        start_time = time.time()
        
        while not logged_in:
            current_url = driver.current_url
            
            # Se não estivermos na página do Forms (ex: redirecionado para login do Google)
            if "docs.google.com/forms" not in current_url:
                print("[ACAO REQUERIDA]: Por favor, faca login com sua conta do Google na janela aberta...")
                time.sleep(5)
                continue
                
            # Se estiver na página do Forms mas com modal de login sobreposto
            modals = driver.find_elements(By.XPATH, "//*[contains(text(), 'Faça login') or contains(text(), 'login para continuar') or contains(text(), 'Sign in to continue')]")
            if any(m.is_displayed() for m in modals):
                print("[ACAO REQUERIDA]: O formulario exige login. Por favor, clique em 'FAZER LOGIN' e conclua o login no navegador...")
                time.sleep(5)
                continue
                
            # Verifica se os cards de perguntas do formulário foram carregados
            cards = driver.find_elements(By.XPATH, "//div[@role='listitem']")
            if cards and any(c.is_displayed() for c in cards):
                print("Conexao detectada com sucesso! O formulario foi carregado.")
                logged_in = True
                break
                
            if time.time() - start_time > 300:
                raise Exception("Tempo limite esgotado esperando o login do Google ou o carregamento do Forms.")
                
            time.sleep(2)

        # 4. Esperar que a barra de carregamento inicial/overlay desapareça
        print("Aguardando carregamento da pagina do Forms...")
        try:
            WebDriverWait(driver, 10).until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "mjANdc"))
            )
        except Exception:
            pass

        print("Formulario carregado. Iniciando preenchimento simulacao humana...")
        
        # Preencher SETOR
        setor_field = next(f for f in fields if f["title"] == "SETOR")
        select_dropdown_value(driver, "SETOR", row_data["Setor / Localização"], setor_field["options"])
        
        # Preencher EQUIPAMENTO
        equip_field = next(f for f in fields if f["title"] == "EQUIPAMENTO")
        selected_equip = select_dropdown_value(driver, "EQUIPAMENTO", row_data["Equipamento"], equip_field["options"])
        if not selected_equip:
            fill_text_field(driver, "OUTRO:", row_data["Equipamento"])
            
        # Preencher MARCA
        marca_field = next(f for f in fields if f["title"] == "MARCA")
        selected_marca = select_dropdown_value(driver, "MARCA", row_data["Fabricante"], marca_field["options"])
        if not selected_marca:
            fill_text_field(driver, "Outro:", row_data["Fabricante"])
            
        # Preencher MODELO
        modelo_field = next(f for f in fields if f["title"] == "MODELO")
        select_dropdown_value(driver, "MODELO", row_data["Modelo"], modelo_field["options"])
        
        # Preencher NUMERO DE SERIE
        fill_text_field(driver, "NÚMERO DE SÉRIE", row_data["Número de Série (S/N)"])
        
        # Preencher PATRIMONIO
        fill_text_field(driver, "PATRIMÔNIO", row_data["Número de Patrimônio / TAG"])
        
        # Preencher CONDICAO
        condicao_field = next(f for f in fields if f["title"] == "CONDIÇÃO")
        select_radio_value(driver, "CONDIÇÃO", row_data["Condição de Uso"], condicao_field["options"])
        
        # Preencher data VALIDADE PREVENTIVA
        if row_data["Próxima Preventiva"]:
            fill_date_field(driver, "VALIDADE PREVENTIVA", row_data["Próxima Preventiva"])
            
        # Preencher data VALIDADE CALIBRACAO
        if row_data["Próxima Calibração"]:
            fill_date_field(driver, "VALIDADE CALIBRAÇÃO", row_data["Próxima Calibração"])
            
        # Preencher data VALIDADE TSE
        if row_data["Próxima Seg. Elétrica"]:
            fill_date_field(driver, "VALIDADE TSE", row_data["Próxima Seg. Elétrica"])
            
        # Preencher OBSERVACAO
        obs_text = row_data["Observações / Diagnósticos"]
        if obs_text:
            fill_text_field(driver, "OBSERVAÇÃO", obs_text)
            
        print("\n=== PREENCHIMENTO REALIZADO COM SUCESSO ===")
        print("Parei antes de clicar no botao 'Enviar' para sua revisao.")
        print("Por favor, revise os dados no navegador e clique em 'Enviar' manualmente.")
        
    except Exception as e:
        print(f"\n[ERRO NA EXECUCAO]: {e}", file=sys.stderr)
        screenshot_name = f"erro_linha_{target_row_idx}.png"
        driver.save_screenshot(screenshot_name)
        print(f"Captura de tela salva como '{screenshot_name}' no diretorio atual.", file=sys.stderr)

if __name__ == "__main__":
    main()
