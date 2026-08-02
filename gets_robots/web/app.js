document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    const titles = {
        'tab-agents': { title: '🤖 Central de Controle da Equipe de Agentes', sub: 'Disparo real dos robôs Playwright de leitura e varredura do portal GETS.' },
        'tab-mapper': { title: '🌐 Mapeador Cartógrafo de Telas', sub: 'Engenharia reversa das rotas, captura de Print Screens PNG e seletores HTML.' }
    };

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            navButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            if (titles[tabId]) {
                pageTitle.textContent = titles[tabId].title;
                pageSubtitle.textContent = titles[tabId].sub;
            }
        });
    });

    // Form Mapper Submit
    const formMapper = document.getElementById('form-mapper');
    formMapper.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            target_url: document.getElementById('map-url').value,
            username: document.getElementById('map-user').value,
            password: document.getElementById('map-pass').value,
            max_pages: parseInt(document.getElementById('map-pages').value),
            scan_mode: document.getElementById('map-mode').value,
            headless: !document.getElementById('map-visible').checked
        };

        try {
            const res = await fetch('/api/mapper/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            addLog(`[🚀] Iniciando robô Playwright real: ${payload.target_url}`);
            startPollingStatus();
        } catch (err) {
            addLog(`[❌] Erro ao iniciar robô: ${err.message}`);
        }
    });

    const btnStopMapper = document.getElementById('btn-stop-mapper');
    if (btnStopMapper) {
        btnStopMapper.addEventListener('click', async () => {
            try {
                await fetch('/api/mapper/stop', { method: 'POST' });
                addLog('[🛑] Solicitada interrupção do mapeamento pelo usuário...');
            } catch (err) {
                addLog(`[❌] Erro ao parar robô: ${err.message}`);
            }
        });
    }

    let pollInterval = null;
    function startPollingStatus() {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();

                if (!data.running && data.percentage === 0.0) {
                    document.getElementById('prog-percent').textContent = '0.0%';
                    document.getElementById('prog-fill').style.width = '0%';
                    document.getElementById('prog-status').textContent = 'Inativo (Aguardando início...)';
                    document.getElementById('prog-visited').textContent = '0';
                    document.getElementById('prog-total').textContent = '0';
                    document.getElementById('prog-transitions').textContent = '0';
                } else {
                    document.getElementById('prog-percent').textContent = `${data.percentage.toFixed(1)}%`;
                    document.getElementById('prog-fill').style.width = `${data.percentage}%`;
                    document.getElementById('prog-status').textContent = data.status;
                    document.getElementById('prog-visited').textContent = data.visited;
                    document.getElementById('prog-total').textContent = data.total;
                }

                if (data.log_line) addLog(data.log_line);

                const badge = document.getElementById('robot-running-badge');
                if (data.running) {
                    badge.classList.add('running');
                    badge.innerHTML = '<span class="pulse"></span> Robô Em Execução';
                } else {
                    badge.classList.remove('running');
                    badge.innerHTML = '<span class="pulse"></span> Robô Inativo';
                }
            } catch (err) {}
        }, 1000);
    }

    let lastLogMsg = '';
    function addLog(msg) {
        if (!msg || msg === lastLogMsg) return;
        lastLogMsg = msg;
        const consoleEl = document.getElementById('log-output');
        if (consoleEl) {
            consoleEl.textContent += `\n[${new Date().toLocaleTimeString()}] ${msg}`;
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
        const agentsConsole = document.getElementById('agents-log-output');
        if (agentsConsole) {
            agentsConsole.textContent += `\n[${new Date().toLocaleTimeString()}] ${msg}`;
            agentsConsole.scrollTop = agentsConsole.scrollHeight;
        }
    }

    window.runSingleRobot = async function(robotId) {
        try {
            addLog(`[🤖 Central] Disparando Robô ${robotId} em modo visível...`);
            const res = await fetch('/api/robot/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ robot_id: robotId })
            });
            const data = await res.json();
            addLog(`[✅ Central] Robô ${robotId} iniciado com sucesso!`);
            startPollingStatus();
        } catch (err) {
            addLog(`[❌ Central] Falha ao disparar robô ${robotId}: ${err.message}`);
        }
    };

    startPollingStatus();
});
