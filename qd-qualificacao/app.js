// app.js - Lógica do Sistema de Automação de Qualificação de Desempenho (QD)

// Banco de Dados Local (LocalStorage)
let assets = [];
let currentAssetId = "";
let dashboardChart = null;
let recoveryChart = null;
let reportChart = null;

// Configuração Inicial e Eventos
document.addEventListener("DOMContentLoaded", () => {
    initDatabase();
    setupNavigation();
    setupForms();
    setupStopwatch();
    setupOCRSimulator();
    setupAssetSelectors();
    updateDashboard();
    
    // Configura a data/hora inicial no painel simulador
    const now = new Date();
    document.getElementById("sim-date").value = now.toISOString().split('T')[0];
    document.getElementById("sim-time").value = now.toTimeString().split(' ')[0];
    updateSimPanel();
});

// 1. GERENCIAMENTO DE BANCO DE DADOS LOCAL
function initDatabase() {
    const stored = localStorage.getItem("qd_assets");
    if (stored) {
        assets = JSON.parse(stored);
    } else {
        // Preenche com o ativo padrão do memorial: ColdLab CL 540 V
        const defaultAsset = {
            id: "ColdLab-CL540V",
            model: "ColdLab CL 540 V",
            serial: "CL-2026-9875",
            setpoint: -20.0,
            load: "Carga térmica simulada via 14 dataloggers e garrafas de 2L (preenchidas com solução glicolada/água) distribuídas nas prateleiras.",
            temp_ambiente: 19.9,
            umidade_ur: 61,
            // Etapa 1: Queda de Energia
            outage: {
                start: "15:29:38",
                end: "15:39:38", // 10 minutos
                temp_start: -20.0,
                temp_end: -19.5,
                display_on: true,
                logs_saved: true,
                setpoint_saved: true,
                completed: true
            },
            // Etapa 2: Porta Aberta
            door: {
                start: "15:41:38",
                end: "15:51:38",
                alarm_delay: 45, // 45 segundos
                temp_start: -19.5,
                temp_end: 1.0,
                completed: true
            },
            // Etapa 3: Retomada de Temperatura
            recovery: {
                start: "15:53:24",
                start_temp: 1.0,
                end: "16:59:48",
                end_temp: -20.1,
                duration: "01h 06min 24s",
                completed: true
            },
            compliance: "CONFORME"
        };
        assets.push(defaultAsset);
        saveToLocalStorage();
    }
}

function saveToLocalStorage() {
    localStorage.setItem("qd_assets", JSON.stringify(assets));
}

// 2. NAVEGAÇÃO ENTRE ABAS
function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabPanes = document.querySelectorAll(".tab-pane");
    
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetTab = item.getAttribute("data-tab");
            
            navItems.forEach(nav => nav.classList.remove("active"));
            tabPanes.forEach(pane => pane.classList.remove("active"));
            
            item.classList.add("active");
            document.getElementById(`tab-${targetTab}`).classList.add("active");
            
            // Atualiza títulos
            const pageTitle = document.getElementById("page-title");
            const pageSubtitle = document.getElementById("page-subtitle");
            
            if (targetTab === "dashboard") {
                pageTitle.textContent = "Dashboard Geral";
                pageSubtitle.textContent = "Acompanhamento de conformidade e testes térmicos";
                updateDashboard();
            } else if (targetTab === "cadastro") {
                pageTitle.textContent = "Cadastro de Equipamento";
                pageSubtitle.textContent = "Adicionar ativos à base de qualificação";
            } else if (targetTab === "ensaios") {
                pageTitle.textContent = "Execução de Ensaios";
                pageSubtitle.textContent = "Registro passo a passo dos estudos de campo";
                updateAssetSelectors();
            } else if (targetTab === "ocr-sim") {
                pageTitle.textContent = "Simulador OCR";
                pageSubtitle.textContent = "Captura de temperatura de painel por inteligência artificial";
                updateAssetSelectors();
            } else if (targetTab === "relatorios") {
                pageTitle.textContent = "Laudos e Relatórios";
                pageSubtitle.textContent = "Geração de laudos técnicos de conformidade";
                updateAssetSelectors();
            }
        });
    });
}

// 3. SELETORES DE ATIVOS
function updateAssetSelectors() {
    const selects = [
        document.getElementById("select-test-asset"),
        document.getElementById("select-ocr-asset"),
        document.getElementById("select-report-asset")
    ];
    
    selects.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Selecione o equipamento --</option>';
        
        assets.forEach(asset => {
            const opt = document.createElement("option");
            opt.value = asset.id;
            opt.textContent = `${asset.model} [${asset.id}]`;
            select.appendChild(opt);
        });
        
        select.value = currentVal;
    });
}

// Configura eventos nos seletores
function setupAssetSelectors() {
    const testSelect = document.getElementById("select-test-asset");
    const workflow = document.getElementById("test-workflow-container");
    
    testSelect.addEventListener("change", (e) => {
        currentAssetId = e.target.value;
        if (currentAssetId) {
            workflow.classList.remove("disabled-overlay");
            loadAssetTestData(currentAssetId);
        } else {
            workflow.classList.add("disabled-overlay");
        }
    });
    
    // Seletor de relatório
    const reportSelect = document.getElementById("select-report-asset");
    const reportContainer = document.getElementById("report-sheet-container");
    const printBtn = document.getElementById("btn-print-report");
    
    reportSelect.addEventListener("change", (e) => {
        const id = e.target.value;
        if (id) {
            reportContainer.classList.remove("disabled-overlay");
            printBtn.disabled = false;
            generateReportSheet(id);
        } else {
            reportContainer.classList.add("disabled-overlay");
            printBtn.disabled = true;
        }
    });

    printBtn.addEventListener("click", () => {
        window.print();
    });
}

// 4. CADASTRO DE EQUIPAMENTOS
function setupForms() {
    const form = document.getElementById("form-cadastro-ativo");
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const id = document.getElementById("asset-id").value.trim();
        const model = document.getElementById("asset-model").value.trim();
        const serial = document.getElementById("asset-serial").value.trim();
        const setpoint = parseFloat(document.getElementById("asset-setpoint").value);
        const load = document.getElementById("asset-load").value.trim();
        
        // Verifica duplicidade
        if (assets.some(a => a.id === id)) {
            alert("Já existe um ativo cadastrado com este ID/TAG!");
            return;
        }
        
        const newAsset = {
            id,
            model,
            serial,
            setpoint,
            load,
            temp_ambiente: 19.9, // Valores ambientais padrão
            umidade_ur: 61,
            outage: { completed: false },
            door: { completed: false },
            recovery: { completed: false },
            compliance: "PENDENTE"
        };
        
        assets.push(newAsset);
        saveToLocalStorage();
        form.reset();
        
        alert("Equipamento cadastrado com sucesso!");
        updateAssetSelectors();
        
        // Vai para a aba de testes
        document.querySelector('[data-tab="ensaios"]').click();
        document.getElementById("select-test-asset").value = id;
        document.getElementById("select-test-asset").dispatchEvent(new Event("change"));
    });
    
    // Queda de energia: salvar
    document.getElementById("btn-save-outage").addEventListener("click", () => {
        if (!currentAssetId) return;
        const asset = assets.find(a => a.id === currentAssetId);
        
        asset.outage.start = document.getElementById("power-off-time").value;
        asset.outage.end = document.getElementById("power-on-time").value;
        asset.outage.completed = true;
        
        saveToLocalStorage();
        checkAssetCompliance(asset);
        alert("Horários da Queda de Energia salvos com sucesso!");
    });
    
    // Queda de energia: checklist
    document.getElementById("form-checklist-energia").addEventListener("submit", (e) => {
        e.preventDefault();
        if (!currentAssetId) return;
        const asset = assets.find(a => a.id === currentAssetId);
        
        asset.outage.display_on = document.getElementById("chk-display-on").checked;
        asset.outage.logs_saved = document.getElementById("chk-logs-saved").checked;
        asset.outage.setpoint_saved = document.getElementById("chk-setpoint-saved").checked;
        
        saveToLocalStorage();
        checkAssetCompliance(asset);
        alert("Checklist pós-evento salvo com sucesso!");
    });
    
    // Porta aberta: salvar
    document.getElementById("btn-save-door-test").addEventListener("click", () => {
        if (!currentAssetId) return;
        const asset = assets.find(a => a.id === currentAssetId);
        
        asset.door.start = document.getElementById("door-open-time").value;
        asset.door.end = document.getElementById("door-close-time").value;
        asset.door.alarm_delay = parseInt(document.getElementById("door-alarm-delay").value);
        asset.door.completed = true;
        
        saveToLocalStorage();
        checkAssetCompliance(asset);
        alert("Dados do estudo de Porta Aberta salvos!");
    });
    
    // Retomada: salvar
    document.getElementById("btn-save-recovery-test").addEventListener("click", () => {
        if (!currentAssetId) return;
        const asset = assets.find(a => a.id === currentAssetId);
        
        const start = document.getElementById("recovery-start-time").value;
        const startTemp = parseFloat(document.getElementById("recovery-start-temp").value);
        const end = document.getElementById("recovery-end-time").value;
        const endTemp = parseFloat(document.getElementById("recovery-end-temp").value);
        
        const duration = calculateTimeDiff(start, end);
        document.getElementById("recovery-duration-calc").textContent = duration;
        
        asset.recovery = {
            start,
            start_temp: startTemp,
            end,
            end_temp: endTemp,
            duration,
            completed: true
        };
        
        saveToLocalStorage();
        checkAssetCompliance(asset);
        renderRecoveryChart(asset);
        alert("Dados do estudo de Retomada Térmica salvos!");
    });
    
    // Capturar horário "Agora"
    document.querySelectorAll(".btn-capture").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            const input = document.getElementById(targetId);
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            input.value = timeStr;
        });
    });
    
    // Workflow Tabs switching
    const wTabs = document.querySelectorAll(".w-tab");
    wTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            wTabs.forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".w-tab-content").forEach(c => c.classList.remove("active"));
            
            tab.classList.add("active");
            const contentId = tab.getAttribute("data-wtab");
            document.getElementById(contentId).classList.add("active");
        });
    });
}

// Carregar dados de teste do ativo selecionado nos inputs
function loadAssetTestData(id) {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    
    // Queda
    document.getElementById("power-off-time").value = asset.outage.start || "15:29:38";
    document.getElementById("power-on-time").value = asset.outage.end || "15:40:06";
    document.getElementById("chk-display-on").checked = asset.outage.display_on || false;
    document.getElementById("chk-logs-saved").checked = asset.outage.logs_saved || false;
    document.getElementById("chk-setpoint-saved").checked = asset.outage.setpoint_saved || false;
    
    // Porta aberta
    document.getElementById("door-open-time").value = asset.door.start || "15:41:38";
    document.getElementById("door-close-time").value = asset.door.end || "15:51:38";
    document.getElementById("door-alarm-delay").value = asset.door.alarm_delay || 45;
    
    // Retomada
    document.getElementById("recovery-start-time").value = asset.recovery.start || "15:53:24";
    document.getElementById("recovery-start-temp").value = asset.recovery.start_temp !== undefined ? asset.recovery.start_temp : 1.0;
    document.getElementById("recovery-end-time").value = asset.recovery.end || "16:59:48";
    document.getElementById("recovery-end-temp").value = asset.recovery.end_temp !== undefined ? asset.recovery.end_temp : -20.1;
    document.getElementById("recovery-duration-calc").textContent = asset.recovery.duration || "--";
    
    if (asset.recovery.completed) {
        renderRecoveryChart(asset);
    } else {
        if (recoveryChart) {
            recoveryChart.destroy();
            recoveryChart = null;
        }
    }
}

// 5. TEMPORIZADOR DO ESTUDO DE PORTA ABERTA
let swInterval = null;
let swStartTime = null;
let swElapsedTime = 0;
let swAlarmTime = null;

function setupStopwatch() {
    const timeDisplay = document.getElementById("stopwatch-time");
    const btnStart = document.getElementById("btn-sw-start");
    const btnAlarm = document.getElementById("btn-sw-alarm");
    const btnStop = document.getElementById("btn-sw-stop");
    const statusLabel = document.getElementById("sw-status");
    
    btnStart.addEventListener("click", () => {
        // Iniciar
        swStartTime = Date.now() - swElapsedTime;
        swInterval = setInterval(updateStopwatchDisplay, 10);
        
        btnStart.disabled = true;
        btnAlarm.disabled = false;
        btnStop.disabled = false;
        
        statusLabel.textContent = "Executando - Porta Aberta (t=0)";
        
        // Define o horário de início no input
        const now = new Date();
        document.getElementById("door-open-time").value = now.toTimeString().split(' ')[0];
    });
    
    btnAlarm.addEventListener("click", () => {
        // Disparar alarme
        swAlarmTime = Date.now() - swStartTime;
        const reactionSeconds = Math.round(swAlarmTime / 1000);
        document.getElementById("door-alarm-delay").value = reactionSeconds;
        
        btnAlarm.disabled = true;
        statusLabel.textContent = `Alarme Disparado em ${reactionSeconds}s! 🔔`;
        
        // Efeito de flash vermelho temporário
        const screen = document.getElementById("freezer-display-panel");
        screen.classList.add("blinking");
        setTimeout(() => screen.classList.remove("blinking"), 3000);
    });
    
    btnStop.addEventListener("click", () => {
        // Fechar porta
        clearInterval(swInterval);
        swElapsedTime = Date.now() - swStartTime;
        
        btnStart.disabled = false;
        btnAlarm.disabled = true;
        btnStop.disabled = true;
        
        statusLabel.textContent = "Porta Fechada - Ensaio Concluído";
        
        const now = new Date();
        document.getElementById("door-close-time").value = now.toTimeString().split(' ')[0];
        
        // Reset local variables
        swElapsedTime = 0;
    });
    
    function updateStopwatchDisplay() {
        const time = Date.now() - swStartTime;
        const minutes = Math.floor(time / 60000);
        const seconds = Math.floor((time % 60000) / 1000);
        const centiseconds = Math.floor((time % 1000) / 10);
        
        timeDisplay.textContent = 
            (minutes < 10 ? "0" + minutes : minutes) + ":" + 
            (seconds < 10 ? "0" + seconds : seconds) + "." + 
            (centiseconds < 10 ? "0" + centiseconds : centiseconds);
    }
}

// 6. SIMULADOR DE VISOR DIGITAL E OCR
function setupOCRSimulator() {
    const simTemp = document.getElementById("sim-temp");
    const simComp = document.getElementById("sim-comp");
    const simDate = document.getElementById("sim-date");
    const simTime = document.getElementById("sim-time");
    
    const elements = [simTemp, simComp, simDate, simTime];
    elements.forEach(el => el.addEventListener("input", updateSimPanel));
    
    const laser = document.getElementById("scanner-laser");
    const triggerBtn = document.getElementById("btn-trigger-ocr");
    const saveBtn = document.getElementById("btn-save-ocr-to-test");
    const statusBox = document.getElementById("ocr-status-box");
    
    triggerBtn.addEventListener("click", () => {
        // Iniciar animação laser
        laser.classList.add("scanning");
        statusBox.textContent = "Acionando câmera... Alinhando painel...";
        statusBox.className = "ocr-status-box scanning";
        triggerBtn.disabled = true;
        saveBtn.disabled = true;
        
        setTimeout(() => {
            statusBox.textContent = "Processando algoritmo de OCR (Lendo Display Digital)...";
            
            setTimeout(() => {
                // Finaliza OCR
                laser.classList.remove("scanning");
                triggerBtn.disabled = false;
                
                // Transfere valores lidos para os resultados
                const tempVal = parseFloat(simTemp.value).toFixed(1);
                const dateVal = simDate.value.split('-').reverse().join('/');
                const timeVal = simTime.value;
                const compVal = simComp.value;
                
                document.getElementById("ocr-result-date").value = dateVal;
                document.getElementById("ocr-result-time").value = timeVal;
                document.getElementById("ocr-result-temp").value = `${tempVal} °C`;
                document.getElementById("ocr-result-comp").value = compVal;
                
                statusBox.textContent = "Sucesso! OCR leu: " + tempVal + " °C | Compressores: " + compVal;
                statusBox.className = "ocr-status-box success";
                saveBtn.disabled = false;
                
                // Atualiza seletor de ativos no vinculo
                const ocrSelect = document.getElementById("select-ocr-asset");
                if (ocrSelect.value === "" && currentAssetId) {
                    ocrSelect.value = currentAssetId;
                }
            }, 1000);
            
        }, 1200);
    });
    
    // Vincular dados salvos ao teste ativo
    saveBtn.addEventListener("click", () => {
        const ocrAssetId = document.getElementById("select-ocr-asset").value;
        if (!ocrAssetId) {
            alert("Selecione um ativo para vincular os dados!");
            return;
        }
        
        const targetField = document.querySelector('input[name="ocr-target-test"]:checked').value;
        const asset = assets.find(a => a.id === ocrAssetId);
        
        const readTemp = parseFloat(document.getElementById("ocr-result-temp").value);
        const readTime = document.getElementById("ocr-result-time").value;
        
        if (targetField === "outage-start") {
            asset.outage.start = readTime;
            asset.outage.temp_start = readTemp;
        } else if (targetField === "outage-end") {
            asset.outage.end = readTime;
            asset.outage.temp_end = readTemp;
        } else if (targetField === "door-open") {
            asset.door.start = readTime;
            asset.door.temp_start = readTemp;
        } else if (targetField === "door-close") {
            asset.door.end = readTime;
            asset.door.temp_end = readTemp;
        } else if (targetField === "recovery-start") {
            asset.recovery.start = readTime;
            asset.recovery.start_temp = readTemp;
        } else if (targetField === "recovery-end") {
            asset.recovery.end = readTime;
            asset.recovery.end_temp = readTemp;
        }
        
        saveToLocalStorage();
        checkAssetCompliance(asset);
        alert(`Dados vinculados ao ativo ${asset.model} na fase correspondente!`);
        
        // Se for o ativo atual, recarrega a tela de ensaios
        if (ocrAssetId === currentAssetId) {
            loadAssetTestData(currentAssetId);
        }
    });
}

function updateSimPanel() {
    const simTemp = document.getElementById("sim-temp");
    const simComp = document.getElementById("sim-comp");
    const simDate = document.getElementById("sim-date");
    const simTime = document.getElementById("sim-time");
    
    const panelTemp = document.getElementById("panel-disp-temp");
    const panelComp = document.getElementById("panel-disp-comp");
    const panelDateTime = document.getElementById("panel-disp-datetime");
    const ledComp = document.getElementById("led-compressor");
    
    panelTemp.textContent = parseFloat(simTemp.value).toFixed(1);
    
    // Status do compressor
    const compVal = simComp.value;
    panelComp.textContent = compVal.toUpperCase();
    
    ledComp.className = "led";
    if (compVal.includes("Ativo")) {
        ledComp.classList.add("green");
    } else if (compVal.includes("Standby")) {
        ledComp.classList.add("amber");
    } else {
        ledComp.classList.add("red");
    }
    
    // Data e Hora
    const dParts = simDate.value.split('-');
    const dateFormatted = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : "05/07/2026";
    panelDateTime.textContent = `${dateFormatted} ${simTime.value}`;
}

// 7. COMPLIANCE CHECKER (VERIFICADOR DE CONFORMIDADE)
function checkAssetCompliance(asset) {
    let generalCompliance = "CONFORME";
    
    // Critérios:
    // 1. Queda de energia: Checklist obrigatório completo
    const isOutagePassed = asset.outage.completed && 
                           asset.outage.display_on && 
                           asset.outage.logs_saved && 
                           asset.outage.setpoint_saved;
    
    // 2. Porta aberta: reação do alarme rápida (< 90 segundos como limite exemplo)
    const isDoorPassed = asset.door.completed && 
                         asset.door.alarm_delay > 0 && 
                         asset.door.alarm_delay < 90; // Ex: alarme precisa tocar em até 1.5 min
                         
    // 3. Recuperação térmica: retorno ao setpoint com sucesso
    const isRecoveryPassed = asset.recovery.completed && 
                             asset.recovery.end_temp <= asset.setpoint;
                             
    if (!asset.outage.completed || !asset.door.completed || !asset.recovery.completed) {
        generalCompliance = "PENDENTE";
    } else if (!isOutagePassed || !isDoorPassed || !isRecoveryPassed) {
        generalCompliance = "NÃO CONFORME";
    }
    
    asset.compliance = generalCompliance;
    saveToLocalStorage();
}

// 8. CRIAÇÃO DE GRÁFICOS DINÂMICOS (Chart.js)
// Gráfico na aba de Ensaios (Recuperação do Ativo)
function renderRecoveryChart(asset) {
    const ctx = document.getElementById("recoveryTestChart").getContext("2d");
    
    if (recoveryChart) {
        recoveryChart.destroy();
    }
    
    // Gera dados simulados da curva com base em Início e Fim da retomada
    const startTemp = asset.recovery.start_temp || 1.0;
    const endTemp = asset.recovery.end_temp || -20.1;
    const targetTemp = asset.setpoint || -20.0;
    
    // Gera 15 pontos de curva exponencial de resfriamento
    const pointsCount = 12;
    const labels = [];
    const temperatures = [];
    const compressors = [];
    
    const startSec = timeToSeconds(asset.recovery.start);
    const endSec = timeToSeconds(asset.recovery.end);
    const totalSec = endSec > startSec ? (endSec - startSec) : 3984; // 01h 06min 24s por padrão
    
    for (let i = 0; i <= pointsCount; i++) {
        const fraction = i / pointsCount;
        const elapsedSec = fraction * totalSec;
        
        // Calcula horário formatado
        const currSec = startSec + elapsedSec;
        labels.push(secondsToTime(currSec));
        
        // Curva Exponencial: T(t) = T_end + (T_start - T_end) * e^(-k * fraction)
        // Onde no final (fraction=1) deve ser muito próximo do T_end
        const k = 4.0; // Fator de decaimento do resfriamento
        const temp = endTemp + (startTemp - endTemp) * Math.pow(Math.E, -k * fraction);
        temperatures.push(parseFloat(temp.toFixed(1)));
        
        // Compressor ligado durante o resfriamento (100% de esforço)
        compressors.push(1);
    }
    
    recoveryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temperatura Interna (°C)',
                    data: temperatures,
                    borderColor: '#00e5ff',
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#94a3b8' }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// 9. ATUALIZAÇÃO DO DASHBOARD GERAL
function updateDashboard() {
    // Estatísticas
    const totalSpan = document.getElementById("stat-total-ativos");
    const confSpan = document.getElementById("stat-conformes");
    const pendSpan = document.getElementById("stat-testes-pendentes");
    
    const total = assets.length;
    const conformes = assets.filter(a => a.compliance === "CONFORME").length;
    const naoConformes = assets.filter(a => a.compliance === "NÃO CONFORME").length;
    const pendentes = assets.filter(a => a.compliance === "PENDENTE").length;
    
    totalSpan.textContent = total;
    confSpan.textContent = total > 0 ? Math.round((conformes / total) * 100) + "%" : "0%";
    pendSpan.textContent = pendentes;
    
    // Tabela de Ativos
    const tbody = document.getElementById("dashboard-assets-table").querySelector("tbody");
    tbody.innerHTML = "";
    
    if (assets.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Nenhum equipamento cadastrado. Comece adicionando um ativo na aba "Cadastrar Ativo".</td></tr>`;
    } else {
        assets.forEach(asset => {
            const tr = document.createElement("tr");
            
            // Outage Badge
            let outageB = `<span class="badge muted">Pendente</span>`;
            if (asset.outage.completed) {
                const passed = asset.outage.display_on && asset.outage.logs_saved && asset.outage.setpoint_saved;
                outageB = passed ? `<span class="badge success">OK</span>` : `<span class="badge danger">FALHA</span>`;
            }
            
            // Door Badge
            let doorB = `<span class="badge muted">Pendente</span>`;
            if (asset.door.completed) {
                const passed = asset.door.alarm_delay > 0 && asset.door.alarm_delay < 90;
                doorB = passed ? `<span class="badge success">OK (${asset.door.alarm_delay}s)</span>` : `<span class="badge danger">FALHA (${asset.door.alarm_delay}s)</span>`;
            }
            
            // Recovery Badge
            let recB = `<span class="badge muted">Pendente</span>`;
            if (asset.recovery.completed) {
                const passed = asset.recovery.end_temp <= asset.setpoint;
                recB = passed ? `<span class="badge success">OK (${asset.recovery.duration})</span>` : `<span class="badge danger">FALHA</span>`;
            }
            
            // Status Badge
            let statusClass = "muted";
            if (asset.compliance === "CONFORME") statusClass = "success";
            if (asset.compliance === "NÃO CONFORME") statusClass = "danger";
            if (asset.compliance === "PENDENTE") statusClass = "warning";
            const statusB = `<span class="badge ${statusClass}">${asset.compliance}</span>`;
            
            tr.innerHTML = `
                <td><strong>${asset.id}</strong></td>
                <td>${asset.model}</td>
                <td>${outageB}</td>
                <td>${doorB}</td>
                <td>${recB}</td>
                <td>${statusB}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    // Gráfico Geral do Dashboard
    renderDashboardOverviewChart();
}

function renderDashboardOverviewChart() {
    const ctx = document.getElementById("dashboardOverviewChart").getContext("2d");
    if (dashboardChart) {
        dashboardChart.destroy();
    }
    
    const labels = assets.map(a => a.id);
    const alarmReactionTimes = assets.map(a => a.door.alarm_delay || 0);
    const recoveryMinutes = assets.map(a => {
        if (!a.recovery.completed) return 0;
        // Converte string "01h 06min 24s" para minutos decimais
        const parts = a.recovery.duration.match(/\d+/g);
        if (parts && parts.length === 3) {
            return parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2]) / 60;
        }
        return 66.4; // Padrão
    });
    
    dashboardChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Tempo Reação Alarme Porta (s)',
                    data: alarmReactionTimes,
                    backgroundColor: 'rgba(0, 229, 255, 0.7)',
                    borderColor: '#00e5ff',
                    borderWidth: 1,
                    yAxisID: 'y-sec'
                },
                {
                    label: 'Tempo Retomada Temperatura (min)',
                    data: recoveryMinutes,
                    backgroundColor: 'rgba(0, 230, 118, 0.6)',
                    borderColor: '#00e676',
                    borderWidth: 1,
                    yAxisID: 'y-min'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                'y-sec': {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Segundos', color: '#00e5ff' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                'y-min': {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'Minutos', color: '#00e676' },
                    grid: { drawOnChartArea: false }, // avoid grid overlap
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// 10. GERAÇÃO DE RELATÓRIO TÉCNICO (LAUDO)
function generateReportSheet(id) {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    
    // Identificação
    document.getElementById("rep-tag").textContent = asset.id;
    document.getElementById("rep-model").textContent = asset.model;
    document.getElementById("rep-serial").textContent = asset.serial || "--";
    document.getElementById("rep-setpoint").textContent = asset.setpoint.toFixed(1);
    document.getElementById("rep-load").textContent = asset.load;
    
    // Meta data
    document.getElementById("rep-num").textContent = `QD-2026-${id.toUpperCase().substring(0,4)}-01`;
    const today = new Date();
    document.getElementById("rep-date").textContent = today.toLocaleDateString('pt-BR');
    
    // Resumo e Badges
    const badge = document.getElementById("rep-general-badge");
    badge.textContent = asset.compliance;
    badge.className = "compliance-badge";
    
    if (asset.compliance === "CONFORME") {
        badge.classList.add("approved");
    } else if (asset.compliance === "NÃO CONFORME") {
        badge.classList.add("failed");
    }
    
    // Status text
    const statusOutage = document.getElementById("rep-status-energy");
    const statusDoor = document.getElementById("rep-status-door");
    const statusRec = document.getElementById("rep-status-recovery");
    
    if (asset.outage.completed) {
        const passed = asset.outage.display_on && asset.outage.logs_saved && asset.outage.setpoint_saved;
        statusOutage.innerHTML = passed ? '<span class="ok">Conforme (Display Ok, Logs Ok)</span>' : '<span class="nok">Não Conforme (Perda de dados)</span>';
    } else {
        statusOutage.textContent = "Não realizado";
    }
    
    if (asset.door.completed) {
        const passed = asset.door.alarm_delay < 90;
        statusDoor.innerHTML = passed ? `<span class="ok">Conforme (Alarme disparou com ${asset.door.alarm_delay}s)</span>` : `<span class="nok">Não Conforme (Resposta lenta de ${asset.door.alarm_delay}s)</span>`;
    } else {
        statusDoor.textContent = "Não realizado";
    }
    
    if (asset.recovery.completed) {
        const passed = asset.recovery.end_temp <= asset.setpoint;
        statusRec.innerHTML = passed ? `<span class="ok">Conforme (Delta T Ok: ${asset.recovery.duration})</span>` : `<span class="nok">Não Conforme (Estabilizou acima do setpoint em ${asset.recovery.end_temp}°C)</span>`;
    } else {
        statusRec.textContent = "Não realizado";
    }
    
    // Ensaio A: tabela
    document.getElementById("rep-energy-start").textContent = asset.outage.start || "--";
    document.getElementById("rep-energy-end").textContent = asset.outage.end || "--";
    document.getElementById("rep-energy-battery").textContent = asset.outage.display_on ? "Operacional (Mantido)" : "Falhou";
    document.getElementById("rep-energy-logs").textContent = asset.outage.logs_saved ? "Salvo sem perda" : "Com perda";
    document.getElementById("rep-energy-setpoint").textContent = asset.outage.setpoint_saved ? "Retido (-20°C)" : "Resetado";
    
    // Ensaio B: tabela
    document.getElementById("rep-door-start").textContent = asset.door.start || "--";
    document.getElementById("rep-door-end").textContent = asset.door.end || "--";
    document.getElementById("rep-door-alarm").textContent = asset.door.alarm_delay ? `${asset.door.alarm_delay} segundos` : "--";
    document.getElementById("rep-door-result").textContent = asset.door.alarm_delay && asset.door.alarm_delay < 90 ? "Conforme" : "Não Conforme";
    
    // Ensaio C: tabela
    document.getElementById("rep-rec-start").textContent = asset.recovery.start || "--";
    document.getElementById("rep-rec-temp-start").textContent = asset.recovery.start_temp !== undefined ? `${asset.recovery.start_temp} °C` : "--";
    document.getElementById("rep-rec-end").textContent = asset.recovery.end || "--";
    document.getElementById("rep-rec-temp-end").textContent = asset.recovery.end_temp !== undefined ? `${asset.recovery.end_temp} °C` : "--";
    document.getElementById("rep-rec-duration").textContent = asset.recovery.duration || "--";
    document.getElementById("rep-rec-result").textContent = asset.recovery.end_temp <= asset.setpoint ? "Conforme" : "Não Conforme";
    
    // Texto de Conclusão Dinâmico
    const conc = document.getElementById("rep-conclusion-text");
    if (asset.compliance === "CONFORME") {
        conc.textContent = `Conclui-se que o equipamento ${asset.model} (Ativo ${asset.id}, Número de Série ${asset.serial || '--'}) atendeu a todos os critérios de aceitação do estudo de Qualificação de Desempenho (QD) térmica no dia de teste. A bateria do display demonstrou autonomia ativa e retenção total da memória de setpoint no estudo de queda de energia de 10 min. O alarme disparou dentro do limite operacional de segurança em ${asset.door.alarm_delay}s no estudo de porta aberta, e a taxa de retomada de temperatura retornou e se estabilizou no setpoint programado em ${asset.recovery.duration}. O equipamento encontra-se APROVADO para uso clínico e laboratorial.`;
    } else if (asset.compliance === "NÃO CONFORME") {
        conc.textContent = `Conclui-se que o equipamento ${asset.model} (Ativo ${asset.id}) NÃO atendeu a todos os critérios de aceitação térmica para Qualificação de Desempenho (QD) no dia de teste. Foram encontradas inconformidades no tempo de reação do alarme de porta aberta ou na autonomia de bateria durante a interrupção simulada de rede elétrica. O equipamento necessita de inspeção técnica preventiva da equipe de engenharia clínica antes da liberação para armazenamento de insumos biológicos críticos.`;
    } else {
        conc.textContent = `A qualificação técnica do equipamento ${asset.model} (Ativo ${asset.id}) está PENDENTE. É necessária a realização de todos os ensaios descritos no memorial de ensaio para emissão de um parecer de conformidade final.`;
    }
    
    // Gráfico de Relatório (Imagem Estática para Impressão)
    renderReportChart(asset);
}

function renderReportChart(asset) {
    const ctx = document.getElementById("reportChartImageCanvas").getContext("2d");
    if (reportChart) {
        reportChart.destroy();
    }
    
    const startTemp = asset.recovery.start_temp || 1.0;
    const endTemp = asset.recovery.end_temp || -20.1;
    
    const labels = [];
    const temperatures = [];
    
    const startSec = timeToSeconds(asset.recovery.start || "15:53:24");
    const endSec = timeToSeconds(asset.recovery.end || "16:59:48");
    const totalSec = endSec > startSec ? (endSec - startSec) : 3984;
    
    const pointsCount = 10;
    for (let i = 0; i <= pointsCount; i++) {
        const fraction = i / pointsCount;
        const elapsedSec = fraction * totalSec;
        const currSec = startSec + elapsedSec;
        
        labels.push(secondsToTime(currSec).substring(0, 5)); // Apenas HH:MM
        
        // Curva Exponencial
        const k = 4.0;
        const temp = endTemp + (startTemp - endTemp) * Math.pow(Math.E, -k * fraction);
        temperatures.push(parseFloat(temp.toFixed(1)));
    }
    
    reportChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Curva de Retomada de Temperatura (°C)',
                data: temperatures,
                borderColor: '#2b6cb0',
                backgroundColor: 'rgba(43, 108, 176, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // desabilita animações para garantir impressão correta
            plugins: {
                legend: { labels: { color: '#2d3748' } }
            },
            scales: {
                x: { ticks: { color: '#4a5568' }, grid: { color: '#e2e8f0' } },
                y: { ticks: { color: '#4a5568' }, grid: { color: '#e2e8f0' } }
            }
        }
    });
}

// 11. HELPERS MATEMÁTICOS DE TEMPO
function timeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(":");
    if (parts.length !== 3) return 0;
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
}

function secondsToTime(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600) % 24;
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    
    return (
        (hrs < 10 ? "0" + hrs : hrs) + ":" +
        (mins < 10 ? "0" + mins : mins) + ":" +
        (secs < 10 ? "0" + secs : secs)
    );
}

function calculateTimeDiff(start, end) {
    const startSec = timeToSeconds(start);
    let endSec = timeToSeconds(end);
    
    if (endSec < startSec) {
        endSec += 24 * 3600; // Tratamento de virada de dia
    }
    
    const diffSec = endSec - startSec;
    const hrs = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    
    return (
        (hrs < 10 ? "0" + hrs : hrs) + "h " +
        (mins < 10 ? "0" + mins : mins) + "min " +
        (secs < 10 ? "0" + secs : secs) + "s"
    );
}
