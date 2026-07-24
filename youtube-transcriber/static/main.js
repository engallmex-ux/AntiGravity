// ─────────────────────────────────────────────────────────────────────────────
// SocialScribe — main.js
// ─────────────────────────────────────────────────────────────────────────────

let network = null;
let logPollInterval = null;
let currentTranscriptAutor = "";
let currentTranscriptArquivo = "";
let currentAutorBulk = "";
let wasRunning = false;

// Mapa de textos das abas para o header
const TAB_META = {
    overview:    { title: "Painel Geral",        sub: "Resumo e acesso rápido ao sistema." },
    scanner:     { title: "Novo Varredor",        sub: "Inicie uma varredura profunda de vídeos, playlists ou canais." },
    transcripts: { title: "Transcrições",         sub: "Visualize, edite e extraia sacadas de cada vídeo transcrito." },
    sacadas:     { title: "Banco de Sacadas",     sub: "Frases de impacto e insights extraídos automaticamente." },
    channels:    { title: "Canais Favoritos",     sub: "Monitore seus criadores de conteúdo prediletos." },
    graph:       { title: "Cérebro Neural",       sub: "Mapa de conhecimento interativo estilo Obsidian Vault." },
};

// ─────────────────────────────────────────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadOverviewStats();
    loadChannels();
    loadSacadas();
    loadAutores();
    loadTranscriptList();
    startLogPolling();
});

// ─────────────────────────────────────────────────────────────────────────────
// Navegação de Abas
// ─────────────────────────────────────────────────────────────────────────────
function switchTab(tabId) {
    document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));

    document.getElementById(`tab-${tabId}`).classList.add("active");
    const btn = document.getElementById(`nav-${tabId}`);
    if (btn) btn.classList.add("active");

    const meta = TAB_META[tabId] || { title: tabId, sub: "" };
    document.getElementById("current-tab-title").innerText    = meta.title;
    document.getElementById("current-tab-subtitle").innerText = meta.sub;

    if (tabId === "graph") setTimeout(loadGraph, 120);
    if (tabId === "transcripts") loadTranscriptList();
}

// ─────────────────────────────────────────────────────────────────────────────
// Painel Geral — Métricas
// ─────────────────────────────────────────────────────────────────────────────
async function loadOverviewStats() {
    try {
        const [chRes, saRes, trRes] = await Promise.all([
            fetch("/api/channels"),
            fetch("/api/sacadas"),
            fetch("/api/transcripts"),
        ]);
        const channels    = await chRes.json();
        const sacadas     = await saRes.json();
        const transcripts = await trRes.json();

        document.getElementById("metric-channels").innerText    = channels.length;
        document.getElementById("metric-sacadas").innerText     = sacadas.length;

        // Conta arquivos totais de transcrição
        const totalVideos = transcripts.reduce((acc, a) => acc + a.videos.length, 0);
        document.getElementById("metric-transcripts").innerText = totalVideos;
    } catch (e) {
        console.error("Erro nas métricas:", e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Canais Favoritos
// ─────────────────────────────────────────────────────────────────────────────
async function loadChannels() {
    try {
        const res      = await fetch("/api/channels");
        const channels = await res.json();
        const listEl   = document.getElementById("channels-list");
        listEl.innerHTML = "";

        if (channels.length === 0) {
            listEl.innerHTML = `<p class="empty-state">Nenhum canal cadastrado ainda.</p>`;
            return;
        }

        channels.forEach(ch => {
            const icons = { youtube: "fa-youtube", tiktok: "fa-tiktok", instagram: "fa-instagram" };
            const colors = { youtube: "gold", tiktok: "purple", instagram: "emerald" };
            const icon  = icons[ch.tipo]  || "fa-link";
            const color = colors[ch.tipo] || "teal";

            const card = document.createElement("div");
            card.className = "channel-card";
            card.innerHTML = `
                <div class="channel-header">
                    <div class="channel-avatar ${color}"><i class="fa-brands ${icon}"></i></div>
                    <div class="channel-info">
                        <h4>${escHtml(ch.nome)}</h4>
                        <span>${ch.tipo.toUpperCase()}</span>
                    </div>
                </div>
                <div class="channel-footer">
                    <span>Último check: ${ch.ultimo_check || "Nunca"}</span>
                    <div>
                        <button onclick="scanChannel('${escHtml(ch.url)}')" class="btn-primary" style="padding:5px 10px;font-size:11px;">
                            <i class="fa-solid fa-sync"></i> Varrer
                        </button>
                        <button onclick="deleteChannel(${ch.id})" class="btn-icon-red" title="Remover">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>`;
            listEl.appendChild(card);
        });
    } catch (e) {
        console.error("Erro ao carregar canais:", e);
    }
}

async function addChannel() {
    const urlInput  = document.getElementById("channel-url");
    const nomeInput = document.getElementById("channel-nome");
    const feedback  = document.getElementById("channel-feedback");
    const btn       = document.getElementById("btn-add-channel");

    const url  = urlInput.value.trim();
    const nome = nomeInput.value.trim();

    if (!url) {
        showFeedback(feedback, "⚠️ Insira a URL do canal.", "warning");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando...`;

    try {
        const res  = await fetch("/api/channels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, nome })
        });
        const data = await res.json();

        if (res.ok) {
            showFeedback(feedback, `✅ Canal "${data.nome}" adicionado!`, "success");
            urlInput.value  = "";
            nomeInput.value = "";
            loadChannels();
            loadOverviewStats();
        } else {
            showFeedback(feedback, `❌ ${data.detail}`, "error");
        }
    } catch (e) {
        showFeedback(feedback, `❌ Erro de conexão.`, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-bookmark"></i> Cadastrar`;
    }
}

function showFeedback(el, msg, type) {
    const colors = { success: "var(--accent-emerald)", warning: "var(--accent-gold)", error: "#ff5757" };
    el.style.display = "block";
    el.style.color   = colors[type] || "#fff";
    el.innerText     = msg;
    setTimeout(() => { el.style.display = "none"; }, 5000);
}

async function deleteChannel(id) {
    if (!confirm("Remover este canal da lista de monitoramento?")) return;
    await fetch(`/api/channels/${id}`, { method: "DELETE" });
    loadChannels();
    loadOverviewStats();
}

function scanChannel(url) {
    document.getElementById("scanner-url").value = url;
    switchTab("scanner");
    startFullScan();
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSCRIÇÕES — Lista de arquivos, visualizador, ações
// ─────────────────────────────────────────────────────────────────────────────
let transcriptData = [];

async function loadTranscriptList() {
    try {
        const res  = await fetch("/api/transcripts");
        transcriptData = await res.json();

        const authorsList = document.getElementById("authors-list");
        authorsList.innerHTML = "";
        document.getElementById("videos-list").innerHTML = "";
        document.getElementById("transcript-viewer").style.display = "none";

        if (transcriptData.length === 0) {
            authorsList.innerHTML = `<li class="empty-state">Nenhuma transcrição salva ainda.<br>Use o <b>Varredor</b> para transcrever um vídeo!</li>`;
            return;
        }

        transcriptData.forEach((entry, idx) => {
            const li = document.createElement("li");
            li.className = "transcript-item";
            li.innerHTML = `<i class="fa-solid fa-user-tie"></i> ${escHtml(entry.autor)}
                            <span class="badge-count">${entry.videos.length}</span>`;
            li.onclick = () => selectAuthor(idx, li);
            authorsList.appendChild(li);
        });
    } catch (e) {
        console.error("Erro ao listar transcrições:", e);
    }
}

function selectAuthor(idx, liEl) {
    document.querySelectorAll("#authors-list .transcript-item").forEach(el => el.classList.remove("selected"));
    liEl.classList.add("selected");

    const entry      = transcriptData[idx];
    currentAutorBulk = entry.autor;  // salva para análise em lote

    const videosList = document.getElementById("videos-list");
    videosList.innerHTML = "";
    document.getElementById("transcript-viewer").style.display = "none";

    // Mostra o botão "Analisar Canal Inteiro"
    const btnAnalyze = document.getElementById("btn-analyze-channel");
    if (btnAnalyze) btnAnalyze.style.display = "flex";

    entry.videos.forEach(v => {
        const li = document.createElement("li");
        li.className = "transcript-item";
        li.innerHTML = `<i class="fa-solid fa-file-video"></i> ${escHtml(v.titulo)}`;
        li.onclick = () => {
            document.querySelectorAll("#videos-list .transcript-item").forEach(el => el.classList.remove("selected"));
            li.classList.add("selected");
            openTranscript(entry.autor, v.arquivo, v.titulo);
        };
        videosList.appendChild(li);
    });
}

async function openTranscript(autor, arquivo, titulo) {
    currentTranscriptAutor   = autor;
    currentTranscriptArquivo = arquivo;

    const viewer = document.getElementById("transcript-viewer");
    viewer.style.display = "block";
    document.getElementById("transcript-title").innerText  = titulo;
    document.getElementById("transcript-author").innerText = `📁 ${autor}`;
    document.getElementById("transcript-text").value       = "⏳ Carregando texto...";
    document.getElementById("extracted-sacadas-panel").style.display = "none";

    viewer.scrollIntoView({ behavior: "smooth" });

    try {
        const res  = await fetch(`/api/transcripts/${encodeURIComponent(autor)}/${encodeURIComponent(arquivo)}`);
        const data = await res.json();
        document.getElementById("transcript-text").value = data.content || "(Arquivo vazio)";
    } catch (e) {
        document.getElementById("transcript-text").value = "❌ Erro ao carregar o arquivo.";
    }
}

function closeViewer() {
    document.getElementById("transcript-viewer").style.display = "none";
    document.querySelectorAll("#videos-list .transcript-item").forEach(el => el.classList.remove("selected"));
}

// ─── Análise em lote: todos os vídeos do canal de uma vez ───
async function analyzeWholeChannel() {
    if (!currentAutorBulk) return;

    const btn = document.getElementById("btn-analyze-channel");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Carregando...`;

    try {
        const res  = await fetch(`/api/transcripts/${encodeURIComponent(currentAutorBulk)}`);
        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Erro ao carregar as trancrições do canal.");
            return;
        }
        const data = await res.json();

        // Abre o viewer com o texto consolidado
        currentTranscriptAutor   = data.autor;
        currentTranscriptArquivo = "";  // indica modo bulk

        const viewer = document.getElementById("transcript-viewer");
        viewer.style.display = "block";
        document.getElementById("transcript-title").innerText  = `📁 ${data.autor} — Análise Completa`;
        document.getElementById("transcript-author").innerText = `${data.total_videos} vídeos transcritos | ${data.content.length.toLocaleString()} caracteres`;
        document.getElementById("transcript-text").value = data.content;
        document.getElementById("extracted-sacadas-panel").style.display = "none";

        viewer.scrollIntoView({ behavior: "smooth" });

        // Inicia extração automática em lote
        await extractFromViewer(true);

    } catch (e) {
        console.error(e);
        alert("Erro ao buscar as trancrições do canal.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Analisar Canal Inteiro`;
    }
}

async function saveTranscript() {
    if (!currentTranscriptArquivo) return;
    const text = document.getElementById("transcript-text").value;
    try {
        const res = await fetch(`/api/transcripts/${encodeURIComponent(currentTranscriptAutor)}/${encodeURIComponent(currentTranscriptArquivo)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        alert(data.message || "Salvo.");
    } catch (e) {
        alert("Erro ao salvar.");
    }
}

function copyTranscript() {
    const text = document.getElementById("transcript-text").value;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector(".btn-secondary");
        btn.innerHTML = `<i class="fa-solid fa-check"></i> Copiado!`;
        setTimeout(() => { btn.innerHTML = `<i class="fa-solid fa-copy"></i> Copiar`; }, 2000);
    });
}

// Extração de sacadas — com curadoria individual antes de salvar
async function extractFromViewer(silent = false) {
    const btn  = document.getElementById("btn-extract");
    const text = document.getElementById("transcript-text").value;

    if (!text || text.length < 50) {
        if (!silent) alert("Texto muito curto para extração.");
        return;
    }

    if (!silent) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analisando...`;
    }

    // Determina o título da fonte para metadado
    const videoTitulo = currentTranscriptArquivo
        ? currentTranscriptArquivo.replace(".txt", "")
        : `${currentTranscriptAutor || currentAutorBulk} — Canal Completo`;

    const autorFinal = currentTranscriptAutor || currentAutorBulk || "Desconhecido";

    // ── Gatilhos de extração ──────────────────────────────────────────────────
    const gatilhos = [
        { termo: "o segredo",        categoria: "Revelação"      },
        { termo: "a chave é",        categoria: "Revelação"      },
        { termo: "nunca esqueça",    categoria: "Imperativo"     },
        { termo: "presta atenção",   categoria: "Atenção"        },
        { termo: "anota aí",         categoria: "Atenção"        },
        { termo: "lembra que",       categoria: "Memória"        },
        { termo: "o problema é",     categoria: "Reflexão"       },
        { termo: "a verdade é",      categoria: "Revelação"      },
        { termo: "descobri que",     categoria: "Descoberta"     },
        { termo: "o que muda tudo",  categoria: "Transformação"  },
        { termo: "não existe",       categoria: "Negação"        },
        { termo: "a resposta é",     categoria: "Conclusão"      },
        { termo: "você precisa",     categoria: "Imperativo"     },
        { termo: "imagine",          categoria: "Reflexão"       },
        { termo: "pensa comigo",     categoria: "Reflexão"       },
        { termo: "o maior erro",     categoria: "Erro"           },
        { termo: "deus quer",        categoria: "Espiritual"     },
        { termo: "jesus disse",      categoria: "Espiritual"     },
        { termo: "o amor é",         categoria: "Espiritual"     },
        { termo: "a graça",          categoria: "Espiritual"     },
        { termo: "a missão",         categoria: "Propósito"      },
        { termo: "o dom",            categoria: "Propósito"      },
        { termo: "o caminho é",      categoria: "Direção"        },
        { termo: "a diferença é",    categoria: "Contraste"      },
        { termo: "o que aprendi",    categoria: "Descoberta"     },
        { termo: "cuidado com",      categoria: "Alerta"         },
        { termo: "atenção",          categoria: "Alerta"         },
        { termo: "muito importante", categoria: "Destaque"       },
        { termo: "o que poucos",     categoria: "Revelação"      },
        { termo: "não confunda",     categoria: "Esclarecimento" },
        { termo: "o pior erro",      categoria: "Erro"           },
    ];

    const sentencas = text.split(/[.!?\n]/).map(s => s.trim()).filter(s => s.length > 25 && s.length < 400);
    const encontradas = [];
    const vistos = new Set();

    for (const sent of sentencas) {
        const lower = sent.toLowerCase();
        for (const g of gatilhos) {
            if (lower.includes(g.termo) && !vistos.has(sent)) {
                encontradas.push({
                    frase: sent,
                    gatilho: g.termo,
                    categoria: g.categoria,
                    autor: autorFinal,
                    video_titulo: videoTitulo
                });
                vistos.add(sent);
                break;
            }
        }
    }

    const panel = document.getElementById("extracted-sacadas-panel");
    const list  = document.getElementById("extracted-sacadas-list");
    const feedback = document.getElementById("save-feedback");
    list.innerHTML = "";
    if (feedback) feedback.style.display = "none";
    panel.style.display = "block";

    if (encontradas.length === 0) {
        list.innerHTML = `<p class="empty-state">Nenhuma sacada detectada com os gatilhos atuais.<br>
            Verifique se a transcrição está correta ou edite o texto para corrigir palavras-chave.</p>`;
        updateSacadaCount(0);
    } else {
        encontradas.forEach((s, idx) => {
            const div = document.createElement("div");
            div.className = "sacada-extracted-card";
            div.setAttribute("data-idx", idx);
            div.setAttribute("data-frase", s.frase);
            div.setAttribute("data-gatilho", s.gatilho);
            div.setAttribute("data-categoria", s.categoria);
            div.setAttribute("data-autor", s.autor);
            div.setAttribute("data-video", s.video_titulo);
            div.innerHTML = `
                <div class="sacada-card-top">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="sacada-badge">${escHtml(s.categoria)}</span>
                        <small style="color:var(--text-secondary);">
                            <i class="fa-solid fa-user-tie" style="font-size:10px;"></i> ${escHtml(s.autor)}
                            &nbsp;·&nbsp;
                            <i class="fa-solid fa-tag" style="font-size:10px;"></i> gatilho: <code>${escHtml(s.gatilho)}</code>
                        </small>
                    </div>
                    <button class="btn-remove-sacada" onclick="removeSacada(this)" title="Remover esta sacada">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <blockquote>"${escHtml(s.frase)}"</blockquote>
                <small style="color:var(--text-secondary); font-size:11px;">
                    <i class="fa-solid fa-film"></i> ${escHtml(s.video_titulo)}
                </small>`;
            list.appendChild(div);
        });
        updateSacadaCount(encontradas.length);
    }

    panel.scrollIntoView({ behavior: "smooth" });

    if (!silent) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Extrair Sacadas com IA`;
    }
}

function removeSacada(btn) {
    const card = btn.closest(".sacada-extracted-card");
    if (!card) return;
    card.style.transition = "opacity .25s, transform .25s";
    card.style.opacity = "0";
    card.style.transform = "translateX(20px)";
    setTimeout(() => {
        card.remove();
        const remaining = document.querySelectorAll(".sacada-extracted-card").length;
        updateSacadaCount(remaining);
        const feedback = document.getElementById("save-feedback");
        if (feedback) feedback.style.display = "none";
    }, 250);
}

function updateSacadaCount(n) {
    const badge = document.getElementById("sacadas-count-badge");
    if (badge) badge.innerText = n;
    const btnSave = document.getElementById("btn-save-sacadas");
    if (btnSave) btnSave.disabled = (n === 0);
}

function clearAllSacadas() {
    document.getElementById("extracted-sacadas-list").innerHTML = "";
    updateSacadaCount(0);
    const feedback = document.getElementById("save-feedback");
    if (feedback) feedback.style.display = "none";
}

async function saveSacadasToDB() {
    const cards = document.querySelectorAll(".sacada-extracted-card");
    if (!cards.length) { alert("Nenhuma sacada para salvar."); return; }

    const sacadas = [];
    cards.forEach(card => {
        sacadas.push({
            autor:        card.getAttribute("data-autor")    || currentAutorBulk || "Desconhecido",
            video_titulo: card.getAttribute("data-video")    || "—",
            gatilho:      card.getAttribute("data-gatilho")  || "—",
            categoria:    card.getAttribute("data-categoria") || "—",
            trecho:       card.getAttribute("data-frase")    || "",
            compartilhavel: 1
        });
    });

    const btn = document.getElementById("btn-save-sacadas");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;

    try {
        const res  = await fetch("/api/sacadas/batch", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ sacadas })
        });
        const data = await res.json();

        const feedback = document.getElementById("save-feedback");
        if (res.ok) {
            feedback.style.display     = "block";
            feedback.style.background  = "rgba(0,230,118,.12)";
            feedback.style.border      = "1px solid rgba(0,230,118,.3)";
            feedback.style.color       = "var(--accent-emerald)";
            feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i>
                ${data.total_salvas} sacada(s) salva(s) com sucesso!
                <span style="margin-left:12px; font-weight:400; color:var(--text-secondary);">
                    Confira no <a href="#" onclick="switchTab('sacadas'); return false;" style="color:var(--accent-teal);">Banco de Sacadas</a>
                    e no <a href="#" onclick="switchTab('graph'); return false;" style="color:var(--accent-teal);">Cérebro Neural</a>.
                </span>`;
            loadSacadas();
            loadAutores();
            loadOverviewStats();
        } else {
            feedback.style.display    = "block";
            feedback.style.background = "rgba(255,87,87,.12)";
            feedback.style.border     = "1px solid rgba(255,87,87,.3)";
            feedback.style.color      = "#ff6b6b";
            feedback.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${data.detail || "Erro ao salvar."}`;
        }
        feedback.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-database"></i> Salvar no Banco de Sacadas`;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Banco de Sacadas
// ─────────────────────────────────────────────────────────────────────────────
async function loadAutores() {
    try {
        const res    = await fetch("/api/autores");
        const autores = await res.json();
        const select = document.getElementById("filter-autor");
        select.innerHTML = `<option value="">Todos os autores</option>`;
        autores.forEach(a => {
            select.innerHTML += `<option value="${escHtml(a)}">${escHtml(a)}</option>`;
        });
    } catch (e) { console.error(e); }
}

async function loadSacadas() {
    const autor = document.getElementById("filter-autor").value;
    const busca = document.getElementById("search-sacada").value.trim();

    let path = "/api/sacadas";
    const p  = [];
    if (autor) p.push(`autor=${encodeURIComponent(autor)}`);
    if (busca) p.push(`busca=${encodeURIComponent(busca)}`);
    if (p.length) path += "?" + p.join("&");

    try {
        const res    = await fetch(path);
        const sacadas = await res.json();
        const tbody  = document.getElementById("sacadas-list");
        tbody.innerHTML = "";

        if (sacadas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma sacada encontrada.</td></tr>`;
            return;
        }

        sacadas.forEach(s => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${escHtml(s.autor)}</strong></td>
                <td><span style="color:var(--text-secondary);">${escHtml(s.video_titulo)}</span></td>
                <td><span class="badge-tag">${escHtml(s.gatilho)}</span></td>
                <td><blockquote>"${escHtml(s.trecho)}"</blockquote></td>
                <td>
                    <label class="switch">
                        <input type="checkbox" ${s.compartilhavel ? "checked" : ""}
                               onchange="toggleShare(${s.id}, this.checked)">
                        <span class="slider"></span>
                    </label>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

async function toggleShare(id, checked) {
    try {
        await fetch(`/api/sacadas/${id}/share`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ compartilhavel: checked ? 1 : 0 })
        });
    } catch (e) { console.error(e); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grafo Neural (Vis.js)
// ─────────────────────────────────────────────────────────────────────────────
let physicsEnabled = true;

async function loadGraph(autorFilter) {
    const loading = document.getElementById("graph-loading");
    const emptyEl = document.getElementById("graph-empty");
    if (loading) loading.style.display = "flex";
    if (emptyEl) emptyEl.style.display = "none";

    try {
        let url = "/api/graph";
        if (autorFilter) url += `?autor=${encodeURIComponent(autorFilter)}`;

        const res  = await fetch(url);
        const data = await res.json();

        // Popula filtro de autores na primeira carga
        const selFilter = document.getElementById("graph-filter-autor");
        if (selFilter && data.autores && !autorFilter) {
            selFilter.innerHTML = `<option value="">🌐 Todos os canais</option>`;
            data.autores.forEach(a => {
                selFilter.innerHTML += `<option value="${escHtml(a)}">${escHtml(a)}</option>`;
            });
        }

        // Atualiza estatísticas
        const byGroup = {};
        data.nodes.forEach(n => { byGroup[n.group] = (byGroup[n.group] || 0) + 1; });
        const gs = id => { const el = document.getElementById(id); if (el) el.innerText = byGroup[id.replace("gs-", "")] || 0; };
        ["gs-canais","gs-videos","gs-temas","gs-sacadas"].forEach(g => {
            const el = document.getElementById(g);
            if (!el) return;
            const key = { "gs-canais": "autor", "gs-videos": "video", "gs-temas": "tema", "gs-sacadas": "sacada" }[g];
            el.innerText = byGroup[key] || 0;
        });

        if (loading) loading.style.display = "none";

        if (!data.nodes.length) {
            if (emptyEl) emptyEl.style.display = "flex";
            return;
        }

        const container = document.getElementById("graph-canvas");

        const options = {
            nodes: {
                shape: "dot",
                font: { color: "#e8e8f0", size: 11, face: "Inter", strokeWidth: 3, strokeColor: "rgba(0,0,0,.6)" },
                borderWidth: 2.5,
                shadow: { enabled: true, color: "rgba(0,0,0,.5)", size: 12, x: 0, y: 4 },
                chosen: true
            },
            edges: {
                color: { color: "rgba(100,100,140,.35)", highlight: "#00f2fe", hover: "#4facfe" },
                width: 1.2,
                hoverWidth: 2.5,
                smooth: { type: "dynamic", roundness: 0.5 },
                font: { color: "rgba(200,200,220,.5)", size: 9, face: "Inter" },
                arrows: { to: { enabled: true, scaleFactor: 0.5 } },
                label: ""  // labels desativados por padrão para não poluir
            },
            groups: {
                autor: {
                    color: { background: "#ffd600", border: "#c8a800", highlight: { background: "#ffe040", border: "#ffd600" } },
                    shape: "star", font: { size: 13, bold: true, color: "#1a1a2e" }
                },
                video: {
                    color: { background: "#1a6fa8", border: "#4facfe", highlight: { background: "#4facfe", border: "#00f2fe" } },
                    shape: "box", borderRadius: 4, font: { size: 10 }
                },
                tema: {
                    color: { background: "#5c2d91", border: "#9b59b6", highlight: { background: "#9b59b6", border: "#d7a8ff" } },
                    shape: "diamond", font: { size: 11, color: "#e0c0ff" }
                },
                sacada: {
                    color: { background: "#005c30", border: "#00e676", highlight: { background: "#00e676", border: "#69ffa2" } },
                    shape: "ellipse", font: { size: 9, color: "#c0ffd8" }
                },
            },
            physics: {
                forceAtlas2Based: {
                    gravitationalConstant: -80,
                    centralGravity: 0.005,
                    springLength: 120,
                    springConstant: 0.06,
                    avoidOverlap: 0.4
                },
                solver: "forceAtlas2Based",
                stabilization: { iterations: 200, updateInterval: 25 }
            },
            interaction: {
                hover: true,
                tooltipDelay: 300,
                zoomView: true,
                navigationButtons: false,
                keyboard: { enabled: true }
            }
        };

        const visData = {
            nodes: new vis.DataSet(data.nodes),
            edges: new vis.DataSet(data.edges)
        };

        network = new vis.Network(container, visData, options);

        network.on("stabilizationIterationsDone", () => {
            network.setOptions({ physics: { enabled: physicsEnabled } });
        });

        network.on("click", params => {
            if (params.nodes.length > 0) {
                showNodeDetails(params.nodes[0], visData.nodes.get(params.nodes[0]));
            } else {
                // clicou em aresta ou fundo — limpa seleção sem apagar painel
            }
        });

        network.on("hoverNode", params => {
            container.style.cursor = "pointer";
        });
        network.on("blurNode", () => {
            container.style.cursor = "default";
        });

    } catch (e) {
        console.error("Erro no grafo:", e);
        if (loading) loading.style.display = "none";
    }
}

function filterGraph() {
    const autor = document.getElementById("graph-filter-autor").value;
    loadGraph(autor || undefined);
}

function graphFitAll() {
    if (network) network.fit({ animation: { duration: 800, easingFunction: "easeInOutQuad" } });
}

function graphTogglePhysics() {
    physicsEnabled = !physicsEnabled;
    if (network) network.setOptions({ physics: { enabled: physicsEnabled } });
    const btn = document.getElementById("btn-physics");
    if (btn) btn.innerHTML = physicsEnabled
        ? `<i class="fa-solid fa-pause"></i> Pausar`
        : `<i class="fa-solid fa-play"></i> Retomar`;
}

function showNodeDetails(id, node) {
    const details = document.getElementById("node-details");
    if (!node) return;

    const typeColors = {
        autor:  { label: "Canal / Autor",   icon: "fa-star",       color: "#ffd600" },
        video:  { label: "Vídeo",            icon: "fa-film",       color: "#4facfe" },
        tema:   { label: "Tema / Gatilho",   icon: "fa-hashtag",    color: "#9b59b6" },
        sacada: { label: "Sacada Extraída",  icon: "fa-quote-left", color: "#00e676" },
    };
    const t = typeColors[node.group] || { label: "Nota", icon: "fa-circle", color: "#888" };

    let content = "";

    if (node.group === "autor") {
        content = `
            <div class="node-stat"><i class="fa-solid fa-lightbulb"></i>
                ${node.sacadas || "—"} sacada(s) extraída(s)
            </div>
            <button class="btn-secondary" style="margin-top:10px; font-size:12px;"
                onclick="document.getElementById('graph-filter-autor').value='${escHtml(node.label)}'; filterGraph();">
                <i class="fa-solid fa-filter"></i> Filtrar por este canal
            </button>`;
    } else if (node.group === "video") {
        content = `
            <div class="node-stat"><i class="fa-solid fa-user-tie"></i> ${escHtml(node.autor || "—")}</div>
            <div class="node-stat" style="margin-top:6px; font-size:12px; color:var(--text-secondary);">${escHtml(node.full_title || "")}</div>`;
    } else if (node.group === "tema") {
        content = `
            <div class="node-stat"><i class="fa-solid fa-repeat"></i>
                ${node.ocorrencias || "—"} ocorrência(s) no banco
            </div>
            <p style="color:var(--text-secondary); font-size:12px; margin-top:6px;">
                Este gatilho conecta sacadas de múltiplos canais no mapa.
            </p>`;
    } else if (node.group === "sacada") {
        content = `
            <div class="node-stat"><i class="fa-solid fa-user-tie"></i> ${escHtml(node.autor || "—")}</div>
            <div class="node-stat" style="margin-top:4px;"><i class="fa-solid fa-hashtag"></i> ${escHtml(node.gatilho || "—")}</div>
            <blockquote style="margin-top:10px; font-size:13px; border-left-color:var(--accent-emerald);">"${escHtml(node.trecho || "")}"</blockquote>
            <small style="color:var(--text-secondary);">${escHtml(node.video || "")} · ${escHtml(node.data || "")}</small>`;
    }

    details.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
            <div style="width:36px; height:36px; border-radius:50%; background:${t.color}22;
                        border:2px solid ${t.color}; display:flex; align-items:center; justify-content:center;
                        color:${t.color}; font-size:15px; flex-shrink:0;">
                <i class="fa-solid ${t.icon}"></i>
            </div>
            <div>
                <h4 style="color:${t.color}; font-size:13px;">${t.label}</h4>
                <p style="font-size:13px; font-weight:600;">${escHtml(node.label)}</p>
            </div>
        </div>
        ${content}`;
}


// ─────────────────────────────────────────────────────────────────────────────
// Varredura e Terminal
// ─────────────────────────────────────────────────────────────────────────────
function startQuickScan() {
    const url = document.getElementById("quick-url").value.trim();
    if (!url) return;
    document.getElementById("scanner-url").value = url;
    switchTab("scanner");
    startFullScan();
}

async function startFullScan() {
    const url      = document.getElementById("scanner-url").value.trim();
    const delay    = parseFloat(document.getElementById("scanner-delay").value) || 5.0;
    const langs    = document.getElementById("scanner-lang").value.split(",").map(l => l.trim()).filter(Boolean);
    const share    = document.getElementById("scanner-share").checked ? 1 : 0;
    const btn      = document.getElementById("btn-full-scan");
    const btnStop  = document.getElementById("btn-stop-scan");

    if (!url) { alert("Insira uma URL antes de iniciar!"); return; }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...`;
    if (btnStop) btnStop.style.display = "flex";

    try {
        const res  = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, languages: langs, delay, pasta_salvar: "transcricoes", compartilhavel: share })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Erro ao iniciar.");
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-play"></i> Iniciar Varredura`;
            if (btnStop) btnStop.style.display = "none";
        }
    } catch (e) {
        console.error(e);
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-play"></i> Iniciar Varredura`;
        if (btnStop) btnStop.style.display = "none";
    }
}

async function stopScan() {
    try {
        const res  = await fetch("/api/stop", { method: "POST" });
        const data = await res.json();
        // Feedback visual imediato
        const btnStop = document.getElementById("btn-stop-scan");
        const btnStopOv = document.getElementById("btn-stop-overview");
        if (btnStop) { btnStop.disabled = true; btnStop.innerHTML = `<i class="fa-solid fa-hourglass-half fa-spin"></i> Aguardando vídeo atual...`; }
        if (btnStopOv) { btnStopOv.disabled = true; btnStopOv.innerHTML = `<i class="fa-solid fa-hourglass-half fa-spin"></i> Parando...`; }
        console.log(data.message);
    } catch (e) {
        console.error("Erro ao parar:", e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Polling de Status / Logs
// ─────────────────────────────────────────────────────────────────────────────
function startLogPolling() {
    if (logPollInterval) clearInterval(logPollInterval);

    logPollInterval = setInterval(async () => {
        try {
            const res  = await fetch("/api/status");
            const data = await res.json();
            const st   = data.status;
            const logs = data.logs || [];

            const dot     = document.getElementById("status-dot");
            const statusTxt = document.getElementById("status-text");

            if (st.running) {
                dot.className   = "pulse-dot running";
                statusTxt.innerText = "⚙️ Processando...";
                wasRunning = true;

                // Mostra botões de parar
                const btnStopScan = document.getElementById("btn-stop-scan");
                const btnStopOv   = document.getElementById("btn-stop-overview");
                if (btnStopScan) btnStopScan.style.display = "flex";
                if (btnStopOv)   { btnStopOv.style.display = "flex"; btnStopOv.disabled = false; btnStopOv.innerHTML = `<i class="fa-solid fa-stop"></i> Parar`; }
            } else {
                dot.className   = "pulse-dot";
                statusTxt.innerText = "Sistema Pronto";

                // Oculta botões de parar
                const btnStopScan = document.getElementById("btn-stop-scan");
                const btnStopOv   = document.getElementById("btn-stop-overview");
                if (btnStopScan) btnStopScan.style.display = "none";
                if (btnStopOv)   btnStopOv.style.display = "none";

                // Quando acabou: reativa botões e atualiza dados
                if (wasRunning) {
                    wasRunning = false;
                    const btnFs = document.getElementById("btn-full-scan");
                    if (btnFs) { btnFs.disabled = false; btnFs.innerHTML = `<i class="fa-solid fa-play"></i> Iniciar Varredura`; }
                    loadOverviewStats();
                    loadSacadas();
                    loadAutores();
                    loadTranscriptList();
                    loadChannels();
                }
            }

            // Renderiza logs no console do Scanner
            const consoleEl = document.getElementById("log-console");
            if (consoleEl && logs.length) {
                consoleEl.innerHTML = "";
                logs.forEach(line => {
                    const p = document.createElement("p");
                    p.className = "log-line";
                    if (line.includes("❌") || line.includes("ERRO") || line.includes("Erro")) p.classList.add("error");
                    else if (line.includes("✅") || line.includes("✨") || line.includes("Concluído")) p.classList.add("success");
                    else if (line.includes("🔍") || line.includes("📊") || line.includes("📂")) p.classList.add("info");
                    p.innerText = line;
                    consoleEl.appendChild(p);
                });
                consoleEl.scrollTop = consoleEl.scrollHeight;
            }

            // Mini-log no painel geral se estiver processando
            const overviewCard    = document.getElementById("overview-log-card");
            const overviewConsole = document.getElementById("overview-log-console");
            if (overviewCard && overviewConsole) {
                if (st.running && logs.length) {
                    overviewCard.style.display = "block";
                    overviewConsole.innerHTML  = "";
                    const last5 = logs.slice(-5);
                    last5.forEach(line => {
                        const p = document.createElement("p");
                        p.className = "log-line";
                        p.innerText = line;
                        overviewConsole.appendChild(p);
                    });
                } else if (!st.running) {
                    overviewCard.style.display = "none";
                }
            }
        } catch (e) {
            console.error("Erro no polling:", e);
        }
    }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
