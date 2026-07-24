import os
import sys
import re
import sqlite3
import datetime
from typing import Optional, List
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from playlist_transcriber import (
    inicializar_banco_de_dados,
    processar_url_principal,
    PASTA_BASE,
    limpar_nome,
    stop_processing,
    reset_stop_event,
)

app = FastAPI(title="SocialScribe Local API")

# ---------------------------------------------------------------------------
# Banco de Dados
# ---------------------------------------------------------------------------

def inicializar_tabelas():
    inicializar_banco_de_dados()
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS canais_favoritos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        ultimo_check TEXT,
        avatar_url TEXT
    )""")
    conn.commit()
    conn.close()

inicializar_tabelas()

# ---------------------------------------------------------------------------
# Captura de Stdout → Logs em Memória
# ---------------------------------------------------------------------------

active_logs: List[str] = []
processing_status = {
    "running": False,
    "current_url": "",
    "current_item": "",
    "erros": 0,
    "finished_url": "",       # URL processada por último (para refresh automático)
}

class QueueStream:
    def __init__(self, original):
        self.original = original

    def write(self, text):
        self.original.write(text)
        cleaned = text.strip()
        if cleaned:
            # Substitui a última linha se for barra de progresso
            if "%" in cleaned and ("[" in cleaned or "]" in cleaned):
                if active_logs and "%" in active_logs[-1]:
                    active_logs[-1] = cleaned
                else:
                    active_logs.append(cleaned)
            else:
                active_logs.append(cleaned)
            if len(active_logs) > 300:
                active_logs.pop(0)

    def flush(self):
        self.original.flush()

sys.stdout = QueueStream(sys.stdout)

# ---------------------------------------------------------------------------
# Modelos Pydantic
# ---------------------------------------------------------------------------

class ChannelAdd(BaseModel):
    url: str
    nome: str = ""  # pode ser passado pelo frontend; se vazio, detectamos

class TranscribeRequest(BaseModel):
    url: str
    languages: List[str] = ["pt", "en"]
    delay: float = 5.0
    pasta_salvar: str = PASTA_BASE
    compartilhavel: int = 1

class ShareToggle(BaseModel):
    compartilhavel: int

class SaveTextRequest(BaseModel):
    text: str

class SacadaItem(BaseModel):
    autor: str
    video_titulo: str
    gatilho: str
    categoria: str = ""
    trecho: str
    compartilhavel: int = 1

class SacadaBatchRequest(BaseModel):
    sacadas: List[SacadaItem]

# ---------------------------------------------------------------------------
# Canais Favoritos
# ---------------------------------------------------------------------------

@app.get("/api/channels")
def get_channels():
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    c = conn.cursor()
    c.execute("SELECT id, url, nome, tipo, ultimo_check FROM canais_favoritos ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    return [{"id": r[0], "url": r[1], "nome": r[2], "tipo": r[3], "ultimo_check": r[4]} for r in rows]

@app.post("/api/channels")
def add_channel(channel: ChannelAdd):
    url = channel.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL não pode ser vazia.")

    tipo = "youtube"
    if "tiktok.com" in url:
        tipo = "tiktok"
    elif "instagram.com" in url:
        tipo = "instagram"

    # Nome: usa o que veio do frontend ou extrai do domínio como fallback rápido
    nome = channel.nome.strip()
    if not nome:
        # Tenta extrair @handle ou um nome legível da URL sem chamar yt_dlp
        m = re.search(r'@([^/?&]+)', url)
        if m:
            nome = "@" + m.group(1)
        else:
            m2 = re.search(r'channel/([^/?&]+)', url)
            nome = m2.group(1)[:30] if m2 else url.split("/")[-1][:40] or "Canal"

    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    c = conn.cursor()
    try:
        c.execute(
            "INSERT INTO canais_favoritos (url, nome, tipo, ultimo_check) VALUES (?, ?, ?, ?)",
            (url, nome, tipo, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Este canal já está nos favoritos.")
    conn.close()
    return {"message": "Canal adicionado!", "nome": nome}

@app.delete("/api/channels/{channel_id}")
def delete_channel(channel_id: int):
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    c = conn.cursor()
    c.execute("DELETE FROM canais_favoritos WHERE id = ?", (channel_id,))
    conn.commit()
    conn.close()
    return {"message": "Canal removido."}

# ---------------------------------------------------------------------------
# Transcrições — leitura dos arquivos .txt salvos
# ---------------------------------------------------------------------------

@app.get("/api/transcripts")
def list_transcripts():
    """Varre a pasta de transcrições e retorna a estrutura autor → vídeos."""
    result = []
    if not os.path.exists(PASTA_BASE):
        return result
    for canal in sorted(os.listdir(PASTA_BASE)):
        caminho_canal = os.path.join(PASTA_BASE, canal)
        if not os.path.isdir(caminho_canal):
            continue
        videos = []
        for f in sorted(os.listdir(caminho_canal)):
            if (
                f.endswith(".txt")
                and f not in {"resultado_transcricoes.txt", "palavras_chave.txt", "sacadas.txt"}
                and "_Obsidian" not in f
                and "_links" not in f
                and "_relatorio" not in f
            ):
                videos.append({"arquivo": f, "titulo": f[:-4]})
        if videos:
            result.append({"autor": canal, "videos": videos})
    return result

@app.get("/api/transcripts/{autor}")
def get_all_transcripts_for_autor(autor: str):
    """Concatena todos os .txt de um canal em um único texto para análise em lote."""
    caminho_canal = os.path.join(PASTA_BASE, autor)
    if not os.path.isdir(caminho_canal):
        raise HTTPException(status_code=404, detail="Autor não encontrado.")
    
    IGNORE = {"resultado_transcricoes.txt", "palavras_chave.txt", "sacadas.txt"}
    arquivos = sorted([
        f for f in os.listdir(caminho_canal)
        if f.endswith(".txt") and f not in IGNORE
        and "_Obsidian" not in f and "_links" not in f and "_relatorio" not in f
    ])
    
    if not arquivos:
        raise HTTPException(status_code=404, detail="Nenhum arquivo de transcrição encontrado para este autor.")
    
    partes = []
    for nome_arquivo in arquivos:
        caminho = os.path.join(caminho_canal, nome_arquivo)
        try:
            with open(caminho, "r", encoding="utf-8") as f:
                conteudo = f.read().strip()
                if conteudo:
                    titulo = nome_arquivo[:-4]
                    partes.append(f"── {titulo} ──\n{conteudo}")
        except Exception:
            pass
    
    texto_completo = "\n\n".join(partes)
    return {
        "autor": autor,
        "total_videos": len(arquivos),
        "arquivos": arquivos,
        "content": texto_completo
    }

@app.get("/api/transcripts/{autor}/{arquivo}")
def get_transcript(autor: str, arquivo: str):
    """Retorna o conteúdo de um arquivo .txt transcrito."""
    caminho = os.path.join(PASTA_BASE, autor, arquivo)
    if not caminho.endswith(".txt"):
        caminho += ".txt"
    if not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            return {"content": f.read(), "autor": autor, "titulo": arquivo.replace(".txt", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcripts/{autor}/{arquivo}")
def save_transcript(autor: str, arquivo: str, payload: SaveTextRequest):
    """Salva edições em um arquivo de transcrição."""
    caminho = os.path.join(PASTA_BASE, autor, arquivo)
    if not caminho.endswith(".txt"):
        caminho += ".txt"
    try:
        with open(caminho, "w", encoding="utf-8") as f:
            f.write(payload.text)
        return {"message": "Salvo com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Sacadas
# ---------------------------------------------------------------------------

@app.post("/api/sacadas/batch")
def save_sacadas_batch(payload: SacadaBatchRequest):
    """Salva um lote de sacadas extraídas pelo frontend no banco SQLite."""
    if not payload.sacadas:
        raise HTTPException(status_code=400, detail="Nenhuma sacada enviada.")

    agora = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    c = conn.cursor()
    salvas = 0
    for s in payload.sacadas:
        try:
            c.execute("""
            INSERT OR IGNORE INTO sacadas_extraidas
                (autor, video_titulo, gatilho, trecho, data_extracao, compartilhavel)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (s.autor, s.video_titulo, s.gatilho, s.trecho, agora, s.compartilhavel))
            if c.rowcount > 0:
                salvas += 1
        except Exception:
            pass
    conn.commit()
    conn.close()
    return {
        "message": f"{salvas} sacada(s) salva(s) no banco de dados!",
        "total_enviadas": len(payload.sacadas),
        "total_salvas": salvas
    }

@app.get("/api/sacadas")
def get_sacadas(autor: Optional[str] = None, busca: Optional[str] = None):
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    c = conn.cursor()
    query = "SELECT id, autor, video_titulo, gatilho, trecho, data_extracao, compartilhavel FROM sacadas_extraidas"
    params, conds = [], []
    if autor:
        conds.append("autor = ?"); params.append(autor)
    if busca:
        conds.append("(trecho LIKE ? OR video_titulo LIKE ?)")
        params += [f"%{busca}%", f"%{busca}%"]
    if conds:
        query += " WHERE " + " AND ".join(conds)
    query += " ORDER BY id DESC"
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    return [
        {"id": r[0], "autor": r[1], "video_titulo": r[2], "gatilho": r[3],
         "trecho": r[4], "data_extracao": r[5], "compartilhavel": r[6]}
        for r in rows
    ]

@app.post("/api/sacadas/{sacada_id}/share")
def toggle_share(sacada_id: int, payload: ShareToggle):
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    c = conn.cursor()
    c.execute("UPDATE sacadas_extraidas SET compartilhavel = ? WHERE id = ?",
              (payload.compartilhavel, sacada_id))
    conn.commit()
    conn.close()
    return {"message": "Atualizado."}

@app.get("/api/autores")
def get_autores():
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    c = conn.cursor()
    c.execute("SELECT DISTINCT autor FROM sacadas_extraidas ORDER BY autor")
    rows = c.fetchall()
    conn.close()
    return [r[0] for r in rows]

# ---------------------------------------------------------------------------
# Grafo Neural
# ---------------------------------------------------------------------------

@app.get("/api/graph")
def get_graph(autor: Optional[str] = None):
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    c = conn.cursor()

    query = "SELECT autor, video_titulo, gatilho, trecho, id, data_extracao FROM sacadas_extraidas"
    params = []
    if autor:
        query += " WHERE autor = ?"
        params.append(autor)
    c.execute(query, params)
    rows = c.fetchall()

    # Calcula peso: quantas sacadas por autor e por gatilho
    from collections import Counter
    autor_count   = Counter(r[0] for r in rows)
    gatilho_count = Counter(r[2] for r in rows)

    conn.close()

    nodes, edges = [], []
    added  = set()

    for autor, video, gatilho, trecho, s_id, data_ext in rows:
        a_id   = f"a_{limpar_nome(autor)}"
        v_id   = f"v_{limpar_nome(video)}"
        t_id   = f"t_{limpar_nome(gatilho)}"
        s_nid  = f"s_{s_id}"

        # ── Canal/Autor ──
        if a_id not in added:
            cnt = autor_count[autor]
            nodes.append({
                "id": a_id, "label": autor, "group": "autor",
                "title": f"<b>{autor}</b><br>{cnt} sacada(s)",
                "value": max(20, cnt * 4),
                "sacadas": cnt
            })
            added.add(a_id)

        # ── Vídeo ──
        if v_id not in added:
            lbl = (video[:30] + "…") if len(video) > 30 else video
            nodes.append({
                "id": v_id, "label": lbl, "group": "video",
                "title": f"<b>{video}</b><br>Canal: {autor}",
                "value": 14, "autor": autor, "full_title": video
            })
            added.add(v_id)

        # ── Tema/Gatilho (nó cross-canal — conecta tudo que tem o mesmo gatilho) ──
        if t_id not in added:
            cnt_t = gatilho_count[gatilho]
            nodes.append({
                "id": t_id, "label": f"#{gatilho}", "group": "tema",
                "title": f"<b>Tema:</b> {gatilho}<br>{cnt_t} ocorrência(s)",
                "value": max(10, cnt_t * 3),
                "ocorrencias": cnt_t
            })
            added.add(t_id)

        # ── Sacada ──
        if s_nid not in added:
            lbl2 = (trecho[:38] + "…") if len(trecho) > 38 else trecho
            nodes.append({
                "id": s_nid, "label": f""{lbl2}"", "group": "sacada",
                "title": f"<b>{autor}</b> · {gatilho}<br><i>"{trecho}"</i><br>{data_ext or ''}",
                "value": 8, "trecho": trecho, "autor": autor,
                "video": video, "gatilho": gatilho, "data": data_ext or ""
            })
            added.add(s_nid)

        # ── Arestas: canal → vídeo → sacada → tema ──
        for frm, to, lbl_e in [
            (a_id,  v_id,  "possui"),
            (v_id,  s_nid, "gerou"),
            (s_nid, t_id,  "tema"),
        ]:
            key = frm + "|" + to
            if key not in added:
                edges.append({"from": frm, "to": to, "label": lbl_e})
                added.add(key)

    # Lista de autores únicos para o filtro
    autores = sorted(set(r[0] for r in rows))
    return {"nodes": nodes, "edges": edges, "autores": autores}


# ---------------------------------------------------------------------------
# Varredura em Background
# ---------------------------------------------------------------------------

def background_worker(url, languages, delay, pasta_salvar, compartilhavel):
    global processing_status
    reset_stop_event()  # Garante que o flag de parada está limpo
    processing_status.update({"running": True, "current_url": url,
                               "current_item": "Iniciando…", "erros": 0, "finished_url": ""})
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    conn.execute("UPDATE canais_favoritos SET ultimo_check = ? WHERE url = ?",
                 (datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), url))
    conn.commit()
    conn.close()
    try:
        processar_url_principal(
            url=url, languages=languages, delay=delay,
            pasta_salvar=pasta_salvar, compartilhavel=compartilhavel
        )
    except Exception as e:
        print(f"❌ Erro fatal: {e}")
        processing_status["erros"] += 1
    finally:
        processing_status.update({"running": False, "current_item": "✅ Concluído!",
                                   "finished_url": url})

@app.post("/api/stop")
def stop_transcribe():
    """Sinaliza para o worker em execução parar após concluir o vídeo atual."""
    if not processing_status["running"]:
        raise HTTPException(status_code=400, detail="Nenhum processo em execução no momento.")
    stop_processing()
    print("🛑 Parada solicitada pela interface web. Aguardando o vídeo atual finalizar...")
    return {"message": "Sinal de parada enviado. O processo será encerrado após o vídeo atual."}

@app.post("/api/transcribe")
def start_transcribe(req: TranscribeRequest, background_tasks: BackgroundTasks):
    if processing_status["running"]:
        raise HTTPException(status_code=400, detail="Já existe um processo em execução.")
    active_logs.clear()
    background_tasks.add_task(
        background_worker,
        url=req.url, languages=req.languages, delay=req.delay,
        pasta_salvar=req.pasta_salvar, compartilhavel=req.compartilhavel
    )
    return {"message": "Processamento iniciado."}

@app.get("/api/status")
def get_status():
    return {"status": processing_status, "logs": active_logs[-80:]}

# ---------------------------------------------------------------------------
# Arquivos Estáticos + Raiz
# ---------------------------------------------------------------------------

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def serve_home():
    return FileResponse("static/index.html")
