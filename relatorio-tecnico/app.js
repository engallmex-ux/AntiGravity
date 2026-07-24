// Data Base de Ativos e Exemplos Práticos
const ASSET_DATABASE = [
    {
        name: "Ultrassom Odontológico",
        brand: "Microdont",
        model: "Advance View",
        subject: "Inspeção e Manutenção Corretiva",
        occurrence: "Mau contato na caneta",
        diagnosis: "Oxidação em placas, entupimento de jato e desgaste na rosca da caneta.",
        procedures: "Realizada limpeza interna de placas oxidadas, desentupimento químico de jato de bicarbonato e mangueiras internas, ajuste do conector e lubrificação das partes móveis.",
        conclusion: "Defeito de mau contato resolvido com sucesso. Equipamento calibrado e testado. Recomenda-se a substituição da caneta de ultrassom em curto prazo devido ao desgaste acentuado na rosca de fixação.",
        recommendations: "Substituição preventiva da caneta de ultrassom Microdont modelo Advance View e nova calibração de fluxo de água em 30 dias.",
        tests: [
            { inspection: "Inspeção visual externa", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 365 },
            { inspection: "Verificação de mau contato (Conector)", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 180 },
            { inspection: "Teste de fluxo de jato de água/ar", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 180 },
            { inspection: "Teste de isolamento elétrico", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 365 }
        ]
    },
    {
        name: "Desfibrilador Externo Automático (DEA)",
        brand: "Instramed",
        model: "DEA I.3",
        subject: "Calibração e Inspeção de Segurança Elétrica",
        occurrence: "Mensagem de erro de bateria fraca no auto-teste diário",
        diagnosis: "Bateria de Lítio com carga abaixo da tensão mínima operacional (10.2V). Eletrodos (pás) com data de validade vencida.",
        procedures: "Substituição da bateria original Instramed por célula nova, substituição do kit de pás descartáveis (adulto), limpeza de contatos, realização de testes de descarga com analisador de desfibrilador (carga medida de 150J, 200J e 270J em conformidade).",
        conclusion: "Equipamento aprovado nos ensaios de descarga e segurança elétrica. Retorna à operação plena e segura.",
        recommendations: "Substituição dos eletrodos descartáveis até a nova validade. Próxima calibração anual recomendada.",
        tests: [
            { inspection: "Ensaio de segurança elétrica (corrente de fuga)", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 365 },
            { inspection: "Ensaio de energia de descarga (150J e 200J)", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 365 },
            { inspection: "Tempo de carga de desfibrilação (< 6s)", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 365 },
            { inspection: "Inspeção de validade dos insumos (pás/bateria)", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 730 }
        ]
    },
    {
        name: "Eletrocardiógrafo",
        brand: "TEB",
        model: "ECG 12S",
        subject: "Calibração Metrológica Anual",
        occurrence: "Ruídos e interferências nos traçados de ECG na derivação DII",
        diagnosis: "Cabo de paciente de 10 vias com rompimento interno parcial na via do eletrodo do membro inferior direito (RL). Oxidação nos clipes de conexão de eletrodos.",
        procedures: "Substituição do cabo de paciente de 10 vias por acessório novo homologado, limpeza química dos eletrodos do tipo clipe de membros, calibração com simulador de ECG em todas as derivações e velocidades de traçado (25mm/s e 50mm/s).",
        conclusion: "Interferências resolvidas. Equipamento aprovado em todas as calibrações de amplitude e frequência de pulso.",
        recommendations: "Evitar torções excessivas no cabo de paciente durante a limpeza. Armazenar em cabide apropriado.",
        tests: [
            { inspection: "Exatidão de amplitude do sinal (1mV)", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 365 },
            { inspection: "Velocidade de traçado do papel térmico", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 365 },
            { inspection: "Teste de rejeição de modo comum (CMRR)", status: "Aprovado", responsible: "Eng. Técnico", daysValid: 365 }
        ]
    }
];

// Variáveis Globais de Estado
let currentReport = {
    docId: "",
    clientName: "",
    clientCnpj: "",
    clientSector: "",
    logoData: "",
    assetName: "",
    assetBrand: "",
    assetModel: "",
    assetSerial: "",
    assetPatrimony: "",
    assetGps: "",
    subject: "",
    occurrence: "",
    diagnosis: "",
    procedures: "",
    envTemp: "",
    envHumidity: "",
    envPressure: "",
    envTension: "",
    conclusion: "",
    recommendations: "",
    techName: "",
    techReg: "",
    date: "",
    approver: "",
    signatureData: "",
    tests: [],
    photos: []
};

// Referências do DOM
const domInputs = {
    docId: document.getElementById('input-doc-id'),
    clientName: document.getElementById('input-client-name'),
    clientCnpj: document.getElementById('input-client-cnpj'),
    clientSector: document.getElementById('input-client-sector'),
    logoUpload: document.getElementById('input-logo-upload'),
    assetName: document.getElementById('input-asset-name'),
    assetBrand: document.getElementById('input-asset-brand'),
    assetModel: document.getElementById('input-asset-model'),
    assetSerial: document.getElementById('input-asset-serial'),
    assetPatrimony: document.getElementById('input-asset-patrimony'),
    assetGps: document.getElementById('input-asset-gps'),
    subject: document.getElementById('input-analysis-subject'),
    occurrence: document.getElementById('input-analysis-occurrence'),
    diagnosis: document.getElementById('input-analysis-diagnosis'),
    procedures: document.getElementById('input-analysis-procedures'),
    envTemp: document.getElementById('input-env-temp'),
    envHumidity: document.getElementById('input-env-humidity'),
    envPressure: document.getElementById('input-env-pressure'),
    envTension: document.getElementById('input-env-tension'),
    conclusion: document.getElementById('input-val-conclusion'),
    recommendations: document.getElementById('input-val-recommendations'),
    techName: document.getElementById('input-val-tech-name'),
    techReg: document.getElementById('input-val-tech-reg'),
    date: document.getElementById('input-val-date'),
    approver: document.getElementById('input-val-approver'),
    photosUpload: document.getElementById('input-photos-upload')
};

const domPreviews = {
    docId: document.getElementById('preview-doc-id'),
    clientName: document.getElementById('preview-client-name'),
    clientCnpj: document.getElementById('preview-client-cnpj'),
    clientSector: document.getElementById('preview-client-sector'),
    assetName: document.getElementById('preview-asset-name'),
    assetBrand: document.getElementById('preview-asset-brand'),
    assetModel: document.getElementById('preview-asset-model'),
    assetSerial: document.getElementById('preview-asset-serial'),
    assetPatrimony: document.getElementById('preview-asset-patrimony'),
    assetGps: document.getElementById('preview-asset-gps'),
    subject: document.getElementById('preview-analysis-subject'),
    occurrence: document.getElementById('preview-analysis-occurrence'),
    diagnosis: document.getElementById('preview-analysis-diagnosis'),
    procedures: document.getElementById('preview-analysis-procedures'),
    envTemp: document.getElementById('preview-env-temp'),
    envHumidity: document.getElementById('preview-env-humidity'),
    envPressure: document.getElementById('preview-env-pressure'),
    envTension: document.getElementById('preview-env-tension'),
    conclusion: document.getElementById('preview-val-conclusion'),
    recommendations: document.getElementById('preview-val-recommendations'),
    techName: document.getElementById('preview-val-tech-name'),
    techReg: document.getElementById('preview-val-tech-reg'),
    date: document.getElementById('preview-val-date'),
    approver: document.getElementById('preview-val-approver'),
    logoImg: document.getElementById('preview-logo-img'),
    logoDefault: document.querySelector('.preview-logo-default'),
    signatureImg: document.getElementById('preview-signature-img'),
    signaturePlaceholder: document.getElementById('preview-signature-placeholder'),
    tableTests: document.getElementById('preview-table-tests').querySelector('tbody'),
    photosGallery: document.getElementById('preview-photos-gallery'),
    noPhotosMsg: document.getElementById('preview-no-photos-msg')
};

// Canvas da Assinatura
const signatureCanvas = document.getElementById('signature-pad');
const ctx = signatureCanvas.getContext('2d');
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Inicialização da Página
document.addEventListener('DOMContentLoaded', () => {
    generateDocId();
    setupTabs();
    setupAutocomplete();
    setupEventListeners();
    setupSignaturePad();
    setupPhotoUpload();
    setupDragDropLogo();
    
    // Configura a data padrão como hoje
    const today = new Date().toISOString().split('T')[0];
    domInputs.date.value = today;
    updatePreviewField('date', today);

    // Carrega histórico e atualiza tabelas
    renderHistoryTable();
    
    // Adiciona uma linha de teste vazia inicial
    addTestRow();
});

// Geração de ID do Documento
function generateDocId() {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `REF-${year}-${randomNum}`;
    domInputs.docId.value = newId;
    updatePreviewField('docId', newId);
}

document.getElementById('btn-generate-id').addEventListener('click', generateDocId);

// Lógica de Tabs do Formulário
function setupTabs() {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetTab = link.getAttribute('data-tab');
            
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            link.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // Corrige dimensões do canvas de assinatura caso apareça a tab
            if (targetTab === 'tab-validation') {
                resizeCanvas();
            }
        });
    });
}

// Lógica de Autocomplete de Ativos
function setupAutocomplete() {
    const input = domInputs.assetName;
    const list = document.getElementById('autocomplete-list');
    
    input.addEventListener('input', function() {
        const val = this.value;
        closeAllLists();
        if (!val) return false;
        
        const filtered = ASSET_DATABASE.filter(item => 
            item.name.toLowerCase().includes(val.toLowerCase())
        );
        
        filtered.forEach(item => {
            const div = document.createElement('div');
            div.innerHTML = `<strong>${item.name}</strong> (${item.brand} - ${item.model})`;
            div.addEventListener('click', () => {
                input.value = item.name;
                closeAllLists();
                loadPredefinedAsset(item);
            });
            list.appendChild(div);
        });
    });
    
    // Fecha autocomplete ao clicar fora
    document.addEventListener('click', (e) => {
        if (e.target !== input) {
            closeAllLists();
        }
    });
    
    function closeAllLists() {
        list.innerHTML = '';
    }
}

// Carregar Dados Pré-definidos do Banco
function loadPredefinedAsset(asset) {
    // Confirmação para preencher dados sugeridos
    const fillExample = confirm(`Deseja carregar a especificação prática de exemplo para o "${asset.name}"? Isso preencherá os dados de Diagnóstico, Serviços e Ensaios sugeridos.`);
    
    domInputs.assetBrand.value = asset.brand;
    domInputs.assetModel.value = asset.model;
    
    updatePreviewField('assetBrand', asset.brand);
    updatePreviewField('assetModel', asset.model);
    updatePreviewField('assetName', asset.name);

    if (fillExample) {
        domInputs.subject.value = asset.subject;
        domInputs.occurrence.value = asset.occurrence;
        domInputs.diagnosis.value = asset.diagnosis;
        domInputs.procedures.value = asset.procedures;
        domInputs.conclusion.value = asset.conclusion;
        domInputs.recommendations.value = asset.recommendations;
        
        updatePreviewField('subject', asset.subject);
        updatePreviewField('occurrence', asset.occurrence);
        updatePreviewField('diagnosis', asset.diagnosis);
        updatePreviewField('procedures', asset.procedures);
        updatePreviewField('conclusion', asset.conclusion);
        updatePreviewField('recommendations', asset.recommendations);
        
        // Carrega Ensaios
        const tbody = document.getElementById('table-tests-inputs').querySelector('tbody');
        tbody.innerHTML = '';
        asset.tests.forEach(test => {
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            today.setDate(today.getDate() + test.daysValid);
            const validStr = today.toISOString().split('T')[0];
            
            addTestRow(test.inspection, test.status, test.responsible, dateStr, validStr);
        });
        
        // Simula condições de ambiente
        domInputs.envTemp.value = "22.3";
        domInputs.envHumidity.value = "52";
        domInputs.envPressure.value = "1011";
        domInputs.envTension.value = "220";
        
        updatePreviewField('envTemp', "22.3");
        updatePreviewField('envHumidity', "52");
        updatePreviewField('envPressure', "1011");
        updatePreviewField('envTension', "220");
    }
    
    // Foca na tab de análise
    document.querySelector('.tab-link[data-tab="tab-analysis"]').click();
}

// Configura Event Listeners Gerais
function setupEventListeners() {
    // Sincronização em tempo real de inputs normais com a Preview
    Object.keys(domInputs).forEach(key => {
        if (domInputs[key] && key !== 'logoUpload' && key !== 'photosUpload') {
            domInputs[key].addEventListener('input', (e) => {
                updatePreviewField(key, e.target.value);
            });
            domInputs[key].addEventListener('change', (e) => {
                updatePreviewField(key, e.target.value);
            });
        }
    });

    // Botão GPS
    document.getElementById('btn-get-gps').addEventListener('click', captureGps);

    // Botão de adicionar teste na tabela
    document.getElementById('btn-add-test').addEventListener('click', () => addTestRow());

    // Botão Salvar Relatório
    document.getElementById('btn-save-report').addEventListener('click', saveReportToLocalStorage);

    // Botões de impressão e histórico
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-history').addEventListener('click', openHistoryModal);
    document.getElementById('btn-close-modal').addEventListener('click', closeHistoryModal);
    
    // Fechar modal ao clicar fora
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('history-modal');
        if (e.target === modal) closeHistoryModal();
    });

    // Máscara CNPJ simples
    domInputs.clientCnpj.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        if (value.length > 14) value = value.slice(0, 14);
        
        if (value.length > 12) {
            value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
        } else if (value.length > 8) {
            value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})$/, "$1.$2.$3/$4");
        } else if (value.length > 5) {
            value = value.replace(/^(\d{2})(\d{3})(\d{0,3})$/, "$1.$2.$3");
        } else if (value.length > 2) {
            value = value.replace(/^(\d{2})(\d{0,3})$/, "$1.$2");
        }
        this.value = value;
        updatePreviewField('clientCnpj', value);
    });
}

// Atualizar Campos da Pré-visualização Dinamicamente
function updatePreviewField(key, value) {
    if (domPreviews[key]) {
        if (value.trim() === '') {
            domPreviews[key].textContent = key === 'date' ? '[Não Informado]' : '[Não Informado]';
            domPreviews[key].classList.add('empty-field');
        } else {
            domPreviews[key].textContent = value;
            domPreviews[key].classList.remove('empty-field');
        }
    }
    
    // Casos especiais
    if (key === 'techName') {
        const previewTech = document.getElementById('preview-val-tech-name');
        previewTech.textContent = value.trim() ? value : 'Nome do Técnico';
        previewTech.classList.toggle('empty-field', !value.trim());
    }
    if (key === 'techReg') {
        const previewReg = document.getElementById('preview-val-tech-reg');
        previewReg.textContent = value.trim() ? value : 'Registro Profissional';
        previewReg.classList.toggle('empty-field', !value.trim());
    }
    if (key === 'approver') {
        const previewAppr = document.getElementById('preview-val-approver');
        previewAppr.textContent = value.trim() ? value : '[Nome do Responsável]';
        previewAppr.classList.toggle('empty-field', !value.trim());
    }
    if (key === 'clientCnpj') {
        domPreviews.clientCnpj.textContent = value.trim() ? `CNPJ: ${value}` : '[Não Informado]';
    }

    // Sinalizar alterações
    const saveStatus = document.getElementById('save-status');
    saveStatus.textContent = "Alterações não salvas";
    saveStatus.style.opacity = '1';
}

// Captura de GPS
function captureGps() {
    domInputs.assetGps.value = "Obtendo coordenadas...";
    updatePreviewField('assetGps', "Obtendo coordenadas...");

    if (!navigator.geolocation) {
        alert("Geolocalização não é suportada por seu navegador.");
        domInputs.assetGps.value = "Não suportado";
        updatePreviewField('assetGps', "Não suportado");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lon = position.coords.longitude.toFixed(6);
            const coordsStr = `${lat}, ${lon}`;
            domInputs.assetGps.value = coordsStr;
            updatePreviewField('assetGps', coordsStr);
        },
        (error) => {
            console.error("GPS Error: ", error);
            let msg = "Falha ao obter GPS";
            if (error.code === error.PERMISSION_DENIED) {
                msg = "Acesso negado pelo usuário";
            }
            domInputs.assetGps.value = msg;
            updatePreviewField('assetGps', msg);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

// Drag & Drop do Logotipo
function setupDragDropLogo() {
    const dropZone = domInputs.logoUpload.closest('.file-drop-zone');
    const textZone = dropZone.querySelector('.drop-zone-text');
    const clearBtn = document.getElementById('btn-clear-logo');
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            domInputs.logoUpload.files = files;
            handleLogoFile(files[0]);
        }
    });

    domInputs.logoUpload.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleLogoFile(e.target.files[0]);
        }
    });

    clearBtn.addEventListener('click', () => {
        domInputs.logoUpload.value = '';
        domPreviews.logoImg.src = '';
        domPreviews.logoImg.classList.add('hidden');
        domPreviews.logoDefault.classList.remove('hidden');
        clearBtn.classList.add('hidden');
        textZone.textContent = "Clique ou arraste o logo aqui";
        currentReport.logoData = "";
    });

    function handleLogoFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Por favor, faça upload apenas de imagens.');
            return;
        }
        textZone.textContent = `Arquivo: ${file.name}`;
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = function() {
            const base64data = reader.result;
            domPreviews.logoImg.src = base64data;
            domPreviews.logoImg.classList.remove('hidden');
            domPreviews.logoDefault.classList.add('hidden');
            clearBtn.classList.remove('hidden');
            currentReport.logoData = base64data;
        }
    }
}

// Adicionar Linhas à Tabela de Ensaios
function addTestRow(inspection = "", status = "Aprovado", responsible = "", date = "", validity = "") {
    const tbody = document.getElementById('table-tests-inputs').querySelector('tbody');
    const tr = document.createElement('tr');
    
    // Define valores padrão se vazios
    const todayStr = date || new Date().toISOString().split('T')[0];
    const defaultValidity = validity || "";

    tr.innerHTML = `
        <td><input type="text" class="table-input inspection-val" placeholder="Ex: Inspeção Visual" value="${inspection}"></td>
        <td>
            <select class="table-select status-val">
                <option value="Aprovado" ${status === 'Aprovado' ? 'selected' : ''}>Aprovado</option>
                <option value="Reprovado" ${status === 'Reprovado' ? 'selected' : ''}>Reprovado</option>
                <option value="Pendente" ${status === 'Pendente' ? 'selected' : ''}>Pendente</option>
            </select>
        </td>
        <td><input type="text" class="table-input resp-val" placeholder="Nome" value="${responsible}"></td>
        <td><input type="date" class="table-input date-val" value="${todayStr}"></td>
        <td><input type="date" class="table-input validity-val" value="${defaultValidity}"></td>
        <td style="text-align: center;"><button type="button" class="btn btn-secondary btn-small btn-remove-row" style="color: var(--danger);">Excluir</button></td>
    `;
    
    // Adiciona evento de alteração em cada input para atualizar a prévia
    tr.querySelectorAll('.table-input, .table-select').forEach(input => {
        input.addEventListener('input', syncTestsTableToPreview);
        input.addEventListener('change', syncTestsTableToPreview);
    });

    // Evento do botão de remover
    tr.querySelector('.btn-remove-row').addEventListener('click', () => {
        tr.remove();
        syncTestsTableToPreview();
    });

    tbody.appendChild(tr);
    syncTestsTableToPreview();
}

// Sincronizar Tabela de Entrada com a Tabela de Visualização A4
function syncTestsTableToPreview() {
    const rows = document.getElementById('table-tests-inputs').querySelectorAll('tbody tr');
    domPreviews.tableTests.innerHTML = '';
    
    if (rows.length === 0) {
        domPreviews.tableTests.innerHTML = `
            <tr class="empty-table-row">
                <td colspan="5" style="text-align: center; color: #94a3b8; font-style: italic;">
                    Nenhum ensaio adicionado.
                </td>
            </tr>
        `;
        currentReport.tests = [];
        return;
    }
    
    currentReport.tests = [];

    rows.forEach(row => {
        const inspection = row.querySelector('.inspection-val').value;
        const status = row.querySelector('.status-val').value;
        const resp = row.querySelector('.resp-val').value;
        const dateRaw = row.querySelector('.date-val').value;
        const validityRaw = row.querySelector('.validity-val').value;

        // Formatação das datas para exibição brasileira (DD/MM/AAAA)
        const formatDate = (dateStr) => {
            if (!dateStr) return "-";
            const parts = dateStr.split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        };

        const dateFormatted = formatDate(dateRaw);
        const validityFormatted = formatDate(validityRaw);

        // Badge do Status
        let badgeClass = 'badge-success';
        if (status === 'Reprovado') badgeClass = 'badge-danger';
        else if (status === 'Pendente') badgeClass = 'badge-warning'; // Estilizar pendente
        
        const previewRow = document.createElement('tr');
        previewRow.innerHTML = `
            <td><strong>${inspection || '[Não Preenchido]'}</strong></td>
            <td><span class="badge ${badgeClass}" style="${status === 'Pendente' ? 'background-color: #fef3c7; color: #d97706; border: 1px solid #d97706;' : ''}">${status}</span></td>
            <td>${resp || '-'}</td>
            <td>${dateFormatted}</td>
            <td>${validityFormatted}</td>
        `;
        domPreviews.tableTests.appendChild(previewRow);

        // Adiciona à lista do modelo
        currentReport.tests.push({
            inspection,
            status,
            responsible: resp,
            date: dateRaw,
            validity: validityRaw
        });
    });
}

// Configuração da Galeria de Fotos
function setupPhotoUpload() {
    const dragZone = document.getElementById('photo-drag-zone');
    const container = document.getElementById('photos-preview-container');
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dragZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dragZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dragZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dragZone.classList.remove('dragover');
        }, false);
    });

    dragZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            handlePhotoFiles(files);
        }
    });

    domInputs.photosUpload.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handlePhotoFiles(e.target.files);
        }
    });

    function handlePhotoFiles(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
                alert('Por favor, selecione apenas arquivos de imagem.');
                return;
            }
            
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = function() {
                const base64data = reader.result;
                addPhotoToGallery(base64data, "");
            }
        });
        domInputs.photosUpload.value = ''; // Limpa input
    }
}

// Adicionar Foto ao Estado e às Visualizações
function addPhotoToGallery(src, caption = "") {
    const photoId = 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 1. Criar Card de edição à esquerda
    const container = document.getElementById('photos-preview-container');
    const card = document.createElement('div');
    card.className = 'photo-preview-card';
    card.id = `edit-${photoId}`;
    
    card.innerHTML = `
        <img class="photo-preview-image" src="${src}" alt="Miniatura">
        <textarea class="photo-preview-caption" rows="2" placeholder="Legenda/Descrição...">${caption}</textarea>
        <button type="button" class="btn-remove-photo">&times;</button>
    `;
    
    // Evento de alteração de legenda
    const textarea = card.querySelector('textarea');
    textarea.addEventListener('input', (e) => {
        updatePhotoCaptionInStateAndPreview(photoId, e.target.value);
    });

    // Evento de exclusão
    card.querySelector('.btn-remove-photo').addEventListener('click', () => {
        removePhoto(photoId);
    });

    container.appendChild(card);

    // 2. Adicionar ao estado
    currentReport.photos.push({
        id: photoId,
        src: src,
        caption: caption
    });

    // 3. Atualizar preview
    syncPhotosToPreview();
}

// Atualizar legenda da foto
function updatePhotoCaptionInStateAndPreview(id, caption) {
    const photo = currentReport.photos.find(p => p.id === id);
    if (photo) {
        photo.caption = caption;
    }
    syncPhotosToPreview();
}

// Remover foto
function removePhoto(id) {
    currentReport.photos = currentReport.photos.filter(p => p.id !== id);
    document.getElementById(`edit-${id}`).remove();
    syncPhotosToPreview();
}

// Sincronizar galeria com folha A4
function syncPhotosToPreview() {
    domPreviews.photosGallery.innerHTML = '';
    
    if (currentReport.photos.length === 0) {
        domPreviews.noPhotosMsg.classList.remove('hidden');
        domPreviews.photosGallery.classList.add('hidden');
        return;
    }

    domPreviews.noPhotosMsg.classList.add('hidden');
    domPreviews.photosGallery.classList.remove('hidden');

    currentReport.photos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
            <img class="gallery-image" src="${photo.src}" alt="Evidência ${index + 1}">
            <div class="gallery-caption">Fig. ${index + 1}: ${photo.caption || 'Sem descrição.'}</div>
        `;
        domPreviews.photosGallery.appendChild(item);
    });
}

// Configuração do Canvas de Assinatura
function setupSignaturePad() {
    // Eventos mouse
    signatureCanvas.addEventListener('mousedown', startDrawing);
    signatureCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);
    
    // Eventos Touch (Mobile)
    signatureCanvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const rect = signatureCanvas.getBoundingClientRect();
        // Converte coordenadas absolutas da tela para internas do canvas
        lastX = (touch.clientX - rect.left) * (signatureCanvas.width / rect.width);
        lastY = (touch.clientY - rect.top) * (signatureCanvas.height / rect.height);
        isDrawing = true;
        e.preventDefault();
    }, { passive: false });

    signatureCanvas.addEventListener('touchmove', (e) => {
        if (!isDrawing) return;
        const touch = e.touches[0];
        const rect = signatureCanvas.getBoundingClientRect();
        const currentX = (touch.clientX - rect.left) * (signatureCanvas.width / rect.width);
        const currentY = (touch.clientY - rect.top) * (signatureCanvas.height / rect.height);
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.strokeStyle = '#0f172a'; // Cor escura
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        lastX = currentX;
        lastY = currentY;
        e.preventDefault();
    }, { passive: false });

    signatureCanvas.addEventListener('touchend', () => {
        stopDrawing();
    });

    document.getElementById('btn-clear-signature').addEventListener('click', clearSignature);
}

function startDrawing(e) {
    isDrawing = true;
    const rect = signatureCanvas.getBoundingClientRect();
    // Normaliza para o tamanho interno do canvas
    lastX = (e.clientX - rect.left) * (signatureCanvas.width / rect.width);
    lastY = (e.clientY - rect.top) * (signatureCanvas.height / rect.height);
}

function draw(e) {
    if (!isDrawing) return;
    const rect = signatureCanvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) * (signatureCanvas.width / rect.width);
    const currentY = (e.clientY - rect.top) * (signatureCanvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastX = currentX;
    lastY = currentY;
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        // Salva imagem no preview
        const dataUrl = signatureCanvas.toDataURL();
        domPreviews.signatureImg.src = dataUrl;
        domPreviews.signatureImg.classList.remove('hidden');
        domPreviews.signaturePlaceholder.classList.add('hidden');
        currentReport.signatureData = dataUrl;
    }
}

function clearSignature() {
    ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    domPreviews.signatureImg.src = '';
    domPreviews.signatureImg.classList.add('hidden');
    domPreviews.signaturePlaceholder.classList.remove('hidden');
    currentReport.signatureData = "";
}

// Redimensionar tamanho interno do Canvas baseado na tela para evitar esticamento
function resizeCanvas() {
    // Apenas redefine o buffer interno se houver alteração significativa de escala visual
    const rect = signatureCanvas.getBoundingClientRect();
    // Limpa e redesenha se houver assinatura
    const tempSig = currentReport.signatureData;
    
    // Se o canvas visual difere muito do buffer de desenho
    if (signatureCanvas.width !== rect.width * 2) {
        // Multiplica por 2 para Retina/telas de alta DPI
        signatureCanvas.width = rect.width;
        signatureCanvas.height = rect.height;
        clearSignature();
        
        if (tempSig) {
            const img = new Image();
            img.src = tempSig;
            img.onload = function() {
                ctx.drawImage(img, 0, 0, signatureCanvas.width, signatureCanvas.height);
                domPreviews.signatureImg.src = tempSig;
                domPreviews.signatureImg.classList.remove('hidden');
                domPreviews.signaturePlaceholder.classList.add('hidden');
                currentReport.signatureData = tempSig;
            }
        }
    }
}

window.addEventListener('resize', resizeCanvas);

// --- LOCAL STORAGE (HISTÓRICO) ---

// Coleta todos os campos atuais do Formulário
function gatherReportData() {
    return {
        docId: domInputs.docId.value,
        clientName: domInputs.clientName.value,
        clientCnpj: domInputs.clientCnpj.value,
        clientSector: domInputs.clientSector.value,
        logoData: currentReport.logoData,
        assetName: domInputs.assetName.value,
        assetBrand: domInputs.assetBrand.value,
        assetModel: domInputs.assetModel.value,
        assetSerial: domInputs.assetSerial.value,
        assetPatrimony: domInputs.assetPatrimony.value,
        assetGps: domInputs.assetGps.value,
        subject: domInputs.subject.value,
        occurrence: domInputs.occurrence.value,
        diagnosis: domInputs.diagnosis.value,
        procedures: domInputs.procedures.value,
        envTemp: domInputs.envTemp.value,
        envHumidity: domInputs.envHumidity.value,
        envPressure: domInputs.envPressure.value,
        envTension: domInputs.envTension.value,
        conclusion: domInputs.conclusion.value,
        recommendations: domInputs.recommendations.value,
        techName: domInputs.techName.value,
        techReg: domInputs.techReg.value,
        date: domInputs.date.value,
        approver: domInputs.approver.value,
        signatureData: currentReport.signatureData,
        tests: currentReport.tests, // Já atualizado em tempo real
        photos: currentReport.photos // Já atualizado em tempo real
    };
}

// Salvar no LocalStorage
function saveReportToLocalStorage() {
    const data = gatherReportData();
    
    // Validação básica de campos obrigatórios
    if (!data.clientName || !data.assetName || !data.subject || !data.conclusion || !data.techName || !data.date) {
        alert("Por favor, preencha os campos obrigatórios marcados com asterisco (*) antes de salvar.");
        
        // Direcionar para a primeira tab com erro
        if (!data.clientName) document.querySelector('.tab-link[data-tab="tab-client"]').click();
        else if (!data.assetName) document.querySelector('.tab-link[data-tab="tab-asset"]').click();
        else if (!data.subject) document.querySelector('.tab-link[data-tab="tab-analysis"]').click();
        else document.querySelector('.tab-link[data-tab="tab-validation"]').click();
        return;
    }

    let reports = JSON.parse(localStorage.getItem('clinireports_db')) || [];
    
    // Verifica se já existe para atualizar (sobrescrever), senão insere novo
    const existingIndex = reports.findIndex(r => r.docId === data.docId);
    if (existingIndex > -1) {
        reports[existingIndex] = data;
    } else {
        reports.push(data);
    }
    
    try {
        localStorage.setItem('clinireports_db', JSON.stringify(reports));
        
        const saveStatus = document.getElementById('save-status');
        saveStatus.textContent = "Salvo com sucesso!";
        saveStatus.style.opacity = '1';
        setTimeout(() => {
            saveStatus.textContent = "Alterações salvas";
        }, 3000);

        renderHistoryTable();
        alert("Relatório salvo no histórico local com sucesso!");
    } catch (e) {
        console.error(e);
        alert("Falha ao salvar localmente. O tamanho das fotos ou da assinatura pode ter excedido o limite de armazenamento do navegador (LocalStorage). Tente usar fotos menores.");
    }
}

// Carregar Relatório Selecionado de volta no Formulário
function loadReportFromData(data) {
    // Carrega dados textuais
    domInputs.docId.value = data.docId;
    domInputs.clientName.value = data.clientName;
    domInputs.clientCnpj.value = data.clientCnpj;
    domInputs.clientSector.value = data.clientSector;
    domInputs.assetName.value = data.assetName;
    domInputs.assetBrand.value = data.assetBrand;
    domInputs.assetModel.value = data.assetModel;
    domInputs.assetSerial.value = data.assetSerial;
    domInputs.assetPatrimony.value = data.assetPatrimony;
    domInputs.assetGps.value = data.assetGps;
    domInputs.subject.value = data.subject;
    domInputs.occurrence.value = data.occurrence;
    domInputs.diagnosis.value = data.diagnosis;
    domInputs.procedures.value = data.procedures;
    domInputs.envTemp.value = data.envTemp;
    domInputs.envHumidity.value = data.envHumidity;
    domInputs.envPressure.value = data.envPressure;
    domInputs.envTension.value = data.envTension;
    domInputs.conclusion.value = data.conclusion;
    domInputs.recommendations.value = data.recommendations;
    domInputs.techName.value = data.techName;
    domInputs.techReg.value = data.techReg;
    domInputs.date.value = data.date;
    domInputs.approver.value = data.approver;

    // Atualiza preview de texto
    Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string' && key !== 'logoData' && key !== 'signatureData') {
            updatePreviewField(key, data[key]);
        }
    });

    // Logo
    currentReport.logoData = data.logoData || "";
    const dropZone = domInputs.logoUpload.closest('.file-drop-zone');
    const textZone = dropZone.querySelector('.drop-zone-text');
    const clearBtn = document.getElementById('btn-clear-logo');
    
    if (data.logoData) {
        domPreviews.logoImg.src = data.logoData;
        domPreviews.logoImg.classList.remove('hidden');
        domPreviews.logoDefault.classList.add('hidden');
        clearBtn.classList.remove('hidden');
        textZone.textContent = "Logo carregado do histórico";
    } else {
        domPreviews.logoImg.src = '';
        domPreviews.logoImg.classList.add('hidden');
        domPreviews.logoDefault.classList.remove('hidden');
        clearBtn.classList.add('hidden');
        textZone.textContent = "Clique ou arraste o logo aqui";
    }

    // Assinatura
    currentReport.signatureData = data.signatureData || "";
    clearSignature();
    if (data.signatureData) {
        domPreviews.signatureImg.src = data.signatureData;
        domPreviews.signatureImg.classList.remove('hidden');
        domPreviews.signaturePlaceholder.classList.add('hidden');
        // Redesenha no canvas
        const img = new Image();
        img.src = data.signatureData;
        img.onload = function() {
            ctx.drawImage(img, 0, 0, signatureCanvas.width, signatureCanvas.height);
        }
    }

    // Tabela de Ensaios
    const tbody = document.getElementById('table-tests-inputs').querySelector('tbody');
    tbody.innerHTML = '';
    currentReport.tests = data.tests || [];
    if (currentReport.tests.length) {
        currentReport.tests.forEach(test => {
            addTestRow(test.inspection, test.status, test.responsible, test.date, test.validity);
        });
    } else {
        addTestRow();
    }

    // Fotos
    currentReport.photos = data.photos || [];
    document.getElementById('photos-preview-container').innerHTML = '';
    currentReport.photos.forEach(photo => {
        // Adiciona à interface de edição esquerda
        const container = document.getElementById('photos-preview-container');
        const card = document.createElement('div');
        card.className = 'photo-preview-card';
        card.id = `edit-${photo.id}`;
        
        card.innerHTML = `
            <img class="photo-preview-image" src="${photo.src}" alt="Miniatura">
            <textarea class="photo-preview-caption" rows="2" placeholder="Legenda/Descrição...">${photo.caption}</textarea>
            <button type="button" class="btn-remove-photo">&times;</button>
        `;
        
        card.querySelector('textarea').addEventListener('input', (e) => {
            updatePhotoCaptionInStateAndPreview(photo.id, e.target.value);
        });

        card.querySelector('.btn-remove-photo').addEventListener('click', () => {
            removePhoto(photo.id);
        });

        container.appendChild(card);
    });
    syncPhotosToPreview();

    // Volta para o primeiro tab
    document.querySelector('.tab-link[data-tab="tab-client"]').click();
}

// Exibe a Tabela do Histórico no Modal
function renderHistoryTable() {
    const reports = JSON.parse(localStorage.getItem('clinireports_db')) || [];
    const tbody = document.getElementById('table-history-list').querySelector('tbody');
    tbody.innerHTML = '';

    if (reports.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-light); font-style: italic; padding: 20px;">
                    Nenhum relatório salvo no histórico local deste navegador.
                </td>
            </tr>
        `;
        return;
    }

    reports.forEach(report => {
        const tr = document.createElement('tr');
        
        // Formata data brasileira
        const formatDate = (dateStr) => {
            if (!dateStr) return "-";
            const parts = dateStr.split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        };

        tr.innerHTML = `
            <td><strong>${report.docId}</strong></td>
            <td>${report.assetName}</td>
            <td>${report.clientName}</td>
            <td>${formatDate(report.date)}</td>
            <td style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-secondary btn-small btn-edit-report" data-id="${report.docId}">Editar</button>
                <button type="button" class="btn btn-secondary btn-small btn-delete-report" data-id="${report.docId}" style="color: var(--danger); border-color: #fee2e2;">Excluir</button>
            </td>
        `;

        tr.querySelector('.btn-edit-report').addEventListener('click', () => {
            loadReportFromData(report);
            closeHistoryModal();
        });

        tr.querySelector('.btn-delete-report').addEventListener('click', () => {
            if (confirm(`Deseja realmente excluir o relatório ${report.docId}?`)) {
                deleteReportFromLocalStorage(report.docId);
            }
        });

        tbody.appendChild(tr);
    });
}

function deleteReportFromLocalStorage(docId) {
    let reports = JSON.parse(localStorage.getItem('clinireports_db')) || [];
    reports = reports.filter(r => r.docId !== docId);
    localStorage.setItem('clinireports_db', JSON.stringify(reports));
    renderHistoryTable();
}

// Operações do Modal
function openHistoryModal() {
    document.getElementById('history-modal').classList.add('active');
    renderHistoryTable();
}

function closeHistoryModal() {
    document.getElementById('history-modal').classList.remove('active');
}
