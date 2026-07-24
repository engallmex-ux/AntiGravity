// BioAlert Dashboard Frontend Logic

let knownOrderIds = new Set();
let isInitialLoad = true;

// Relógio do painel superior
function updateDateTime() {
    const now = new Date();
    
    // Data formatada (DD/MM/AAAA)
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    document.getElementById('currentDate').innerText = `${day}/${month}/${year}`;
    
    // Hora formatada (HH:MM:SS)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('currentTime').innerText = `${hours}:${minutes}:${seconds}`;
}

setInterval(updateDateTime, 1000);
updateDateTime();

// Buscar dados das Ordens de Serviço
async function fetchOrders() {
    try {
        const response = await fetch('/api/orders');
        if (!response.ok) throw new Error('Falha ao conectar com a API.');
        
        const orders = await response.json();
        renderOrders(orders);
        updateMetrics(orders);
        checkForNewAlerts(orders);
        
        document.getElementById('serverStatusDot').className = 'status-dot online';
        document.getElementById('lastUpdatedTime').innerText = `Atualizado: ${new Date().toLocaleTimeString()}`;
    } catch (error) {
        console.error('Erro ao buscar ordens:', error);
        document.getElementById('serverStatusDot').className = 'status-dot offline';
    }
}

// Renderizar ordens na tabela
function renderOrders(orders) {
    const tableBody = document.querySelector('#osMainTable tbody');
    if (!orders || orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="loading-cell">Nenhuma ordem de serviço pendente encontrada.</td></tr>';
        return;
    }
    
    tableBody.innerHTML = '';
    
    orders.forEach(order => {
        const row = document.createElement('tr');
        
        // Urgência badge
        const urgClass = order.urgencia.toUpperCase().includes('ALT') ? 'ALTA' : 
                         order.urgencia.toUpperCase().includes('MED') ? 'MEDIA' : 'BAIXA';
                         
        // Status class
        const statusClass = order.status.toLowerCase().replace(/\s+/g, '-');
        
        row.innerHTML = `
            <td style="font-weight: 700; color: #fff;">${order.id}</td>
            <td>${order.local}</td>
            <td>${order.equipamento}</td>
            <td>${order.problema}</td>
            <td>${order.data_hora}</td>
            <td><span class="badge-urgency ${urgClass}">${order.urgencia}</span></td>
            <td><span class="badge-status ${statusClass}">${order.status}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

// Atualizar cartões de métricas
function updateMetrics(orders) {
    document.getElementById('metricTotal').innerText = orders.length;
    
    const pendingCount = orders.filter(o => o.status.toLowerCase().includes('pendente')).length;
    document.getElementById('metricPending').innerText = pendingCount;
    
    const criticalCount = orders.filter(o => o.urgencia.toUpperCase().includes('ALT')).length;
    document.getElementById('metricCritical').innerText = criticalCount;
}

// Verificar se há novos alertas de alta prioridade
function checkForNewAlerts(orders) {
    let hasNewCritical = false;
    let latestCriticalOrder = null;

    orders.forEach(order => {
        // Se a ordem for nova e tiver urgência alta
        if (!knownOrderIds.has(order.id)) {
            knownOrderIds.add(order.id);
            
            if (!isInitialLoad && order.urgencia.toUpperCase().includes('ALT')) {
                hasNewCritical = true;
                latestCriticalOrder = order;
            }
        }
    });

    if (hasNewCritical && latestCriticalOrder) {
        triggerAlert(latestCriticalOrder);
    }
    
    isInitialLoad = false;
}

// Disparar som de alerta e banner visual
function triggerAlert(order) {
    // Tocar áudio
    const alertAudio = document.getElementById('alertSound');
    if (alertAudio) {
        alertAudio.play().catch(err => console.log('Áudio bloqueado pelo navegador até interação:', err));
    }
    
    // Mostrar banner
    const banner = document.getElementById('activeAlertBanner');
    const bannerText = document.getElementById('alertBannerText');
    
    bannerText.innerHTML = `<strong>Nova OS Crítica:</strong> ${order.id} - ${order.local} (${order.equipamento}) - <em>${order.problema}</em>`;
    banner.style.display = 'block';
    
    // Atualizar logs do WhatsApp simulados
    fetchWhatsAppLogs();
}

function dismissAlert() {
    document.getElementById('activeAlertBanner').style.display = 'none';
}

// Buscar histórico de notificações do WhatsApp
async function fetchWhatsAppLogs() {
    try {
        const response = await fetch('/api/alerts');
        if (!response.ok) return;
        
        const logs = await response.json();
        const logList = document.getElementById('whatsappLogList');
        
        if (!logs || logs.length === 0) {
            logList.innerHTML = '<div class="log-empty">Nenhum alerta disparado nesta sessão.</div>';
            return;
        }
        
        logList.innerHTML = '';
        logs.forEach(log => {
            const item = document.createElement('div');
            item.className = 'log-item';
            
            // Format time
            const timeStr = new Date(log.timestamp * 1000).toLocaleTimeString();
            
            item.innerHTML = `
                <div class="log-header">
                    <span><i class="fa-solid fa-check-double" style="color: #25d366;"></i> WhatsApp Enviado</span>
                    <span>${timeStr}</span>
                </div>
                <div class="log-body">${log.message}</div>
            `;
            logList.appendChild(item);
        });
    } catch (e) {
        console.error('Erro ao buscar logs do WhatsApp:', e);
    }
}

// Ações do painel lateral
document.getElementById('btnSimulate').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch('/api/simulate', { method: 'POST' });
        if (response.ok) {
            console.log('Nova OS simulada no portal.');
            // Força uma varredura instantânea após simular
            runScraper();
        }
    } catch (err) {
        console.error('Erro ao forçar simulação:', err);
    }
});

async function runScraper() {
    const btn = document.getElementById('btnRunScraper');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Varrendo...';
    btn.style.pointerEvents = 'none';
    
    try {
        const response = await fetch('/api/scan', { method: 'POST' });
        if (response.ok) {
            await fetchOrders();
            await fetchWhatsAppLogs();
        }
    } catch (err) {
        console.error('Erro ao rodar scraper:', err);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Varrer Portal';
        btn.style.pointerEvents = 'auto';
    }
}

document.getElementById('btnRunScraper').addEventListener('click', (e) => {
    e.preventDefault();
    runScraper();
});

// Inicialização
fetchOrders().then(() => {
    fetchWhatsAppLogs();
});

// Loop de atualização constante (polling a cada 4 segundos)
setInterval(() => {
    fetchOrders();
}, 4000);
