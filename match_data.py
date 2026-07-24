import csv

global_path = r"C:\Users\Holter\.gemini\antigravity\scratch\ListaEqptos20260711171012.csv"

# Ler o arquivo inteiro como texto e buscar termos
with open(global_path, 'r', encoding='latin-1') as f:
    content = f.read()

print("Buscando 'SVI-002'...")
count_svi = content.count("SVI-002")
print(f"Ocorrências de 'SVI-002': {count_svi}")

print("Buscando 'DTI-001'...")
count_dti = content.count("DTI-001")
print(f"Ocorrências de 'DTI-001': {count_dti}")

print("Buscando 'TER-001'...")
count_ter = content.count("TER-001")
print(f"Ocorrências de 'TER-001': {count_ter}")

# Vamos imprimir uma amostra dos primeiros 10 identificadores da base global
print("\nAmostra de identificadores da base global:")
with open(global_path, 'r', encoding='latin-1') as f:
    reader = csv.reader(f, delimiter=';')
    for _ in range(5):
        next(reader)
    header = next(reader)
    # Procurar a coluna do identificador
    idx_ident = -1
    for i, col in enumerate(header):
        if "identificador" in col.lower():
            idx_ident = i
            break
    print(f"Identificador está no índice {idx_ident}")
    
    count = 0
    for row in reader:
        if len(row) > idx_ident:
            val = row[idx_ident].strip()
            if val:
                print(val)
                count += 1
                if count >= 10:
                    break
