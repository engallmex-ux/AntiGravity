// PID Controller Class
class PIDController {
    constructor(kp, ki, kd, minVal, maxVal) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;
        this.minVal = minVal;
        this.maxVal = maxVal;
        this.integral = 0;
        this.lastError = 0;
    }

    update(sp, pv, dt) {
        let error = sp - pv;
        this.integral += error * dt;
        // Clamp integral to prevent windup
        let maxIntegralLimit = this.maxVal / (this.ki || 1);
        this.integral = Math.max(Math.min(this.integral, maxIntegralLimit), -maxIntegralLimit);
        
        let derivative = (error - this.lastError) / dt;
        this.lastError = error;
        
        let output = (this.kp * error) + (this.ki * this.integral) + (this.kd * derivative);
        return Math.max(Math.min(output, this.maxVal), this.minVal);
    }
}

// Plant state data
const plant = {
    moenda: {
        id: 'moenda',
        name: 'Moenda (M1)',
        powered: true,
        controlMode: 'AUTO', // AUTO or MAN
        sp: 60.0, // setpoint rpm
        pv: 0.0,  // current rpm
        min: 0, max: 100, unit: 'rpm',
        pid: new PIDController(1.2, 0.5, 0.1, 0, 100),
        valName: 'Velocidade',
        targetName: 'Velocidade Alvo'
    },
    caldeira: {
        id: 'caldeira',
        name: 'Caldeira (B1)',
        powered: true,
        controlMode: 'AUTO',
        sp: 40.0, // setpoint pressure bar
        pv: 25.0,  // current pressure bar
        min: 0, max: 60, unit: 'bar',
        pid: new PIDController(1.5, 0.8, 0.2, 0, 100), // output controls fuel feed
        valName: 'Pressão',
        targetName: 'Pressão Alvo'
    },
    clarificador: {
        id: 'clarificador',
        name: 'Decantador (C1)',
        powered: true,
        controlMode: 'AUTO',
        sp: 95.0, // setpoint temperature °C
        pv: 20.0,  // current temperature °C
        min: 0, max: 120, unit: '°C',
        pid: new PIDController(2.0, 0.4, 0.1, 0, 100), // output controls steam valve
        valName: 'Temperatura',
        targetName: 'Temperatura Alvo'
    },
    evaporador: {
        id: 'evaporador',
        name: 'Evaporador (E1)',
        powered: true,
        controlMode: 'AUTO',
        sp: 65.0, // setpoint Brix
        pv: 15.0,  // current Brix
        min: 0, max: 80, unit: '°Bx',
        pid: new PIDController(0.8, 0.3, 0.05, 0, 100),
        valName: 'Concentração (Brix)',
        targetName: 'Brix Alvo'
    },
    cristalizador: {
        id: 'cristalizador',
        name: 'Cozedor (V1)',
        powered: true,
        controlMode: 'AUTO',
        sp: 75.0, // setpoint level %
        pv: 10.0,  // current level %
        min: 0, max: 100, unit: '%',
        pid: new PIDController(1.0, 0.2, 0.0, 0, 100),
        valName: 'Nível da Massa',
        targetName: 'Nível Alvo'
    },
    fermentacao: {
        id: 'fermentacao',
        name: 'Fermentação (T1)',
        powered: true,
        controlMode: 'AUTO',
        sp: 32.0, // setpoint temp °C (ideal is 30-34)
        pv: 28.0,  // current temp °C
        min: 15, max: 45, unit: '°C',
        pid: new PIDController(2.5, 0.6, 0.1, 0, 100), // controls cooling water flow
        valName: 'Temperatura Cubas',
        targetName: 'Temperatura Alvo'
    },
    destilacao: {
        id: 'destilacao',
        name: 'Destilaria (D1)',
        powered: true,
        controlMode: 'AUTO',
        sp: 12000, // setpoint ethanol flow L/h
        pv: 0.0,
        min: 0, max: 18000, unit: 'L/h',
        pid: new PIDController(0.5, 0.2, 0.05, 0, 100),
        valName: 'Vazão Etanol',
        targetName: 'Vazão Alvo'
    }
};

// State variables for overall plant outputs
let overallOee = 88.5;
let bagacoStock = 500; // in kg
let activeAlarms = [];
let alarmHistory = [];
const eventLog = [];

// Chart configuration
let trendChart;
const maxDataPoints = 30;
const chartLabels = Array.from({length: maxDataPoints}, (_, i) => `${maxDataPoints - i}s atrás`);
const chartData = {
    moagem: Array(maxDataPoints).fill(0),
    pressao: Array(maxDataPoints).fill(0),
    brix: Array(maxDataPoints).fill(0),
    etanol: Array(maxDataPoints).fill(0)
};

// Initial setup
window.onload = function() {
    initClock();
    initChart();
    loadMachineConfig('moenda');
    logEvent("SISTEMA SCADA INICIALIZADO - CONEXÃO PLC ESTABELECIDA");
    logEvent("Modo de Simulação Física Industrial ativo.");
    
    // Start simulation loop (every 1 second)
    setInterval(simulationTick, 1000);
};

// Tabs switcher
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabId).classList.add('active');
    // Find button containing click listener
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
    if (btn) btn.classList.add('active');
}

// Open specific machine from SVG and switch tab to Control Panel
function openMachine(machineId) {
    switchTab('controle');
    document.getElementById('machine-select').value = machineId;
    loadMachineConfig(machineId);
}

// Update clock
function initClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('system-time').innerText = now.toLocaleTimeString('pt-BR');
    }, 1000);
}

// Log message to event console
function logEvent(msg) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const logBox = document.getElementById('event-log');
    eventLog.unshift(`[${timestamp}] ${msg}`);
    
    // Keep max 50 log lines
    if (eventLog.length > 50) eventLog.pop();
    
    logBox.innerHTML = eventLog.map(line => `<div>${line}</div>`).join('');
}

// Initialize Trend Chart
function initChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: 'Moagem (Ton/h)',
                    data: chartData.moagem,
                    borderColor: '#00f0ff',
                    backgroundColor: 'rgba(0, 240, 255, 0.05)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Pressão Caldeira (bar)',
                    data: chartData.pressao,
                    borderColor: '#ffb800',
                    backgroundColor: 'rgba(255, 184, 0, 0.05)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y1'
                },
                {
                    label: 'Brix Evaporador (°Bx)',
                    data: chartData.brix,
                    borderColor: '#bd00ff',
                    backgroundColor: 'rgba(189, 0, 255, 0.05)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y2'
                },
                {
                    label: 'Vazão Etanol (L/h)',
                    data: chartData.etanol,
                    borderColor: '#00ff87',
                    backgroundColor: 'rgba(0, 255, 135, 0.05)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y3'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#00f0ff' },
                    title: { display: true, text: 'Moagem (Ton/h)', color: '#00f0ff' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#ffb800' },
                    title: { display: true, text: 'Caldeira (bar)', color: '#ffb800' }
                },
                y2: {
                    type: 'linear',
                    display: false,
                    ticks: { color: '#bd00ff' }
                },
                y3: {
                    type: 'linear',
                    display: false,
                    ticks: { color: '#00ff87' }
                }
            }
        }
    });
}

// Add data point to chart
function updateChart(moagem, pressao, brix, etanol) {
    chartData.moagem.push(moagem);
    chartData.pressao.push(pressao);
    chartData.brix.push(brix);
    chartData.etanol.push(etanol);
    
    // Shift arrays
    chartData.moagem.shift();
    chartData.pressao.shift();
    chartData.brix.shift();
    chartData.etanol.shift();
    
    trendChart.update();
}

// Load configurations for selected machine in control tab
function loadMachineConfig(machineId) {
    const m = plant[machineId];
    document.getElementById('machine-select').value = machineId;
    
    // Power button styling
    const btnPower = document.getElementById('btn-machine-power');
    const lblPower = document.getElementById('lbl-machine-power');
    if (m.powered) {
        btnPower.className = "btn-power active";
        lblPower.innerText = "LIGADO";
    } else {
        btnPower.className = "btn-power";
        lblPower.innerText = "DESLIGADO";
    }
    
    // Mode selectors
    const btnAuto = document.getElementById('btn-mode-auto');
    const btnManual = document.getElementById('btn-mode-manual');
    if (m.controlMode === 'AUTO') {
        btnAuto.className = "mode-btn active";
        btnManual.className = "mode-btn";
    } else {
        btnAuto.className = "mode-btn";
        btnManual.className = "mode-btn active";
    }
    
    // Tuning sliders
    document.getElementById('slider-kp').value = m.pid.kp;
    document.getElementById('slider-ki').value = m.pid.ki;
    document.getElementById('slider-kd').value = m.pid.kd;
    document.getElementById('val-kp').innerText = m.pid.kp.toFixed(2);
    document.getElementById('val-ki').innerText = m.pid.ki.toFixed(2);
    document.getElementById('val-kd').innerText = m.pid.kd.toFixed(2);
    
    // PID values display
    document.getElementById('pid-sp').innerText = `${m.sp.toFixed(1)} ${m.unit}`;
    document.getElementById('pid-pv').innerText = `${m.pv.toFixed(1)} ${m.unit}`;
    
    // Dynamic control sliders (Setpoint/Manual Manipulated Value)
    const container = document.getElementById('dynamic-sliders');
    
    let sliderHtml = `
        <div class="slider-group" style="margin-top: 1.5rem;">
            <div class="slider-label">
                <span>${m.controlMode === 'AUTO' ? m.targetName : 'Válvula de Controle / MV (%)'}</span>
                <span class="slider-val"><span id="lbl-control-val">${m.controlMode === 'AUTO' ? m.sp : (m.mv || 50)}</span> ${m.controlMode === 'AUTO' ? m.unit : '%'}</span>
            </div>
            <input type="range" id="control-val-slider" 
                min="${m.controlMode === 'AUTO' ? m.min : 0}" 
                max="${m.controlMode === 'AUTO' ? m.max : 100}" 
                step="${m.controlMode === 'AUTO' ? (m.max - m.min > 100 ? 10 : 1) : 1}"
                value="${m.controlMode === 'AUTO' ? m.sp : (m.mv || 50)}" 
                oninput="adjustControlValue(this.value)">
        </div>
    `;
    container.innerHTML = sliderHtml;
}

// Adjust control values (either Setpoint or manual Manipulated Variable)
function adjustControlValue(val) {
    const activeMachine = document.getElementById('machine-select').value;
    const m = plant[activeMachine];
    
    if (m.controlMode === 'AUTO') {
        m.sp = parseFloat(val);
        document.getElementById('lbl-control-val').innerText = m.sp;
        document.getElementById('pid-sp').innerText = `${m.sp.toFixed(1)} ${m.unit}`;
    } else {
        m.mv = parseFloat(val);
        document.getElementById('lbl-control-val').innerText = m.mv;
    }
}

// Toggle Machine Power (Start/Stop)
function toggleMachinePower() {
    const activeMachine = document.getElementById('machine-select').value;
    const m = plant[activeMachine];
    
    m.powered = !m.powered;
    logEvent(`${m.name.toUpperCase()} - COMANDO ENVIADO: ${m.powered ? 'INICIAR' : 'DESLIGAR'}`);
    loadMachineConfig(activeMachine);
}

// Set Control Mode (Auto / Manual)
function setControlMode(mode) {
    const activeMachine = document.getElementById('machine-select').value;
    const m = plant[activeMachine];
    
    m.controlMode = mode;
    logEvent(`${m.name.toUpperCase()} - MODO DE CONTROLE ALTERADO PARA: ${mode}`);
    loadMachineConfig(activeMachine);
}

// Update PID tuning coefficients
function updatePIDTuning() {
    const activeMachine = document.getElementById('machine-select').value;
    const m = plant[activeMachine];
    
    const kp = parseFloat(document.getElementById('slider-kp').value);
    const ki = parseFloat(document.getElementById('slider-ki').value);
    const kd = parseFloat(document.getElementById('slider-kd').value);
    
    m.pid.kp = kp;
    m.pid.ki = ki;
    m.pid.kd = kd;
    
    document.getElementById('val-kp').innerText = kp.toFixed(2);
    document.getElementById('val-ki').innerText = ki.toFixed(2);
    document.getElementById('val-kd').innerText = kd.toFixed(2);
}

// Industrial Simulation Engine (Runs every 1 second)
function simulationTick() {
    const dt = 1.0; // 1 second step
    
    // ----------------------------------------------------
    // 1. MOENDA SIMULATION
    // ----------------------------------------------------
    if (plant.moenda.powered) {
        if (plant.moenda.controlMode === 'AUTO') {
            // Speed slowly moves towards Setpoint
            let output = plant.moenda.pid.update(plant.moenda.sp, plant.moenda.pv, dt);
            // Simulate motor inertia: PV moves towards speed regulated by PID
            plant.moenda.pv += (output - plant.moenda.pv) * 0.15;
        } else {
            // Manual Mode: speed relies directly on manual manipulated variable (MV)
            let target = (plant.moenda.mv || 50) / 100 * plant.moenda.max;
            plant.moenda.pv += (target - plant.moenda.pv) * 0.15;
        }
    } else {
        plant.moenda.pv += (0 - plant.moenda.pv) * 0.3; // Coasting to stop
    }
    
    let currentMoagem = plant.moenda.pv * 1.8; // convert rpm to Ton/h
    let caldoFlow = plant.moenda.pv * 0.95; // L/s juice extracted
    
    // Bagaço production (fuel for Caldeira)
    let generatedBagaco = currentMoagem * 0.28 * 0.27; // Ton bagaço per sec equivalent
    bagacoStock += generatedBagaco * 1000; // convert to kg
    if (bagacoStock > 10000) bagacoStock = 10000; // max warehouse space

    // ----------------------------------------------------
    // 2. CALDEIRA SIMULATION
    // ----------------------------------------------------
    if (plant.caldeira.powered) {
        // Fuel feed rate
        let fuelFeed = 0;
        if (bagacoStock > 5) {
            if (plant.caldeira.controlMode === 'AUTO') {
                let output = plant.caldeira.pid.update(plant.caldeira.sp, plant.caldeira.pv, dt);
                fuelFeed = output / 100; // fuel feed rate percentage
            } else {
                fuelFeed = (plant.caldeira.mv || 50) / 100;
            }
            // Consume bagaço from stock
            let consumed = fuelFeed * 15; // kg consumed per second
            bagacoStock -= consumed;
            if (bagacoStock < 0) bagacoStock = 0;
            
            // Pressure increases based on fuel feed, decreases based on steam consumption
            let steamConsumption = (plant.clarificador.pv * 0.05) + (plant.evaporador.pv * 0.08);
            plant.caldeira.pv += (fuelFeed * 12 - steamConsumption) * 0.1;
        } else {
            // No fuel
            plant.caldeira.pv -= 0.5; // Pressure drops
        }
    } else {
        plant.caldeira.pv -= 0.8; // Natural cooling
    }
    plant.caldeira.pv = Math.max(0, plant.caldeira.pv);

    // ----------------------------------------------------
    // 3. CLARIFICADOR SIMULATION (JUICE HEATING & SETTLING)
    // ----------------------------------------------------
    if (plant.clarificador.powered && caldoFlow > 0) {
        // Target is 95-105 °C to coagulate proteins
        let steamAvailable = plant.caldeira.pv / plant.caldeira.max;
        if (plant.clarificador.controlMode === 'AUTO') {
            let output = plant.clarificador.pid.update(plant.clarificador.sp, plant.clarificador.pv, dt);
            // Temp increases with steam flow (output) and decreases with raw juice cooling flow
            plant.clarificador.pv += (output/100 * steamAvailable * 20 - (caldoFlow * 0.1)) * 0.1;
        } else {
            let valveOpen = (plant.clarificador.mv || 50) / 100;
            plant.clarificador.pv += (valveOpen * steamAvailable * 20 - (caldoFlow * 0.1)) * 0.1;
        }
    } else {
        plant.clarificador.pv += (25 - plant.clarificador.pv) * 0.05; // Cool to ambient temp
    }
    plant.clarificador.pv = Math.max(15, plant.clarificador.pv);

    // ----------------------------------------------------
    // 4. EVAPORADOR SIMULATION (BRIX INCREASE)
    // ----------------------------------------------------
    if (plant.evaporador.powered && caldoFlow > 0) {
        // Evaporation rate depends on temperature of decanted juice and steam pressure
        let steamPressure = plant.caldeira.pv;
        let evaporationEfficiency = (plant.clarificador.pv / 95) * (steamPressure / 40);
        
        let targetBrix = plant.evaporador.sp;
        let baseBrix = 14.5; // raw juice brix
        
        if (plant.evaporador.controlMode === 'AUTO') {
            // Regulate inflow valve to achieve target outlet Brix
            let output = plant.evaporador.pid.update(targetBrix, plant.evaporador.pv, dt);
            plant.evaporador.pv += (baseBrix + (evaporationEfficiency * 50) - plant.evaporador.pv) * 0.08;
        } else {
            let valveOpen = (plant.evaporador.mv || 50) / 100;
            plant.evaporador.pv += (baseBrix + (evaporationEfficiency * valveOpen * 60) - plant.evaporador.pv) * 0.08;
        }
    } else {
        plant.evaporador.pv += (0 - plant.evaporador.pv) * 0.15;
    }
    plant.evaporador.pv = Math.min(80, Math.max(0, plant.evaporador.pv));

    // ----------------------------------------------------
    // 5. CRISTALIZADOR SIMULATION (LEVEL / CRYSTAL MASS)
    // ----------------------------------------------------
    if (plant.cristalizador.powered && plant.evaporador.pv > 50) {
        // High Brix feed enables crystallization
        let feedRate = (plant.evaporador.pv / 65) * caldoFlow;
        if (plant.cristalizador.controlMode === 'AUTO') {
            let output = plant.cristalizador.pid.update(plant.cristalizador.sp, plant.cristalizador.pv, dt);
            // Centrifuge discharge rate matches output control
            let discharge = (100 - output) / 100 * 5.0; 
            plant.cristalizador.pv += (feedRate * 0.8 - discharge) * 0.15;
        } else {
            let discharge = (plant.cristalizador.mv || 50) / 100 * 6.0;
            plant.cristalizador.pv += (feedRate * 0.8 - discharge) * 0.15;
        }
    } else {
        // Natural discharge or sedimentation
        plant.cristalizador.pv += (0 - plant.cristalizador.pv) * 0.05;
    }
    plant.cristalizador.pv = Math.min(100, Math.max(0, plant.cristalizador.pv));

    // ----------------------------------------------------
    // 6. FERMENTAÇÃO SIMULATION
    // ----------------------------------------------------
    if (plant.fermentacao.powered) {
        // Yeast reaction produces biological heat
        let reactionHeat = (plant.evaporador.pv > 5) ? 2.5 : 0.1;
        // Coolant water flow lowers temperature
        let coolantFlow = 0;
        if (plant.fermentacao.controlMode === 'AUTO') {
            let output = plant.fermentacao.pid.update(plant.fermentacao.pv, plant.fermentacao.sp, dt); // reverse acting
            coolantFlow = output / 100;
        } else {
            coolantFlow = (plant.fermentacao.mv || 50) / 100;
        }
        
        plant.fermentacao.pv += (reactionHeat - (coolantFlow * 3.5)) * 0.15;
    } else {
        plant.fermentacao.pv += (25 - plant.fermentacao.pv) * 0.02;
    }

    // ----------------------------------------------------
    // 7. DESTILARIA SIMULATION (ETHANOL FLOW)
    // ----------------------------------------------------
    if (plant.destilacao.powered && plant.fermentacao.pv > 28 && plant.fermentacao.pv < 36) {
        // Distillation works if wash is viable (ideal fermentation temp range)
        let steamAvailable = plant.caldeira.pv / 40.0;
        let washVolume = caldoFlow * 0.8;
        if (plant.destilacao.controlMode === 'AUTO') {
            let output = plant.destilacao.pid.update(plant.destilacao.sp, plant.destilacao.pv, dt);
            let targetFlow = plant.destilacao.sp;
            plant.destilacao.pv += (targetFlow * steamAvailable - plant.destilacao.pv) * 0.2;
        } else {
            let targetFlow = (plant.destilacao.mv || 50) / 100 * plant.destilacao.max;
            plant.destilacao.pv += (targetFlow * steamAvailable - plant.destilacao.pv) * 0.2;
        }
    } else {
        plant.destilacao.pv += (0 - plant.destilacao.pv) * 0.3;
    }
    plant.destilacao.pv = Math.max(0, plant.destilacao.pv);

    // ----------------------------------------------------
    // UPDATE GENERAL KPIS & UI
    // ----------------------------------------------------
    document.getElementById('kpi-moagem').innerText = currentMoagem.toFixed(1);
    document.getElementById('kpi-caldo').innerText = caldoFlow.toFixed(1);
    document.getElementById('kpi-pressao').innerText = plant.caldeira.pv.toFixed(1);
    
    // OEE fluctuates based on plant stability and active alarms
    let oeePenalty = activeAlarms.length * 4.5;
    overallOee = 93.2 - oeePenalty + (Math.random() * 0.6 - 0.3);
    overallOee = Math.max(40, Math.min(99.5, overallOee));
    document.getElementById('kpi-oee').innerText = overallOee.toFixed(1);

    // Inline SVG P&ID telemetry updating
    document.getElementById('txt-speed-moenda').textContent = `${Math.round(plant.moenda.pv)} rpm`;
    document.getElementById('txt-pressure-caldeira').textContent = `${plant.caldeira.pv.toFixed(1)} bar`;
    document.getElementById('txt-temp-clarificador').textContent = `${Math.round(plant.clarificador.pv)} °C`;
    document.getElementById('txt-brix-evaporador').textContent = `${plant.evaporador.pv.toFixed(1)} °Bx`;
    document.getElementById('txt-level-cristalizador').textContent = `${Math.round(plant.cristalizador.pv)} %`;
    document.getElementById('txt-temp-fermentacao').textContent = `${plant.fermentacao.pv.toFixed(1)} °C`;
    document.getElementById('txt-flow-etanol').textContent = `${Math.round(plant.destilacao.pv)} L/h`;

    // Dynamic pipe animation speeds based on flow
    updatePipeSpeeds(caldoFlow, plant.caldeira.pv, plant.evaporador.pv, plant.destilacao.pv);

    // Update active control panel labels if current active machine tab is open
    const activeMachine = document.getElementById('machine-select').value;
    const m = plant[activeMachine];
    document.getElementById('pid-pv').innerText = `${m.pv.toFixed(1)} ${m.unit}`;

    // Update Chart
    updateChart(currentMoagem, plant.caldeira.pv, plant.evaporador.pv, plant.destilacao.pv);

    // Trigger Alarm Checks
    checkAlarms();
}

// Adjust SVG dashed flow speed dynamically
function updatePipeSpeeds(caldoFlow, steamPressure, brix, ethanolFlow) {
    const setFlowSpeed = (className, rate, maxRate) => {
        const pipes = document.querySelectorAll('.' + className);
        pipes.forEach(pipe => {
            if (rate <= 0.5) {
                pipe.style.animation = 'none'; // Stop flow
            } else {
                // Map flow to animation speed (higher flow = shorter duration)
                let pct = rate / maxRate;
                let duration = 8 - (pct * 6); // between 2s and 8s
                pipe.style.animation = `flow ${duration.toFixed(1)}s linear infinite`;
            }
        });
    };

    setFlowSpeed('flow-juice', caldoFlow, plant.moenda.pv * 0.95);
    setFlowSpeed('flow-steam', steamPressure, 60);
    setFlowSpeed('flow-syrup', brix, 80);
    setFlowSpeed('flow-water', ethanolFlow, 18000);
    
    // Rotate spinning nodes
    const mills = document.querySelectorAll('.spinning');
    mills.forEach(mill => {
        if (plant.moenda.pv <= 1) {
            mill.style.animationPlayState = 'paused';
        } else {
            mill.style.animationPlayState = 'running';
            // Adjust speed of rotation
            let speed = 100 / plant.moenda.pv; // 1s at 100rpm, 10s at 10rpm
            mill.style.animationDuration = `${speed.toFixed(1)}s`;
        }
    });
}

// ----------------------------------------------------
// ALARMS SYSTEM LÓGICA
// ----------------------------------------------------
function triggerAlarm(id, description, severity, machine) {
    // Check if alarm already active
    if (activeAlarms.some(a => a.id === id)) return;
    
    const alarm = {
        id: id,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        description: description,
        severity: severity,
        machine: machine,
        acked: false
    };
    
    activeAlarms.push(alarm);
    alarmHistory.unshift(alarm); // insert at top of history
    logEvent(`ALARME DISPARADO [${severity.toUpperCase()}]: ${description} (${machine})`);
    
    // Add audio feedback if available or visual signals
    const caldeiraStatus = document.getElementById('kpi-caldeira-status');
    if (machine === 'Caldeira (B1)' && severity === 'critico') {
        caldeiraStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--neon-red);"></i> <span style="color: var(--neon-red); font-weight: bold;">CRÍTICO: PRESSÃO</span>`;
    }
    
    renderAlarms();
}

function resolveAlarm(id) {
    const alarmIndex = activeAlarms.findIndex(a => a.id === id);
    if (alarmIndex === -1) return;
    
    const alarm = activeAlarms[alarmIndex];
    activeAlarms.splice(alarmIndex, 1);
    
    logEvent(`ALARME NORMALIZADO: ${alarm.description}`);
    
    // Revert visual indicators
    if (alarm.machine === 'Caldeira (B1)') {
        document.getElementById('kpi-caldeira-status').innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>Operação Normal</span>`;
    }
    
    renderAlarms();
}

function checkAlarms() {
    // 1. Caldeira Pressure Alarms
    if (plant.caldeira.pv > 52.0) {
        triggerAlarm('p_caldeira_crit', 'Pressão da Caldeira Crítica - Alívio Necessário!', 'critico', 'Caldeira (B1)');
    } else if (plant.caldeira.pv > 44.0) {
        triggerAlarm('p_caldeira_warn', 'Pressão da Caldeira Elevada', 'aviso', 'Caldeira (B1)');
    } else {
        resolveAlarm('p_caldeira_crit');
        if (plant.caldeira.pv < 40.0) resolveAlarm('p_caldeira_warn');
    }
    
    // 2. Fermentação Temp Alarms
    if (plant.fermentacao.pv > 38.0) {
        triggerAlarm('t_ferment_crit', 'Temperatura Fermentação Crítica - Risco de Perda das Leveduras!', 'critico', 'Fermentação (T1)');
    } else if (plant.fermentacao.pv > 35.0) {
        triggerAlarm('t_ferment_warn', 'Temperatura da Fermentação Elevada', 'aviso', 'Fermentação (T1)');
    } else {
        resolveAlarm('t_ferment_crit');
        if (plant.fermentacao.pv < 33.0) resolveAlarm('t_ferment_warn');
    }

    // 3. Cristalizador Low Level Alarm
    if (plant.cristalizador.pv > 92.0) {
        triggerAlarm('l_cristal_high', 'Nível de Massa do Cozedor Elevado - Risco de Transbordo', 'aviso', 'Cozedor (V1)');
    } else {
        resolveAlarm('l_cristal_high');
    }
}

function renderAlarms() {
    const tbody = document.getElementById('alarm-tbody');
    const badge = document.getElementById('alarm-badge-count');
    
    // Update badge count
    if (activeAlarms.length > 0) {
        badge.style.display = 'inline-block';
        badge.innerText = activeAlarms.length;
    } else {
        badge.style.display = 'none';
    }
    
    // Render list combining active and recent historical alarms
    const allList = [...activeAlarms, ...alarmHistory.filter(h => !activeAlarms.some(a => a.id === h.id))].slice(0, 15);
    
    if (allList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Nenhum alarme ou evento registrado.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = allList.map(a => {
        const isActive = activeAlarms.some(active => active.id === a.id);
        const severityClass = a.severity === 'critico' ? 'badge-critical' : 'badge-warning';
        const statusBadge = isActive ? `<span class="alarm-badge ${severityClass}">ATIVO</span>` : `<span class="alarm-badge badge-resolved">NORMALIZADO</span>`;
        const rowClass = isActive ? 'alarm-row active' : 'alarm-row';
        const ackBtn = isActive ? `<button class="btn-ack" onclick="acknowledge('${a.id}')">Reconhecer</button>` : `<span style="color: var(--neon-green); font-size: 0.8rem;"><i class="fa-solid fa-check"></i> Ok</span>`;
        
        return `
            <tr class="${rowClass}">
                <td>${statusBadge}</td>
                <td>${a.timestamp}</td>
                <td style="font-weight: 600;">${a.machine}</td>
                <td>${a.description}</td>
                <td style="font-weight: 500; color: ${a.severity === 'critico' ? 'var(--neon-red)' : 'var(--neon-orange)'};">${a.severity.toUpperCase()}</td>
                <td>${ackBtn}</td>
            </tr>
        `;
    }).join('');
}

function acknowledge(id) {
    const alarm = activeAlarms.find(a => a.id === id);
    if (alarm) {
        alarm.acked = true;
        logEvent(`ALARME RECONHECIDO PELO OPERADOR: ${alarm.description}`);
    }
    // Remove from active list if resolved but still active visually
    // In this simplified system, acknowledge just logs the operator awareness.
    renderAlarms();
}

function acknowledgeAll() {
    activeAlarms.forEach(a => a.acked = true);
    logEvent(`TODOS OS ALARMES ATIVOS FORAM RECONHECIDOS`);
    renderAlarms();
}
