import re
import csv
import sys

input_path = r"C:\Users\Holter\.gemini\antigravity\scratch\registros_pasted.txt"
output_path = r"C:\Users\Holter\.gemini\antigravity\scratch\registros_auditoria.csv"

def clean(val):
    val = val.strip()
    if val.upper() in ["N/A", "N/A NA FOTO", "N/A NA PLANILHA", "NÃO SE APLICA", "-", "N/A NA FOTO DE FÁBRICA", "N/A NA FOTO DE FABRICA"]:
        return ""
    return val

def main():
    with open(input_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Split por REGISTRO
    records_text = re.split(r'REGISTRO \d+', text)
    header_text = records_text[0]
    records_text = records_text[1:]

    rows = []
    for idx, rec in enumerate(records_text):
        reg_num = f"{idx + 1:02d}"
        
        # Extrair campos
        def get_field(pattern):
            m = re.search(pattern, rec, re.IGNORECASE)
            return m.group(1).strip() if m else ""

        equip = get_field(r'(?:Categoria/Equipamento|Equipamento)\s*:\s*(.+)')
        marca = get_field(r'(?:Fabricante|Marca)\s*:\s*(.+)')
        modelo = get_field(r'Modelo\s*:\s*(.+)')
        serial = get_field(r'(?:Nº Série \(SN\)|N.º Série|Nº Série|Nº Série \(S/N\)|N.º Série \(S/N\))\s*:\s*(.+)')
        ebserh = get_field(r'Patrimônio EBSERH.*:\s*(.+)')
        rfid = get_field(r'Patrimônio RFID.*:\s*(.+)')
        os_gets = get_field(r'(?:Ordem de Serviço \(OS\)|Ordem de Serviço|Ordem de Serviço \(OS\))\s*:\s*(.+)')
        obs = get_field(r'(?:Observações de Auditoria|Observações)\s*:\s*(.+)')
        
        if not equip and "Maleta/Estojo" in rec:
            equip = "Maleta/Estojo"
        
        equip = clean(equip)
        marca = clean(marca)
        modelo = clean(modelo)
        serial = clean(serial)
        ebserh = clean(ebserh)
        rfid = clean(rfid)
        os_gets = clean(os_gets)
        obs = clean(obs)
        
        # Ativo principal
        ativo_code = ""
        if ebserh and ebserh.lower() != "equipamento sob contrato de comodato":
            ativo_code = ebserh
        elif rfid and rfid.lower() != "equipamento sob contrato de comodato":
            ativo_code = rfid
        elif serial:
            ativo_code = f"SN-{serial}"
        else:
            ativo_code = f"AUD-{reg_num}"

        # Setor: o usuário informou que o setor vai ser sempre "sala de distribuição"
        setor = "sala de distribuição"
        
        # Observações: O usuário pediu para preencher APENAS com a informação do Comodato se for o caso
        # "Equipamento alocado, pertencente ao TERMO DE COMODATO Nº 02/2025."
        # Caso contrário, usamos a observação extraída do registro.
        if "COMODATO" in rec.upper() or "comodato" in obs.lower() or "comodato" in rec.lower():
            combined_obs = "Equipamento alocado, pertencente ao TERMO DE COMODATO Nº 02/2025."
        else:
            combined_obs = obs
        
        # Condição de Uso
        condicao = "Boa"
        if "defeito" in rec.lower() or "quebrada" in rec.lower() or "aguardando" in rec.lower() or "manutenção" in rec.lower():
            condicao = "Regular (Equipamento danificado, mas em uso)"
            if "parado" in rec.lower() or "danificado" in rec.lower():
                condicao = "Ruim (Equipamento Parado)"

        rows.append([
            ativo_code,          # Código do Ativo
            "",                  # Data e Hora do Registro
            equip,               # Equipamento
            marca,               # Fabricante
            modelo,              # Modelo
            serial,              # Número de Série (S/N)
            ebserh if ebserh.lower() != "equipamento sob contrato de comodato" else "", # Patrimônio
            setor,               # Setor
            combined_obs,        # Observações
            condicao             # Condição
        ])

    header = [
        "Código do Ativo", "Data e Hora do Registro", "Equipamento", "Fabricante", "Modelo",
        "Número de Série (S/N)", "Número de Patrimônio / TAG", "Setor / Localização",
        "Observações / Diagnósticos", "Condição de Uso"
    ]

    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"Sucesso! Gerados {len(rows)} registros em: {output_path}")

if __name__ == "__main__":
    main()
