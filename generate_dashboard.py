import csv
import json
import os

CSV_PATH = r"C:\Users\Holter\.gemini\antigravity\scratch\Inspeções_Eng_Clínica_OrbisTracker_HU-BR - Inspeções.csv"
FIELDS_JSON_PATH = r"C:\Users\Holter\.gemini\antigravity\scratch\fields.json"
OUTPUT_HTML_PATH = r"C:\Users\Holter\.gemini\antigravity\scratch\painel_agente.html"

def main():
    # 1. Ler o CSV inicial
    rows_data = []
    if os.path.exists(CSV_PATH):
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
            for row in reader:
                row_dict = dict(zip(adjusted_header, row))
                rows_data.append({
                    "ativo": row_dict["Código do Ativo"],
                    "data_hora": row_dict["Data e Hora do Registro"],
                    "equipamento": row_dict["Equipamento"],
                    "fabricante": row_dict["Fabricante"],
                    "modelo": row_dict["Modelo"],
                    "num_serie": row_dict["Número de Série (S/N)"],
                    "patrimonio": row_dict["Número de Patrimônio / TAG"],
                    "setor": row_dict["Setor / Localização"],
                    "obs": row_dict["Observações / Diagnósticos"],
                    "condicao": row_dict["Condição de Uso"],
                    "val_prev": row_dict["Próxima Preventiva"],
                    "val_cal": row_dict["Próxima Calibração"],
                    "val_tse": row_dict["Próxima Seg. Elétrica"]
                })

    # 2. Ler as opções do formulário
    with open(FIELDS_JSON_PATH, encoding='utf-8') as fj:
        fields = json.load(fj)
        
    sector_field = next(f for f in fields if f["title"] == "SETOR")
    equip_field = next(f for f in fields if f["title"] == "EQUIPAMENTO")
    marca_field = next(f for f in fields if f["title"] == "MARCA")
    modelo_field = next(f for f in fields if f["title"] == "MODELO")
    cond_field = next(f for f in fields if f["title"] == "CONDIÇÃO")

    # 3. Gerar o arquivo HTML
    html_content = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel do Agente de Inspeções - OrbisTracker</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
            --card-bg: rgba(30, 41, 59, 0.7);
            --card-border: rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-primary: #6366f1;
            --accent-hover: #4f46e5;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --danger-hover: #dc2626;
        }}

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Plus Jakarta Sans', sans-serif;
        }}

        body {{
            background: var(--bg-gradient);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 2rem;
            display: flex;
            justify-content: center;
        }}

        .container {{
            width: 100%;
            max-width: 1200px;
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }}

        header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--card-border);
            padding-bottom: 1.5rem;
        }}

        header h1 {{
            font-size: 2rem;
            font-weight: 700;
            background: linear-gradient(to right, #818cf8, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}

        .badge-info {{
            background: rgba(99, 102, 241, 0.15);
            border: 1px solid rgba(99, 102, 241, 0.3);
            color: #a5b4fc;
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 600;
        }}

        .card {{
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 1.5rem;
            backdrop-filter: blur(16px);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
        }}

        .instructions {{
            line-height: 1.6;
            color: var(--text-secondary);
        }}

        .instructions strong {{
            color: #a5b4fc;
        }}

        /* Estilo de Dropzone para carregar CSV */
        .upload-zone {{
            border: 2px dashed rgba(99, 102, 241, 0.4);
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
            background: rgba(99, 102, 241, 0.03);
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
        }}

        .upload-zone:hover, .upload-zone.dragover {{
            border-color: var(--accent-primary);
            background: rgba(99, 102, 241, 0.08);
        }}

        .upload-zone p {{
            font-size: 0.95rem;
            color: var(--text-secondary);
        }}

        .upload-zone span {{
            font-size: 0.85rem;
            color: #818cf8;
            text-decoration: underline;
        }}

        .controls-row {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 1rem;
            gap: 1rem;
            flex-wrap: wrap;
        }}

        .btn-action {{
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--card-border);
            color: var(--text-primary);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }}

        .btn-action:hover {{
            background: rgba(255,255,255,0.1);
        }}

        .btn-export {{
            background: var(--success);
            border: none;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }}

        .btn-export:hover {{
            background: #059669;
            transform: translateY(-1px);
        }}

        .filter-toggle {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.9rem;
            color: var(--text-secondary);
            cursor: pointer;
            user-select: none;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }}

        th {{
            text-align: left;
            padding: 1rem;
            color: var(--text-secondary);
            font-weight: 600;
            border-bottom: 2px solid var(--card-border);
            font-size: 0.875rem;
        }}

        td {{
            padding: 1.25rem 1rem;
            border-bottom: 1px solid var(--card-border);
            font-size: 0.95rem;
        }}

        tr:hover td {{
            background: rgba(255, 255, 255, 0.02);
        }}

        .btn-fill {{
            background: var(--accent-primary);
            color: white;
            border: none;
            padding: 0.6rem 1.2rem;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
        }}

        .btn-fill:hover {{
            background: var(--accent-hover);
            transform: translateY(-2px);
        }}

        .btn-delete {{
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.85rem;
            transition: all 0.2s ease;
        }}

        .btn-delete:hover {{
            background: var(--danger);
            color: white;
        }}

        .status-badge {{
            display: inline-flex;
            align-items: center;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
        }}

        .status-pending {{
            background: rgba(245, 158, 11, 0.15);
            border: 1px solid rgba(245, 158, 11, 0.3);
            color: #fcd34d;
        }}

        .status-done {{
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34d399;
        }}

        .log-section {{
            margin-top: 1rem;
        }}

        .log-list {{
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            max-height: 200px;
            overflow-y: auto;
            padding: 0.5rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            border: 1px solid var(--card-border);
        }}

        .log-item {{
            font-family: monospace;
            font-size: 0.85rem;
            color: var(--text-secondary);
            padding: 0.25rem 0.5rem;
            border-bottom: 1px solid rgba(255,255,255,0.02);
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>Painel do Agente OrbisTracker</h1>
                <p style="color: var(--text-secondary); margin-top: 0.25rem;">Preenchimento de Formulários Corporativos HU-UFSCAR</p>
            </div>
            <div class="badge-info">Plataforma Segura e Sem Bloqueios</div>
        </header>

        <section class="card instructions">
            <p>💡 <strong>Como funciona a integração com o Google Sheets:</strong> Baixe a planilha do Sheets em <strong>Arquivo > Fazer download > Valores separados por vírgula (.csv)</strong>, depois arraste para a caixa abaixo. Você pode remover linhas indesejadas, ocultar os itens concluídos e exportar o progresso atual de volta para o Excel a qualquer momento!</p>
        </section>

        <!-- Zona de Configurações Globais -->
        <section class="card" style="display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <label for="default-sector-select" style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 600;">🔒 Setor Travado para o Preenchimento:</label>
                <select id="default-sector-select" onchange="addLog('Setor padrao alterado.'); renderTable();" style="background: rgba(15, 23, 42, 0.8); border: 1px solid var(--card-border); color: var(--text-primary); padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; outline: none; font-size: 0.9rem;">
                    <option value="">-- Usar o setor da planilha --</option>
                </select>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                *Se selecionado, este setor será preenchido para <strong>todos</strong> os equipamentos.
            </div>
        </section>

        <!-- Zona de Upload de CSV -->
        <section class="card">
            <div class="upload-zone" id="drop-zone" onclick="document.getElementById('file-input').click()">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-primary);"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <p>Arraste e solte o arquivo <strong>.csv</strong> exportado do Sheets aqui</p>
                <span>ou clique para procurar no seu computador</span>
                <input type="file" id="file-input" accept=".csv" style="display: none;" onchange="handleFileSelect(event)">
            </div>
        </section>

        <section class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--card-border); padding-bottom: 1rem; margin-bottom: 1rem;">
                <h2>Fila de Registros para Processamento</h2>
                <div class="controls-row">
                    <label class="filter-toggle">
                        <input type="checkbox" id="hide-done-checkbox" onchange="toggleHideDone()"> Ocultar Processados
                    </label>
                    <button class="btn-export" onclick="exportProgress()">
                        📥 Exportar Progresso (CSV)
                    </button>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Ativo (Código)</th>
                        <th>Equipamento</th>
                        <th>Setor</th>
                        <th>Condição</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="rows-container">
                    <!-- Gerado dinamicamente -->
                </tbody>
            </table>
        </section>

        <section class="card log-section">
            <h2>Log de Auditoria em Tempo Real</h2>
            <ul class="log-list" id="log-container">
                <!-- Logs do LocalStorage -->
            </ul>
        </section>
    </div>

    <script>
        const formBaseUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfW7GSzOU-Ed9v4PzqJ1pTCG2wahh4pmNIb1rTdaksZqL8qGA/viewform";

        const sectorOptions = {json.dumps(sector_field["options"], ensure_ascii=False)};
        const equipOptions = {json.dumps(equip_field["options"], ensure_ascii=False)};
        const marcaOptions = {json.dumps(marca_field["options"], ensure_ascii=False)};
        const modeloOptions = {json.dumps(modelo_field["options"], ensure_ascii=False)};
        const condOptions = {json.dumps(cond_field["options"], ensure_ascii=False)};

        let dataRows = {json.dumps(rows_data, ensure_ascii=False)};
        let hideDone = false;

        // Dicionário de mapeamento manual para termos que o string matching não pega
        const manualMappings = {{
            "bomba de infusao": "BOMBA INFUSAO USO GERAL",
            "bomba de infusão": "BOMBA INFUSAO USO GERAL",
            "bomba de infusao de uso geral": "BOMBA INFUSAO USO GERAL",
            "bomba de infusão de uso geral": "BOMBA INFUSAO USO GERAL",
            "ventilador de uti": "VENTILADOR PULMONAR",
            "ventilador bipap/cpap": "VENTILADOR BIPAP/CPAP",
            "aspirador de baixo volume": "ASPIRADOR BAIXO VOLUME",
            "maquina de osmose reversa": "OSMOSE REVERSA",
            "máquina de osmose reversa": "OSMOSE REVERSA",
            "cama de leito": "CAMA ELETRICA",
            "cama / leito": "CAMA ELETRICA",
            "balança de plataforma eletrônica": "BALANCA PLATAFORMA ELETRONICA",
            "balanca de plataforma eletronica": "BALANCA PLATAFORMA ELETRONICA",
            "balança infantil eletrônica": "BALANCA INFANTIL ELETRONICA",
            "balanca infantil eletronica": "BALANCA INFANTIL ELETRONICA",
            "maleta/estojo": "",
            "maleta": "",
            "estojo": ""
        }};

        function normalizeString(str) {{
            if (!str) return "";
            return str.normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, " ")      // Substitui caracteres especiais por espaços
                      .replace(/\b(de|da|do|para|em|uso|geral|maquina|baixo|volume|de uti|geral)\b/g, "") // Remove stop words
                      .replace(/\s+/g, " ")            // Remove espaços extras
                      .trim();
        }}

        function formatFormDate(dateStr) {{
            if (!dateStr) return "";
            const parts = dateStr.split('/');
            if (parts.length === 3) {{
                return `${{parts[2]}}-${{parts[1].padStart(2, '0')}}-${{parts[0].padStart(2, '0')}}`;
            }}
            return dateStr;
        }}

        function getBestOption(options, value) {{
            if (!value) return "";
            const valClean = value.trim().toLowerCase();
            
            // 1. Verificar mapeamento manual exato
            if (manualMappings[valClean]) {{
                return manualMappings[valClean];
            }}
            
            // 2. Tentar encontrar substring direta no mapeamento manual
            for (const key in manualMappings) {{
                if (valClean.includes(key) || key.includes(valClean)) {{
                    return manualMappings[key];
                }}
            }}

            const valNorm = normalizeString(value);
            if (!valNorm || valNorm === "teste") return "";

            // 3. Correspondência exata após normalização
            for (const opt of options) {{
                if (normalizeString(opt) === valNorm) return opt;
            }}

            // 4. Substring após normalização
            for (const opt of options) {{
                const optNorm = normalizeString(opt);
                if (valNorm.includes(optNorm) || optNorm.includes(valNorm)) {{
                    return opt;
                }}
            }}

            return "";
        }}

        function generatePrefilledUrl(row) {{
            const params = new URLSearchParams();
            
            // Verificar Setor Travado no Painel
            const defaultSector = document.getElementById("default-sector-select").value;
            if (defaultSector) {{
                params.append("entry.74901864", defaultSector);
            }} else if (row.setor) {{
                const sectorOpt = getBestOption(sectorOptions, row.setor);
                if (sectorOpt) params.append("entry.74901864", sectorOpt);
            }}
            
            if (row.equipamento) {{
                const equipOpt = getBestOption(equipOptions, row.equipamento);
                if (equipOpt) {{
                    params.append("entry.1736638741", equipOpt);
                }} else {{
                    params.append("entry.1545190436", row.equipamento);
                }}
            }}
            
            if (row.fabricante) {{
                const marcaOpt = getBestOption(marcaOptions, row.fabricante);
                if (marcaOpt) {{
                    params.append("entry.1178798650", marcaOpt);
                }} else {{
                    params.append("entry.529015948", row.fabricante);
                }}
            }}
            
            if (row.modelo) {{
                const modeloOpt = getBestOption(modeloOptions, row.modelo);
                if (modeloOpt) params.append("entry.531544184", modeloOpt);
            }}
            
            if (row.num_serie) params.append("entry.336267491", row.num_serie);
            if (row.patrimonio) params.append("entry.1025983419", row.patrimonio);
            
            if (row.condicao) {{
                const condOpt = getBestOption(condOptions, row.condicao);
                if (condOpt) params.append("entry.656379151", condOpt);
            }}
            
            if (row.val_prev) params.append("entry.1846850756", formatFormDate(row.val_prev));
            if (row.val_cal) params.append("entry.1517468380", formatFormDate(row.val_cal));
            if (row.val_tse) params.append("entry.523213862", formatFormDate(row.val_tse));
            
            if (row.obs) params.append("entry.760077387", row.obs);
            
            return `${{formBaseUrl}}?${{params.toString()}}`;
        }}

        function addLog(text) {{
            const now = new Date();
            const timeStr = now.toLocaleTimeString();
            const dateStr = now.toLocaleDateString();
            const logMsg = `[${{dateStr}} ${{timeStr}}] - ${{text}}`;
            
            let logs = JSON.parse(localStorage.getItem("orbis_logs") || "[]");
            logs.unshift(logMsg);
            if (logs.length > 50) logs = logs.slice(0, 50);
            localStorage.setItem("orbis_logs", JSON.stringify(logs));
            
            renderLogs();
        }}

        function renderLogs() {{
            const logs = JSON.parse(localStorage.getItem("orbis_logs") || "[]");
            const container = document.getElementById("log-container");
            container.innerHTML = logs.map(log => `<li class="log-item">${{log}}</li>`).join("");
        }}

        function toggleStatus(ativoId) {{
            const currentStatus = localStorage.getItem(`status_${{ativoId}}`) || "Pendente";
            const newStatus = currentStatus === "Pendente" ? "Processado" : "Pendente";
            localStorage.setItem(`status_${{ativoId}}`, newStatus);
            
            addLog(`Alterado status de ${{ativoId}} para: ${{newStatus}}`);
            renderTable();
        }}

        function markAsProcessed(ativoId) {{
            localStorage.setItem(`status_${{ativoId}}`, "Processado");
            addLog(`Ativo ${{ativoId}} marcado como Processado automaticamente ao clicar para preencher.`);
            renderTable();
        }}

        function removeRow(ativoId) {{
            dataRows = dataRows.filter(row => row.ativo !== ativoId);
            addLog(`Ativo ${{ativoId}} removido da lista temporária.`);
            renderTable();
        }}

        function toggleHideDone() {{
            hideDone = document.getElementById("hide-done-checkbox").checked;
            renderTable();
        }}

        function exportProgress() {{
            const header = ["Código do Ativo", "Equipamento", "Setor / Localização", "Marca", "Modelo", "Série", "Patrimônio", "Condição", "Status"];
            const csvContent = [];
            csvContent.push(header.join(","));
            
            for (const row of dataRows) {{
                const status = localStorage.getItem(`status_${{row.ativo}}`) || "Pendente";
                const displaySector = document.getElementById("default-sector-select").value || row.setor || "";
                const line = [
                    `"${{row.ativo.replace(/"/g, '""')}}"`,
                    `"${{(row.equipamento || "").replace(/"/g, '""')}}"`,
                    `"${{displaySector.replace(/"/g, '""')}}"`,
                    `"${{(row.fabricante || "").replace(/"/g, '""')}}"`,
                    `"${{(row.modelo || "").replace(/"/g, '""')}}"`,
                    `"${{(row.num_serie || "").replace(/"/g, '""')}}"`,
                    `"${{(row.patrimonio || "").replace(/"/g, '""')}}"`,
                    `"${{(row.condicao || "").replace(/"/g, '""')}}"`,
                    `"${{status}}"`
                ];
                csvContent.push(line.join(","));
            }}
            
            const blob = new Blob([csvContent.join("\\n")], {{ type: 'text/csv;charset=utf-8;' }});
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "progresso_inspecoes.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            addLog("Progresso exportado como arquivo CSV.");
        }}

        function renderTable() {{
            const container = document.getElementById("rows-container");
            let filteredRows = dataRows;
            
            if (hideDone) {{
                filteredRows = dataRows.filter(row => {{
                    const status = localStorage.getItem(`status_${{row.ativo}}`) || "Pendente";
                    return status !== "Processado";
                }});
            }}
            
            const defaultSector = document.getElementById("default-sector-select").value;
            
            container.innerHTML = filteredRows.map((row, idx) => {{
                const status = localStorage.getItem(`status_${{row.ativo}}`) || "Pendente";
                const statusClass = status === "Pendente" ? "status-pending" : "status-done";
                const prefilledUrl = generatePrefilledUrl(row);
                
                const displaySector = defaultSector || row.setor || "-";
                
                return `
                    <tr>
                        <td style="font-weight: 600; color: #a5b4fc;">${{row.ativo}}</td>
                        <td>${{row.equipamento || "-"}}</td>
                        <td style="color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${{displaySector}}">${{displaySector}}</td>
                        <td>${{row.condicao || "-"}}</td>
                        <td>
                            <span class="status-badge ${{statusClass}}" onclick="toggleStatus('${{row.ativo}}')">
                                ${{status}}
                            </span>
                        </td>
                        <td style="display: flex; gap: 0.5rem; align-items: center;">
                            <a href="${{prefilledUrl}}" target="_blank" class="btn-fill" onclick="markAsProcessed('${{row.ativo}}'); addLog('Formulario pre-preenchido aberto para ${{row.ativo}}')">
                                Preencher no Edge/Chrome
                            </a>
                            <button class="btn-delete" onclick="removeRow('${{row.ativo}}')">
                                Remover
                            </button>
                        </td>
                    </tr>
                `;
            }}).join("");
        }}

        // Parser manual de CSV
        function parseCSV(text) {{
            const lines = [];
            let row = [""];
            let inQuotes = false;

            for (let i = 0; i < text.length; i++) {{
                const c = text[i];
                const next = text[i+1];
                if (c === '"') {{
                    if (inQuotes && next === '"') {{
                        row[row.length - 1] += '"';
                        i++;
                    }} else {{
                        inQuotes = !inQuotes;
                    }}
                }} else if (c === ',' && !inQuotes) {{
                    row.push('');
                }} else if ((c === '\\r' || c === '\\n') && !inQuotes) {{
                    if (c === '\\r' && next === '\\n') {{
                        i++;
                    }}
                    lines.push(row);
                    row = [''];
                }} else {{
                    row[row.length - 1] += c;
                }}
            }}
            if (row.length > 1 || row[0] !== '') {{
                lines.push(row);
            }}
            return lines;
        }}

        function loadCSVData(csvText) {{
            const parsed = parseCSV(csvText);
            if (parsed.length < 2) return;
            
            const rawHeader = parsed[0];
            const dataRowsRaw = parsed.slice(1);
            
            const getIndex = (names) => {{
                return rawHeader.findIndex(h => names.some(n => h.toLowerCase().includes(n.toLowerCase())));
            }};
            
            const idxAtivo = getIndex(["código do ativo", "ativo", "tag", "código"]);
            const idxEquip = getIndex(["equipamento"]);
            const idxFab = getIndex(["fabricante", "marca", "produtor"]);
            const idxMod = getIndex(["modelo"]);
            const idxSerie = getIndex(["série", "serial", "s/n"]);
            const idxPatr = getIndex(["patrimônio", "tag"]);
            const idxSetor = getIndex(["setor", "localização", "sala"]);
            const idxObs = getIndex(["observações", "diagnósticos", "obs"]);
            const idxCond = getIndex(["condição"]);
            const idxPrev = getIndex(["preventiva", "próxima preventiva"]);
            const idxCal = getIndex(["calibração", "próxima calibração"]);
            const idxTse = getIndex(["seg. elétrica", "tse", "próxima seg. elétrica"]);
            
            // Mapeamento dinâmico
            const newDataRows = [];
            for (const r of dataRowsRaw) {{
                if (r.length < 2) continue;
                
                let ativoVal = idxAtivo !== -1 ? r[idxAtivo] : r[0];
                if (!ativoVal || ativoVal.trim() === "") continue;
                
                newDataRows.push({{
                    ativo: ativoVal,
                    equipamento: idxEquip !== -1 ? r[idxEquip] : "",
                    fabricante: idxFab !== -1 ? r[idxFab] : "",
                    modelo: idxMod !== -1 ? r[idxMod] : "",
                    num_serie: idxSerie !== -1 ? r[idxSerie] : "",
                    patrimonio: idxPatr !== -1 ? r[idxPatr] : "",
                    setor: idxSetor !== -1 ? r[idxSetor] : "",
                    obs: idxObs !== -1 ? r[idxObs] : "",
                    condicao: idxCond !== -1 ? r[idxCond] : "Boa",
                    val_prev: idxPrev !== -1 ? r[idxPrev] : "",
                    val_cal: idxCal !== -1 ? r[idxCal] : "",
                    val_tse: idxTse !== -1 ? r[idxTse] : ""
                }});
            }}
            
            if (newDataRows.length > 0) {{
                dataRows = newDataRows;
                renderTable();
                addLog(`Sucesso: Carregada nova planilha contendo ${{newDataRows.length}} registros.`);
            }} else {{
                alert("Erro: Nenhuma coluna de identificação ('Código do Ativo' ou similar) foi localizada.");
            }}
        }}

        function handleFileSelect(evt) {{
            const file = evt.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {{
                loadCSVData(e.target.result);
            }};
            reader.readAsText(file, "UTF-8");
        }}

        // Setup Drag & Drop
        const dropZone = document.getElementById('drop-zone');
        dropZone.addEventListener('dragover', (e) => {{
            e.preventDefault();
            dropZone.classList.add('dragover');
        }});
        dropZone.addEventListener('dragleave', () => {{
            dropZone.classList.remove('dragover');
        }});
        dropZone.addEventListener('drop', (e) => {{
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.csv')) {{
                const reader = new FileReader();
                reader.onload = function(evt) {{
                    loadCSVData(evt.target.result);
                }};
                reader.readAsText(file, "UTF-8");
            }}
        }});

        // Inicialização
        const sectorSelect = document.getElementById("default-sector-select");
        sectorOptions.forEach(opt => {{
            const el = document.createElement("option");
            el.value = opt;
            el.textContent = opt;
            sectorSelect.appendChild(el);
        }});

        if (!localStorage.getItem("orbis_logs")) {{
            addLog("Painel iniciado. Aguardando processamento dos itens...");
        }}
        renderTable();
        renderLogs();
    </script>
</body>
</html>
"""
    with open(OUTPUT_HTML_PATH, "w", encoding="utf-8") as out:
        out.write(html_content)
    print(f"Painel com transição automática de status gerado em: {OUTPUT_HTML_PATH}")

if __name__ == "__main__":
    main()
