import csv
import sys

global_path = r"C:\Users\Holter\.gemini\antigravity\scratch\ListaEqptos20260711171012.csv"

with open(global_path, encoding='latin-1') as f:
    reader = csv.reader(f, delimiter=';', quoting=csv.QUOTE_NONE)
    
    # Localizar cabeçalho
    header = None
    for row in reader:
        if row and len(row) > 0 and row[0].strip() == "NEC":
            header = row
            break
            
    if not header:
        print("Erro: Não foi possível localizar o cabeçalho 'NEC'!")
        sys.exit(1)
        
    # Localizar índices de forma flexível
    def find_idx(keywords):
        for i, col in enumerate(header):
            col_lower = col.lower()
            if any(k in col_lower for k in keywords):
                return i
        return -1

    idx_identificador = find_idx(["identificador"])
    idx_serie = find_idx(["série", "serie", "s/n"])
    idx_equip = find_idx(["tipo equipamento", "equipamento"])
    idx_marca = find_idx(["marca"])
    idx_modelo = find_idx(["modelo"])
    idx_setor = find_idx(["localização"])
    
    max_idx = max(idx_identificador, idx_serie, idx_equip, idx_marca, idx_modelo, idx_setor)
    
    print("Amostra de 20 equipamentos da base global:")
    print("-" * 80)
    count = 0
    for row in reader:
        if len(row) > max_idx:
            ident = row[idx_identificador].strip().strip('"')
            equip = row[idx_equip].strip().strip('"')
            marca = row[idx_marca].strip().strip('"')
            modelo = row[idx_modelo].strip().strip('"')
            serial = row[idx_serie].strip().strip('"')
            setor = row[idx_setor].strip().strip('"')
            
            if ident:
                print(f"ID: {ident} | Equip: {equip} | Marca: {marca} | Modelo: {modelo} | Série: {serial} | Setor: {setor}")
                count += 1
                if count >= 20:
                    break
