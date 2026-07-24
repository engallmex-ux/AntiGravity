import os
import re
import sys
import time
import random
import threading
import subprocess
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

# ─── Controle de Parada Graceful (chamado pela API /api/stop) ───────────────
_stop_event = threading.Event()

def stop_processing():
    """Sinaliza para todos os loops de processamento que devem parar após o vídeo atual."""
    _stop_event.set()

def reset_stop_event():
    """Limpa o sinal de parada antes de iniciar um novo processamento."""
    _stop_event.clear()

# Configura o terminal para UTF-8 no Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

PASTA_BASE = "transcricoes"
ARQUIVO_COOKIES = "cookies.txt"

def limpar_tela():
    """
    Limpa o console do terminal no Windows ou Linux.
    """
    os.system('cls' if os.name == 'nt' else 'clear')

def exibir_cabecalho():
    """
    Exibe o cabeçalho principal da aplicação com descrição, créditos e versão.
    """
    print("=============================================================")
    print("            SOCIALSCRIBE - TRANSCRIÇÕES INTELIGENTES           ")
    print("=============================================================")
    print("  Versão: Antigravity 2.0 | Criado em: 09/07/2026")
    print("  Créditos: Lucas Fonseca & Antigravity (IA)")
    print("=============================================================")
    print("  Funcionalidades:")
    print("  - Extração de legendas/áudio em Português e Inglês")
    print("  - Importação automática de cookies de login dos navegadores")
    print("  - Relatório analítico final com ganchos e palavras-chave (SEO)")
    print("  - Estudo de tags/hashtags exportado em 'palavras_chave.txt'")
    print("  - Suporte a múltiplos caminhos de salvamento (ex: Pendrives)")
    print("=============================================================")
    print("  💡 DICA: Pressione Ctrl+C a qualquer momento para CANCELAR a")
    print("     extração atual e voltar a este menu.")
    print("  💡 DICA: Para PAUSAR a tela no Windows, pressione 'Pause Break'")
    print("     ou clique no console. Pressione Enter para continuar.")
    print("=============================================================")

# Mapeamento de códigos de idioma curtos para tags usadas pelo yt-dlp/TikTok
MAPA_LANGS_YTDLP = {
    'pt': 'por-PT,pt',
    'en': 'eng-US,en',
    'es': 'spa,es',
    'it': 'ita,it',
    'fr': 'fra,fr',
    'de': 'deu,de',
}

def limpar_nome(nome):
    """
    Remove caracteres inválidos para nomes de diretórios/arquivos no Windows.
    """
    nome_limpo = re.sub(r'[\\/*?:"<>|]', "", nome)
    nome_limpo = re.sub(r'\s+', " ", nome_limpo).strip()
    return nome_limpo

def extrair_id_video(url):
    """
    Extrai o ID de 11 caracteres de um link do YouTube.
    """
    padrao = r'(?:v=|\/shorts\/|\/embed\/|\/v\/|youtu\.be\/|\/v=|^)([^#\&\?^\/]{11})'
    resultado = re.search(padrao, url)
    return resultado.group(1) if resultado else None

def extrair_texto_vtt(caminho_vtt):
    """
    Lê um arquivo WebVTT e extrai apenas o texto legível.
    """
    if not os.path.exists(caminho_vtt):
        return ""
    linhas_texto = []
    with open(caminho_vtt, "r", encoding="utf-8") as f:
        linhas = f.readlines()
        
    pular_cabecalho = True
    for linha in linhas:
        linha = linha.strip()
        if not linha:
            continue
        if pular_cabecalho:
            if "WEBVTT" in linha or "Kind:" in linha or "Language:" in linha or "Style:" in linha:
                continue
            else:
                pular_cabecalho = False
                
        if "-->" in linha:
            continue
            
        if linha.isdigit():
            continue
            
        if linhas_texto and linhas_texto[-1] == linha:
            continue
            
        linhas_texto.append(linha)
        
    return " ".join(linhas_texto)

def baixar_legenda_vtt(url, video_id, pasta_destino, languages):
    """
    Usa o yt-dlp para baixar a legenda em VTT de plataformas como TikTok.
    """
    yt_dlp_path = os.path.join(".venv", "Scripts", "yt-dlp.exe")
    if not os.path.exists(yt_dlp_path):
        yt_dlp_path = "yt-dlp"
        
    caminho_vtt_temp = os.path.join(pasta_destino, f"temp_{video_id}")
    
    # Mapeia as línguas escolhidas para os formatos de legenda das plataformas
    sub_langs_list = []
    for lang in languages:
        sub_langs_list.append(MAPA_LANGS_YTDLP.get(lang, lang))
    sub_langs_str = ",".join(sub_langs_list)
    
    comando = [
        yt_dlp_path,
        "--no-warnings",
        "--skip-download",
        "--write-subs",
        "--sub-format", "vtt",
        "--sub-langs", sub_langs_str,
        "-o", caminho_vtt_temp,
    ]
    
    # Adiciona cookies se o arquivo cookies.txt existir
    if os.path.exists(ARQUIVO_COOKIES):
        comando.extend(["--cookies", ARQUIVO_COOKIES])
        
    comando.append(url)
    
    try:
        subprocess.run(comando, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        # Procura pelo arquivo VTT baixado respeitando a ordem de preferência de idioma do usuário
        for lang in languages:
            extensoes = MAPA_LANGS_YTDLP.get(lang, lang).split(",")
            for ext in extensoes:
                for f in os.listdir(pasta_destino):
                    if f.startswith(f"temp_{video_id}") and f.endswith(f".{ext}.vtt"):
                        return os.path.join(pasta_destino, f)
                        
        # Se não encontrar a preferência específica, aceita qualquer VTT que tenha sido gerado
        for f in os.listdir(pasta_destino):
            if f.startswith(f"temp_{video_id}") and f.endswith(".vtt"):
                return os.path.join(pasta_destino, f)
    except Exception:
        pass
    return None

def obter_info_url(url):
    """
    Extrai informações da URL via yt-dlp (YouTube, TikTok, etc.).
    """
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'no_warnings': True,
    }
    if os.path.exists(ARQUIVO_COOKIES):
        ydl_opts['cookiefile'] = ARQUIVO_COOKIES
        
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            return ydl.extract_info(url, download=False)
        except Exception as e:
            print(f"❌ Erro ao extrair informações da URL: {e}")
            return None

def exportar_cookies_do_navegador(navegador, caminho_saida):
    """
    Usa o yt-dlp para extrair os cookies do navegador escolhido e salvar em arquivo.
    """
    yt_dlp_path = os.path.join(".venv", "Scripts", "yt-dlp.exe")
    if not os.path.exists(yt_dlp_path):
        yt_dlp_path = "yt-dlp"
        
    # comando dummy do yt-dlp para apenas exportar cookies e fechar
    comando = [
        yt_dlp_path,
        "--no-warnings",
        "--cookies-from-browser", navegador,
        "--cookies", caminho_saida,
        "--skip-download",
        "https://www.youtube.com/watch?v=1LLWqbjIsVA"
    ]
    try:
        print(f"    🔑 Extraindo cookies do navegador '{navegador}' (isso pode exigir que o navegador esteja fechado)...")
        subprocess.run(comando, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        if os.path.exists(caminho_saida) and os.path.getsize(caminho_saida) > 0:
            print(f"    ✅ Arquivo '{caminho_saida}' criado/atualizado com sucesso com a sessão do '{navegador}'!")
            return True
    except Exception:
        print(f"    ⚠️ Falha ao importar cookies do '{navegador}'. Certifique-se de fechar o navegador e que você está logado nas redes sociais.")
    return False

def exibir_progresso(index, total, titulo, duracao):
    """
    Exibe uma barra de progresso no terminal.
    """
    percentual = (index / total) * 100
    largura_barra = 20
    carregado = int((index / total) * largura_barra)
    barra = "█" * carregado + "░" * (largura_barra - carregado)
    print(f"\n📊 [{index}/{total}] {percentual:.1f}% [{barra}] - Processando: '{titulo}' ({duracao})...")

def sleep_com_interrupcao(segundos):
    """
    Aguarda o tempo especificado em segundos de forma interativa.
    Permite pressionar ESC para cancelar ou Barra de Espaço para pausar.
    Retorna 'cancelar', 'pausar' ou None.
    """
    passos = int(segundos * 10)
    for _ in range(max(1, passos)):
        time.sleep(0.1)
        if os.name == 'nt':
            try:
                import msvcrt
                if msvcrt.kbhit():
                    tecla = msvcrt.getch()
                    if tecla == b'\x1b': # ESC
                        print("\n🛑 Cancelamento solicitado via teclado (ESC)!")
                        return "cancelar"
                    elif tecla == b' ': # Espaço
                        print("\n⏸️  Processo PAUSADO. Pressione qualquer tecla para continuar...")
                        msvcrt.getch() # Bloqueia até a próxima tecla ser pressionada
                        print("▶️  Retomando o processo...")
            except Exception:
                pass
    return None

def registrar_no_consolidado(caminho, url, titulo, duracao, texto):
    with open(caminho, "a", encoding="utf-8") as f:
        f.write("=" * 70 + "\n")
        f.write(f"TÍTULO: {titulo}\n")
        f.write(f"LINK: {url}\n")
        f.write(f"DURAÇÃO: {duracao}\n")
        f.write("=" * 70 + "\n")
        f.write(texto + "\n\n")

def transcrever_audio_local(video_id, url, pasta_destino, languages):
    """
    Baixa o áudio do vídeo via yt-dlp e realiza a transcrição local via SpeechRecognition (Google Web Speech API).
    Funciona como fallback caso não existam legendas/transcrições oficiais no YouTube.
    """
    print("    🎙️ Iniciando transcrição local via processamento de áudio...")
    
    # 1. Verifica se o FFmpeg está instalado
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except Exception:
        print("    ❌ Erro: O 'FFmpeg' não foi encontrado no sistema.")
        print("    💡 DICA: Baixe o FFmpeg (https://ffmpeg.org) e adicione-o ao PATH do Windows para habilitar esta função!")
        return None

    # 2. Define o caminho de saída temporário do áudio WAV
    caminho_wav_temp = os.path.join(pasta_destino, f"temp_audio_{video_id}.wav")
    
    # 3. Baixa e converte o áudio usando o yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(pasta_destino, f"temp_audio_{video_id}.%(ext)s"),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '144',
        }],
        'quiet': True,
        'no_warnings': True,
    }
    if os.path.exists(ARQUIVO_COOKIES):
        ydl_opts['cookiefile'] = ARQUIVO_COOKIES

    try:
        print("    📥 Baixando e convertendo fluxo de áudio para WAV...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except Exception as e:
        print(f"    ❌ Falha ao baixar áudio via yt-dlp: {e}")
        return None

    # Verifica se o arquivo WAV foi criado com sucesso
    if not os.path.exists(caminho_wav_temp):
        # Tenta achar se baixou com outra extensão
        for f in os.listdir(pasta_destino):
            if f.startswith(f"temp_audio_{video_id}") and f.endswith(".wav"):
                caminho_wav_temp = os.path.join(pasta_destino, f)
                break
        else:
            print("    ❌ Erro: O arquivo de áudio WAV não foi gerado.")
            return None

    # 4. Transcreve o arquivo WAV em blocos de 20 segundos via SpeechRecognition
    texto_completo = ""
    try:
        import speech_recognition as sr
        print("    🗣️ Reconhecendo voz e transcrevendo (isso pode levar alguns instantes)...")
        
        r = sr.Recognizer()
        with sr.AudioFile(caminho_wav_temp) as source:
            duracao = int(source.DURATION)
            bloco_segundos = 20
            lista_textos = []
            
            for offset in range(0, duracao, bloco_segundos):
                # Imprime micro barra de progresso do áudio
                perc = (offset / max(1, duracao)) * 100
                print(f"      [Processamento de Voz]: {perc:.1f}% concluído...", end="\r")
                
                audio_chunk = r.record(source, duration=bloco_segundos)
                try:
                    # Usa o motor de reconhecimento gratuito da API do Google
                    lang_code = languages[0]
                    if lang_code == 'pt':
                        lang_code = 'pt-BR'
                    elif lang_code == 'en':
                        lang_code = 'en-US'
                        
                    texto = r.recognize_google(audio_chunk, language=lang_code)
                    if texto.strip():
                        lista_textos.append(texto.strip())
                except sr.UnknownValueError:
                    pass
                except sr.RequestError as e_req:
                    print(f"\n    ⚠️ Falha na conexão com serviço de voz do Google: {e_req}")
                    break
            
            print("\n    ✅ Transcrição de áudio concluída!")
            texto_completo = " ".join(lista_textos)
            
    except Exception as e_trans:
        print(f"    ❌ Falha na inicialização do SpeechRecognition: {e_trans}")
    finally:
        # 5. Limpa o arquivo de áudio temporário para economizar espaço
        try:
            if os.path.exists(caminho_wav_temp):
                os.remove(caminho_wav_temp)
        except Exception:
            pass

    return texto_completo if texto_completo.strip() else None

def processar_video_youtube(video_id, url, pasta_destino, caminho_links, index, total, languages, delay, erros_acumulados):
    """
    Faz a transcrição de um vídeo do YouTube.
    """
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'no_warnings': True,
    }
    if os.path.exists(ARQUIVO_COOKIES):
        ydl_opts['cookiefile'] = ARQUIVO_COOKIES
        
    titulo_video = None
    duracao_formatada = "Desconhecida"
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            titulo_video = info.get('title')
            duracao_segundos = info.get('duration')
            if duracao_segundos:
                duracao_segundos = int(duracao_segundos)
                horas = duracao_segundos // 3600
                minutos = (duracao_segundos % 3600) // 60
                segundos = duracao_segundos % 60
                if horas > 0:
                    duracao_formatada = f"{horas:02d}:{minutos:02d}:{segundos:02d}"
                else:
                    duracao_formatada = f"{minutos:02d}:{segundos:02d}"
        except Exception:
            pass
            
    if not titulo_video:
        titulo_video = f"Video_{video_id}"
        
    exibir_progresso(index, total, titulo_video, duracao_formatada)
    nome_arquivo_limpo = limpar_nome(titulo_video)
    
    try:
        # Pausa dinâmica com Jitter
        tempo_espera = delay * random.uniform(0.8, 1.2)
        print(f"    ⏳ Aguardando {tempo_espera:.1f} segundos de segurança (Pressione ESPAÇO para pausar ou ESC para sair)...")
        if sleep_com_interrupcao(tempo_espera) == "cancelar":
            raise KeyboardInterrupt
        
        # Carrega cookies usando requests.Session para compatibilidade com o youtube_transcript_api v1.2.4+
        import requests
        import http.cookiejar
        
        session = requests.Session()
        if os.path.exists(ARQUIVO_COOKIES):
            try:
                cookie_jar = http.cookiejar.MozillaCookieJar(ARQUIVO_COOKIES)
                cookie_jar.load(ignore_discard=True, ignore_expires=True)
                session.cookies = cookie_jar
            except Exception:
                pass
                
        api = YouTubeTranscriptApi(http_client=session)
        lista_transcricao = api.fetch(video_id, languages=languages)
        texto_completo = " ".join([item.text for item in lista_transcricao])
        
        caminho_arquivo = os.path.join(pasta_destino, f"{nome_arquivo_limpo}.txt")
        with open(caminho_arquivo, "w", encoding="utf-8") as f:
            f.write(texto_completo)
            
        print(f"    ✅ Transcrição salva!")
        caminho_consolidado = os.path.join(pasta_destino, "resultado_transcricoes.txt")
        registrar_no_consolidado(caminho_consolidado, url, titulo_video, duracao_formatada, texto_completo)
        
    except (NoTranscriptFound, TranscriptsDisabled, Exception) as e:
        # Se for um vídeo único (total == 1), tenta transcrever por áudio local como fallback
        if total == 1:
            texto_completo = transcrever_audio_local(video_id, url, pasta_destino, languages)
            if texto_completo:
                caminho_arquivo = os.path.join(pasta_destino, f"{nome_arquivo_limpo}.txt")
                with open(caminho_arquivo, "w", encoding="utf-8") as f:
                    f.write(texto_completo)
                print(f"    ✅ Transcrição (por áudio local) salva!")
                caminho_consolidado = os.path.join(pasta_destino, "resultado_transcricoes.txt")
                registrar_no_consolidado(caminho_consolidado, url, titulo_video, duracao_formatada, texto_completo)
                return
                
        # Caso contrário (ou se a transcrição local falhar), reporta o erro original
        if isinstance(e, NoTranscriptFound):
            idiomas_str = ", ".join(languages)
            print(f"    ⚠️ Legenda não encontrada no vídeo.")
            erros_acumulados.append((titulo_video, url, f"Nenhuma legenda em ({idiomas_str}) encontrada."))
        elif isinstance(e, TranscriptsDisabled):
            print(f"    🚫 Legendas desativadas para este vídeo.")
            erros_acumulados.append((titulo_video, url, "Legendas desativadas no vídeo."))
        else:
            print(f"    ❌ Falha ao processar.")
            err_msg = str(e)
            if "blocking requests" in err_msg or "429" in err_msg:
                err_simplificado = "YouTube bloqueou o IP (Rate limit). Verifique a dica de Cookies."
            else:
                err_simplificado = err_msg.split("\n")[0][:120]
            erros_acumulados.append((titulo_video, url, err_simplificado))

def processar_video_tiktok(url, pasta_destino, caminho_links, index, total, languages, delay, erros_acumulados):
    """
    Faz a transcrição de um vídeo do TikTok baixando a legenda autogerada em VTT.
    """
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'no_warnings': True,
    }
    if os.path.exists(ARQUIVO_COOKIES):
        ydl_opts['cookiefile'] = ARQUIVO_COOKIES
        
    titulo_video = None
    duracao_formatada = "Desconhecida"
    video_id = None
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            titulo_video = info.get('title')
            video_id = info.get('id')
            duracao_segundos = info.get('duration')
            if duracao_segundos:
                duracao_segundos = int(duracao_segundos)
                minutos = duracao_segundos // 60
                segundos = duracao_segundos % 60
                duracao_formatada = f"{minutos:02d}:{segundos:02d}"
        except Exception:
            pass
            
    if not video_id:
        match = re.search(r'/video/(\d+)', url)
        video_id = match.group(1) if match else "Desconhecido"
        
    if not titulo_video:
        titulo_video = f"TikTok_{video_id}"
        
    exibir_progresso(index, total, titulo_video, duracao_formatada)
    nome_arquivo_limpo = limpar_nome(titulo_video)
    if len(nome_arquivo_limpo) > 100:
        nome_arquivo_limpo = nome_arquivo_limpo[:100]
        
    # Pausa dinâmica com Jitter
    tempo_espera = delay * random.uniform(0.8, 1.2)
    print(f"    ⏳ Aguardando {tempo_espera:.1f} segundos de segurança (Pressione ESPAÇO para pausar ou ESC para sair)...")
    if sleep_com_interrupcao(tempo_espera) == "cancelar":
        raise KeyboardInterrupt
    
    caminho_vtt = baixar_legenda_vtt(url, video_id, pasta_destino, languages)
    caminho_consolidado = os.path.join(pasta_destino, "resultado_transcricoes.txt")
    
    if caminho_vtt and os.path.exists(caminho_vtt):
        texto_completo = extrair_texto_vtt(caminho_vtt)
        
        try:
            os.remove(caminho_vtt)
        except Exception:
            pass
            
        if texto_completo.strip():
            caminho_arquivo = os.path.join(pasta_destino, f"{nome_arquivo_limpo}.txt")
            with open(caminho_arquivo, "w", encoding="utf-8") as f:
                f.write(texto_completo)
                
            print(f"    ✅ Transcrição salva!")
            registrar_no_consolidado(caminho_consolidado, url, titulo_video, duracao_formatada, texto_completo)
        else:
            msg = "Legenda em VTT vazia ou sem texto legível."
            print(f"    ⚠️ {msg}")
            erros_acumulados.append((titulo_video, url, msg))
    else:
        idiomas_str = ", ".join(languages)
        msg = f"Nenhuma legenda em ({idiomas_str}) disponível no TikTok."
        print(f"    ⚠️ {msg}")
        erros_acumulados.append((titulo_video, url, msg))

def processar_playlist_youtube(playlist_info, pasta_canal, caminho_links, languages, delay, erros_acumulados):
    """
    Processa uma única playlist dentro da pasta do canal YouTube.
    """
    playlist_title = playlist_info.get('title')
    playlist_url = playlist_info.get('webpage_url') or playlist_info.get('url')
    
    if not playlist_title:
        playlist_title = "Playlist_Sem_Nome"
        
    nome_pasta_playlist = limpar_nome(playlist_title)
    pasta_playlist = os.path.join(pasta_canal, nome_pasta_playlist)
    
    if not os.path.exists(pasta_playlist):
        os.makedirs(pasta_playlist)
        
    print(f"\n  📂 Playlist YouTube: '{playlist_title}'")
    
    caminho_consolidado = os.path.join(pasta_playlist, "resultado_transcricoes.txt")
    with open(caminho_consolidado, "w", encoding="utf-8") as f:
        f.write(f"=== RELATÓRIO CONSOLIDADO - PLAYLIST: {playlist_title} ===\n")
        f.write(f"Playlist URL: {playlist_url}\n\n")
        
    with open(caminho_links, "a", encoding="utf-8") as f_links:
        f_links.write(f"\n# PLAYLIST: {playlist_title} ({playlist_url})\n")
        
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'no_warnings': True,
    }
    if os.path.exists(ARQUIVO_COOKIES):
        ydl_opts['cookiefile'] = ARQUIVO_COOKIES
        
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(playlist_url, download=False)
            videos = info.get('entries') if info else None
        except Exception as e:
            print(f"  ❌ Erro ao extrair vídeos da playlist: {e}")
            videos = playlist_info.get('entries')
            
        if videos is None:
            # Se for um vídeo único e não uma playlist, envelopa em uma lista
            videos = [playlist_info] if playlist_info.get('id') else []
            
    print(f"  📋 Encontrados {len(videos)} vídeos nesta playlist. Iniciando transcrições...")
    
    total = len(videos)
    for index, entry in enumerate(videos, 1):
        # ── Checa sinal de parada antes de cada vídeo ──
        if _stop_event.is_set():
            print("\n🛑 Varredura interrompida pelo usuário. Arquivos já salvos foram preservados.")
            break

        video_id = entry.get('id')
        video_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else entry.get('url')
        
        if not video_id:
            continue
            
        with open(caminho_links, "a", encoding="utf-8") as f_links:
            f_links.write(f"{video_url}\n")
            
        processar_video_youtube(video_id, video_url, pasta_playlist, caminho_links, index, total, languages, delay, erros_acumulados)

def exibir_erros_consolidado(erros_acumulados):
    """
    Exibe de forma consolidada todos os erros ocorridos no final.
    """
    if not erros_acumulados:
        return
        
    print("\n" + "!" * 70)
    print(" 🚨 RESUMO DE FALHAS / ERROS DURANTE A EXTRAÇÃO")
    print("!" * 70)
    for titulo, url, erro in erros_acumulados:
        print(f"- 🎬 '{titulo}'\n  🔗 Link: {url}\n  ❌ Motivo: {erro}\n")
    print("!" * 70)
    
    # Exibe dica especial sobre cookies se houver erros de IP block
    tem_bloqueio_ip = any("IP" in erro or "Rate limit" in erro or "blocking" in erro for _, _, erro in erros_acumulados)
    if tem_bloqueio_ip:
        print("\n💡 DICA DE OURO PARA EVITAR BLOQUEIO DE IP (ERROS DO YOUTUBE):")
        print("1. Instale uma extensão no seu navegador (ex: 'Get cookies.txt LOCALLY').")
        print("2. Abra o YouTube e exporte os cookies em formato Netscape.")
        print(f"3. Salve o arquivo com o nome '{ARQUIVO_COOKIES}' na pasta deste script.")
        print("4. O script carregará os cookies automaticamente na próxima execução!")
        print("!" * 70)

def inicializar_banco_de_dados():
    """Cria o banco de dados de memória para gatilhos de linguagem se ele não existir e insere as regras iniciais."""
    import sqlite3
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    cursor = conn.cursor()
    
    # Tabela que armazena os padrões de linguagem aprendidos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gatilhos_linguagem (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        termo TEXT UNIQUE NOT NULL,
        categoria TEXT NOT NULL,
        ocorrencias INTEGER DEFAULT 1,
        score_confianca REAL DEFAULT 0.5,
        status TEXT DEFAULT 'pendente' -- 'validado', 'pendente', 'rejeitado'
    )
    """)
    
    # Tabela que armazena as citações/sacadas extraídas
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sacadas_extraidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        autor TEXT NOT NULL,
        video_titulo TEXT NOT NULL,
        gatilho TEXT NOT NULL,
        trecho TEXT UNIQUE NOT NULL,
        data_extracao TEXT NOT NULL,
        compartilhavel INTEGER DEFAULT 0 -- 0 = Não, 1 = Sim
    )
    """)
    
    # Gatilhos sementes de impacto (conhecimento inicial fornecido à IA)
    gatilhos_iniciais = [
        ("pega o código", "Fixação de Atenção", 1.0, "validado"),
        ("pega esse código", "Fixação de Atenção", 1.0, "validado"),
        ("pega a chave", "Fixação de Atenção", 1.0, "validado"),
        ("pega a sacada", "Fixação de Atenção", 1.0, "validado"),
        ("anota isso", "Anotação de Relevância", 1.0, "validado"),
        ("presta atenção", "Anotação de Relevância", 1.0, "validado"),
        ("em verdade vos digo", "Bíblico/Histórico", 1.0, "validado"),
        ("jesus disse", "Bíblico/Histórico", 1.0, "validado"),
        ("escuta o seguinte", "Fixação de Atenção", 1.0, "validado"),
        ("olha que importante", "Anotação de Relevância", 1.0, "validado"),
        # Filósofos Brasileiros e Clássicos
        ("olha que coisa fantástica", "Filosofia", 1.0, "validado"),
        ("perceba a tragédia disso", "Filosofia", 1.0, "validado"),
        ("o ponto nevrálgico aqui é", "Filosofia", 1.0, "validado"),
        ("convenhamos", "Filosofia", 1.0, "validado"),
        ("a grande ilusão contemporânea é", "Filosofia", 1.0, "validado"),
        ("o fato bruto é que", "Filosofia", 1.0, "validado"),
        ("isto significa dizer que", "Filosofia", 1.0, "validado"),
        ("a essência dessa estrutura", "Filosofia", 1.0, "validado"),
        ("é fundamental demarcar que", "Filosofia", 1.0, "validado"),
        ("precisamos visibilizar", "Filosofia", 1.0, "validado"),
        ("a grande questão não é", "Filosofia", 1.0, "validado"),
        ("o homem é", "Filosofia", 1.0, "validado")
    ]
    
    for termo, categoria, score, status in gatilhos_iniciais:
        try:
            cursor.execute("""
            INSERT OR IGNORE INTO gatilhos_linguagem (termo, categoria, score_confianca, status)
            VALUES (?, ?, ?, ?)
            """, (termo, categoria, score, status))
        except sqlite3.IntegrityError:
            pass
            
    conn.commit()
    conn.close()

def carregar_gatilhos_da_memoria():
    """Recupera os gatilhos validados do banco para alimentar a checagem."""
    import sqlite3
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    cursor = conn.cursor()
    cursor.execute("SELECT termo, categoria FROM gatilhos_linguagem WHERE status = 'validado'")
    resultados = cursor.fetchall()
    conn.close()
    return resultados

def registrar_ou_atualizar_gatilho_aprendido(termo, categoria="Descoberto pelo Sistema"):
    """Salva um novo termo descoberto ou aumenta a relevância se ele já existir."""
    import sqlite3
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    cursor = conn.cursor()
    
    termo = termo.strip().lower()
    if len(termo) < 5 or len(termo) > 50:
        conn.close()
        return
        
    # Verifica se o termo já existe
    cursor.execute("SELECT id, ocorrencias, score_confianca, status FROM gatilhos_linguagem WHERE termo = ?", (termo,))
    resultado = cursor.fetchone()
    
    if resultado:
        g_id, ocorrencias, score, status = resultado
        novas_ocorrencias = ocorrencias + 1
        
        # Sobe o score gradualmente a cada nova ocorrência que a IA ouve do palestrante
        novo_score = min(0.99, score + 0.05) 
        
        # Se o sistema ver o termo muitas vezes sozinho, ele se auto-valida
        novo_status = "validado" if (novas_ocorrencias >= 3 and status == "pendente") else status
        
        cursor.execute("""
        UPDATE gatilhos_linguagem 
        SET ocorrencias = ?, score_confianca = ?, status = ?
        WHERE id = ?
        """, (novas_ocorrencias, novo_score, novo_status, g_id))
    else:
        # Se for totalmente inédito, salva como pendente para teste futuro
        cursor.execute("""
        INSERT INTO gatilhos_linguagem (termo, categoria, score_confianca, status)
        VALUES (?, ?, 0.30, 'pendente')
        """, (termo, categoria))
        
    conn.commit()
    conn.close()

def registrar_sacada_extraida(autor, video_titulo, gatilho, trecho, compartilhavel=0):
    """Salva a citação extraída no banco de dados SQLite para fins de histórico e compartilhamento."""
    import sqlite3
    import datetime
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    cursor = conn.cursor()
    data_hoje = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        cursor.execute("""
        INSERT OR IGNORE INTO sacadas_extraidas (autor, video_titulo, gatilho, trecho, data_extracao, compartilhavel)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (autor, video_titulo, gatilho, trecho, data_hoje, compartilhavel))
    except Exception:
        pass
    conn.commit()
    conn.close()

def gerar_vault_obsidian(pasta_canal, canal_nome, sacadas):
    """
    Cria uma pasta estruturada _Obsidian_Vault com arquivos Markdown interligados por wikilinks [[]].
    Isso reconstrói o gráfico de conexões neurais no Obsidian!
    """
    vault_dir = os.path.join(pasta_canal, "_Obsidian_Vault")
    
    # Cria a estrutura de subpastas do Vault
    pastas = ["Autores", "Temas", "Vídeos", "Sacadas"]
    for p in pastas:
        caminho_p = os.path.join(vault_dir, p)
        if not os.path.exists(caminho_p):
            os.makedirs(caminho_p)
            
    # 1. Cria o arquivo do Autor
    caminho_autor = os.path.join(vault_dir, "Autores", f"{canal_nome}.md")
    with open(caminho_autor, "w", encoding="utf-8") as fa:
        fa.write(f"# Autor: [[{canal_nome}]]\n\n")
        fa.write(f"Ficha de notas de conhecimento e pensamentos extraídos de [[{canal_nome}]].\n\n")
        fa.write("## 📝 Sacadas Extraídas\n")
        
    # 2. Cria os arquivos de notas
    temas_processados = set()
    videos_processados = set()
    
    for index, sac in enumerate(sacadas, 1):
        sac_id = f"Sacada_{canal_nome}_{index}"
        video_limpo = limpar_nome(sac['video'])
        categoria_limpa = limpar_nome(sac['categoria'])
        
        # 2.1 Nota da Sacada
        caminho_sac = os.path.join(vault_dir, "Sacadas", f"{sac_id}.md")
        with open(caminho_sac, "w", encoding="utf-8") as fs:
            fs.write(f"# Sacada de [[Autores/{canal_nome}]]\n\n")
            fs.write(f"- **Vídeo de Origem:** [[Vídeos/{video_limpo}]]\n")
            fs.write(f"- **Gatilho Mental:** `{sac['gatilho']}`\n")
            fs.write(f"- **Tema:** [[Temas/{categoria_limpa}]]\n\n")
            fs.write(f"## 💬 O Pensamento\n")
            fs.write(f"> \"{sac['frase']}\"\n")
            
        # 2.2 Adiciona link no Autor
        with open(caminho_autor, "a", encoding="utf-8") as fa:
            fa.write(f"- [[Sacadas/{sac_id}]] (no vídeo [[Vídeos/{video_limpo}]])\n")
            
        # 2.3 Nota do Tema (Categoria)
        caminho_tema = os.path.join(vault_dir, "Temas", f"{categoria_limpa}.md")
        modo_w = "a" if categoria_limpa in temas_processados else "w"
        with open(caminho_tema, modo_w, encoding="utf-8") as ft:
            if modo_w == "w":
                ft.write(f"# Tema: {sac['categoria']}\n\n")
                ft.write("## 🧠 Conexões de Pensamento\n")
                temas_processados.add(categoria_limpa)
            ft.write(f"- [[Sacadas/{sac_id}]] - Extraído de [[Autores/{canal_nome}]] no vídeo [[Vídeos/{video_limpo}]]\n")
            
        # 2.4 Nota do Vídeo
        caminho_video = os.path.join(vault_dir, "Vídeos", f"{video_limpo}.md")
        modo_v = "a" if video_limpo in videos_processados else "w"
        with open(caminho_video, modo_v, encoding="utf-8") as fv:
            if modo_v == "w":
                fv.write(f"# Vídeo: {sac['video']}\n\n")
                fv.write(f"- **Palestrante:** [[Autores/{canal_nome}]]\n\n")
                fv.write("## 🔑 Ensinamentos Importantes\n")
                videos_processados.add(video_limpo)
            fv.write(f"- [[Sacadas/{sac_id}]] (Marcação de [[Temas/{categoria_limpa}]])\n")
            
    print(f"🕸️  Vault do Obsidian criado com sucesso em: {vault_dir}")

def extrair_sacadas_conteudo(pasta_canal, canal_nome, compartilhavel=0):
    """
    Varre as transcrições da pasta do canal e extrai frases de impacto com base nos gatilhos da memória SQLite.
    Usa spaCy se disponível, senão usa Regex/Substrings como fallback robusto.
    """
    inicializar_banco_de_dados()
    
    # 1. Carrega os gatilhos validados
    import sqlite3
    conn = sqlite3.connect("memoria_ia_gatilhos.db")
    cursor = conn.cursor()
    cursor.execute("SELECT termo, categoria FROM gatilhos_linguagem WHERE status = 'validado'")
    gatilhos = [(row[0].lower(), row[1]) for row in cursor.fetchall()]
    conn.close()
    
    sacadas_encontradas = []
    
    # 2. Tenta carregar spaCy se disponível
    nlp = None
    try:
        import spacy
        nlp = spacy.load("pt_core_news_lg")
    except Exception:
        pass
        
    # 3. Varre os arquivos
    for f in os.listdir(pasta_canal):
        if f.endswith(".txt") and f != "resultado_transcricoes.txt" and f != "palavras_chave.txt" and f != "sacadas.txt" and not f.startswith("Relatorio_Analitico") and "_Obsidian_Vault" not in f:
            caminho_f = os.path.join(pasta_canal, f)
            try:
                with open(caminho_f, "r", encoding="utf-8") as file:
                    conteudo = file.read()
                    
                # Divide o conteúdo em sentenças (usando spaCy ou separadores comuns)
                sentencas = []
                if nlp:
                    doc = nlp(conteudo)
                    sentencas = [sent.text.strip() for sent in doc.sents]
                else:
                    # Divisor simples de sentenças por pontuação comum ou novas linhas
                    sentencas = re.split(r'[.!?\n]', conteudo)
                    sentencas = [s.strip() for s in sentencas if s.strip()]
                    
                for sent in sentencas:
                    sent_lower = sent.lower()
                    
                    # 3.1 Busca gatilhos conhecidos na sentença
                    for termo, categoria in gatilhos:
                        if termo in sent_lower:
                            # Evita adicionar sentenças muito longas ou duplicadas
                            if len(sent) < 300 and not any(s['frase'] == sent for s in sacadas_encontradas):
                                sacadas_encontradas.append({
                                    'video': f[:-4],
                                    'gatilho': termo,
                                    'categoria': categoria,
                                    'frase': sent
                                })
                                # Registra no banco SQLite com informações de autoria e consentimento
                                registrar_sacada_extraida(canal_nome, f[:-4], termo, sent, compartilhavel)
                            break # Evita duplicar a mesma sentença para múltiplos gatilhos
                            
                    # 3.2 Auto-aprendizado de novos gatilhos imperativos
                    if nlp:
                        # Lógica spaCy (Verbo Imperativo + Pronome/Artigo + Substantivo)
                        doc_sent = nlp(sent)
                        for token in doc_sent:
                            if token.pos_ == "VERB" and token.morph.get("Mood") == ["Imp"]:
                                if token.i + 2 < len(doc_sent):
                                    p1 = doc_sent[token.i + 1]
                                    p2 = doc_sent[token.i + 2]
                                    if p1.pos_ in ["PRON", "DET"] and p2.pos_ in ["NOUN", "PROPN"]:
                                        termo_descoberto = f"{token.text} {p1.text} {p2.text}".lower()
                                        if len(termo_descoberto.split()) <= 4:
                                            registrar_ou_atualizar_gatilho_aprendido(termo_descoberto)
                    else:
                        # Lógica Regex de Fallback: busca verbos imperativos comuns + pronomes/artigos + substantivos
                        padrao_imperativo = r'\b(pega|guarda|anota|presta|escuta|olha|veja|sente|pesca|foca)\b\s+(este|esta|esse|essa|o|a|uma|um|aquele|aquela)?\s*([a-zA-ZáéíóúãõçÁÉÍÓÚÃÕÇ]+)\b'
                        matches = re.finditer(padrao_imperativo, sent_lower)
                        for match in matches:
                            termo_descoberto = match.group(0).lower()
                            registrar_ou_atualizar_gatilho_aprendido(termo_descoberto)
                            
            except Exception:
                pass
                
    # 4. Escreve sacadas.txt se houver resultados
    caminho_sacadas = os.path.join(pasta_canal, "sacadas.txt")
    try:
        with open(caminho_sacadas, "w", encoding="utf-8") as f_sac:
            f_sac.write("=== BLOCO DE ANOTAÇÕES - SACADAS E CÓDIGOS ENCONTRADOS ===\n\n")
            if sacadas_encontradas:
                for sac in sacadas_encontradas:
                    f_sac.write(f"🎬 Vídeo: {sac['video']}\n")
                    f_sac.write(f"🔑 Gatilho de Fixação: '{sac['gatilho']}' ({sac['categoria']})\n")
                    f_sac.write(f"📝 Trecho/Nota: \"{sac['frase']}\"\n")
                    f_sac.write("-" * 50 + "\n\n")
            else:
                f_sac.write("Nenhum código de atenção ou gatilho de fixação conhecido foi detectado nas transcrições.\n")
        print(f"📝 Bloco de notas de sacadas gerado em: {caminho_sacadas}")
    except Exception as e:
        print(f"⚠️ Erro ao salvar bloco de sacadas: {e}")
        
    # 5. Gera a estrutura de notas do Obsidian Vault para mapeamento visual de conexões neurais
    if sacadas_encontradas:
        try:
            gerar_vault_obsidian(pasta_canal, canal_nome, sacadas_encontradas)
        except Exception as e_ob:
            print(f"⚠️ Não foi possível estruturar o Vault do Obsidian: {e_ob}")
        
    return sacadas_encontradas

def gerar_relatorio_analitico(pasta_canal, canal_nome, pasta_salvar, formato='md', compartilhavel=0):
    """
    Gera um relatório estatístico e analítico consolidado da extração.
    """
    from collections import Counter
    caminho_relatorio = os.path.join(pasta_salvar, f"Relatorio_Analitico_{canal_nome}.{formato}")
    
    # 1. Varre os arquivos individuais para contar palavras e extrair snippets
    videos_analisados = []
    palavras_todas = []
    
    for f in os.listdir(pasta_canal):
        if f.endswith(".txt") and f != "resultado_transcricoes.txt" and not f.startswith("Relatorio_Analitico"):
            caminho_f = os.path.join(pasta_canal, f)
            try:
                with open(caminho_f, "r", encoding="utf-8") as file:
                    conteudo = file.read()
                    palavras = [w.lower() for w in re.findall(r'\b[a-zA-ZáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]{6,}\b', conteudo)]
                    palavras_todas.extend(palavras)
                    
                    titulo = f[:-4]
                    palavras_qtd = len(conteudo.split())
                    snippet = conteudo[:300] + "..." if len(conteudo) > 300 else conteudo
                    videos_analisados.append({
                        'titulo': titulo,
                        'palavras_qtd': palavras_qtd,
                        'snippet': snippet.strip()
                    })
            except Exception:
                pass
                
    # 2. Processa as palavras-chave mais frequentes (Stopwords básicas em português)
    stopwords = {
        "porque", "quando", "muito", "entao", "toda", "tudo", "todos", "sobre", 
        "tambem", "gente", "coisa", "fazer", "fala", "aqui", "mais", "esta", 
        "como", "para", "depois", "outro", "mesmo", "canal", "video", "links",
        "então", "também", "está", "vídeo", "ainda", "agora", "então", "coisas",
        "pessoas", "alguma", "depois", "sempre", "grande", "muita", "outra",
        "onde", "estou", "vamos", "falar", "tempo"
    }
    
    palavras_filtradas = [p for p in palavras_todas if p not in stopwords]
    contador_palavras = Counter(palavras_filtradas)
    top_palavras = contador_palavras.most_common(10)
    
    # 3. Calcula estatísticas gerais
    total_videos = len(videos_analisados)
    total_palavras = sum(v['palavras_qtd'] for v in videos_analisados)
    
    duracao_total_segundos = 0
    caminho_consolidado = os.path.join(pasta_canal, "resultado_transcricoes.txt")
    if os.path.exists(caminho_consolidado):
        try:
            with open(caminho_consolidado, "r", encoding="utf-8") as fc:
                linhas = fc.readlines()
                for linha in linhas:
                    if linha.startswith("DURAÇÃO:"):
                        partes = linha.replace("DURAÇÃO:", "").strip().split(":")
                        if len(partes) == 3:
                            duracao_total_segundos += int(partes[0])*3600 + int(partes[1])*60 + int(partes[2])
                        elif len(partes) == 2:
                            duracao_total_segundos += int(partes[0])*60 + int(partes[1])
        except Exception:
            pass
            
    horas = duracao_total_segundos // 3600
    minutos = (duracao_total_segundos % 3600) // 60
    segundos = duracao_total_segundos % 60
    duracao_total_str = f"{horas:02d}:{minutos:02d}:{segundos:02d}" if horas > 0 else f"{minutos:02d}:{segundos:02d}"
    
    # 3.5 Escreve o arquivo palavras_chave.txt com as 150 palavras mais faladas (separadas por ponto e vírgula)
    caminho_palavras_chave = os.path.join(pasta_canal, "palavras_chave.txt")
    try:
        palabras_ordenadas = [palavra for palavra, freq in contador_palavras.most_common(150)]
        with open(caminho_palavras_chave, "w", encoding="utf-8") as f_pc:
            f_pc.write(";".join(palabras_ordenadas))
        print(f"🔑 Arquivo de palavras-chave gerado: {caminho_palavras_chave}")
    except Exception as e_pc:
        print(f"⚠️ Erro ao gerar o arquivo de palavras-chave: {e_pc}")
        
    # 3.7 Executa a análise linguística de sacadas
    sacadas = extrair_sacadas_conteudo(pasta_canal, canal_nome, compartilhavel)
        
    # 4. Escreve o relatório
    try:
        with open(caminho_relatorio, "w", encoding="utf-8") as fr:
            if formato == 'md':
                fr.write(f"# Relatório Analítico Consolidado - Canal: {canal_nome}\n\n")
                fr.write("## 📊 Estatísticas Gerais\n")
                fr.write(f"- **Total de Vídeos Transcritos:** {total_videos}\n")
                fr.write(f"- **Duração Total de Conteúdo:** {duracao_total_str}\n")
                fr.write(f"- **Total de Palavras Transcritas:** {total_palavras}\n")
                fr.write(f"- **Média de Palavras por Vídeo:** {int(total_palavras / total_videos) if total_videos > 0 else 0}\n\n")
                
                fr.write("## 🔑 Principais Temas e Palavras-Chave (Top 10)\n")
                if top_palavras:
                    max_freq = top_palavras[0][1]
                    for palavra, freq in top_palavras:
                        largura = int((freq / max_freq) * 15)
                        barra = "█" * largura + "░" * (15 - largura)
                        fr.write(f"- **{palavra.capitalize()}**: {freq} vezes `[{barra}]`\n")
                else:
                    fr.write("*Nenhuma palavra-chave identificada com os critérios.*\n")
                fr.write("\n")
                
                fr.write("## 🎬 Sumário e Gancho Inicial dos Vídeos\n")
                for v in videos_analisados:
                    fr.write(f"### 📌 {v['titulo']}\n")
                    fr.write(f"- **Volume de palavras:** {v['palavras_qtd']} palavras\n")
                    fr.write(f"- **Introdução/Gancho:**\n  > *{v['snippet']}*\n\n")
                    
                fr.write("## 📝 Bloco de Notas - Sacadas e Códigos Importantes\n")
                if sacadas:
                    for s in sacadas:
                        fr.write(f"### 🎬 {s['video']}\n")
                        fr.write(f"- **Gatilho de Fixação:** `{s['gatilho'].capitalize()}` ({s['categoria']})\n")
                        fr.write(f"- **Trecho/Nota:**\n  > *\"{s['frase']}\"*\n\n")
                else:
                    fr.write("*Nenhuma frase de impacto ou código de atenção detectado nas transcrições.*\n\n")
            else:
                fr.write(f"=== Relatório Analítico Consolidado - Canal: {canal_nome} ===\n\n")
                fr.write("ESTATÍSTICAS GERAIS:\n")
                fr.write(f"- Total de Vídeos Transcritos: {total_videos}\n")
                fr.write(f"- Duração Total de Conteúdo: {duracao_total_str}\n")
                fr.write(f"- Total de Palavras Transcritas: {total_palavras}\n")
                fr.write(f"- Média de Palavras por Vídeo: {int(total_palavras / total_videos) if total_videos > 0 else 0}\n\n")
                
                fr.write("PRINCIPAIS TEMAS E PALAVRAS-CHAVE (TOP 10):\n")
                if top_palavras:
                    max_freq = top_palavras[0][1]
                    for palavra, freq in top_palavras:
                        largura = int((freq / max_freq) * 15)
                        barra = "█" * largura + "░" * (15 - largura)
                        fr.write(f"- {palavra.capitalize()}: {freq} vezes [{barra}]\n")
                else:
                    fr.write("Nenhuma palavra-chave identificada.\n")
                fr.write("\n")
                
                fr.write("SUMÁRIO E GANCHO INICIAL DOS VÍDEOS:\n")
                fr.write("=" * 70 + "\n")
                for v in videos_analisados:
                    fr.write(f"Video: {v['titulo']}\n")
                    fr.write(f"Volume: {v['palavras_qtd']} palavras\n")
                    fr.write(f"Introdução: {v['snippet']}\n")
                    fr.write("-" * 50 + "\n")
                    
                fr.write("BLOCO DE NOTAS - SACADAS E CÓDIGOS IMPORTANTES:\n")
                fr.write("=" * 70 + "\n")
                if sacadas:
                    for s in sacadas:
                        fr.write(f"Video: {s['video']}\n")
                        fr.write(f"Gatilho: {s['gatilho']} ({s['categoria']})\n")
                        fr.write(f"Trecho: \"{s['frase']}\"\n")
                        fr.write("-" * 50 + "\n")
                else:
                    fr.write("Nenhuma frase de impacto detectada.\n")
                fr.write("\n")
                    
        print(f"\n📊 Relatório analítico gerado com sucesso: {caminho_relatorio}")
        return True
    except Exception as e:
        print(f"⚠️ Erro ao gerar o relatório analítico: {e}")
        return False

def processar_url_principal(url, languages, delay, pasta_salvar, compartilhavel=0):
    print(f"\n🔍 Analisando URL fornecida: {url}...")
    
    is_tiktok = "tiktok.com" in url
    is_instagram = "instagram.com" in url
    erros_acumulados = []
    
    # Verifica presença de cookies.txt
    if os.path.exists(ARQUIVO_COOKIES):
        print(f"🔑 Arquivo '{ARQUIVO_COOKIES}' detectado! Carregando sessões e credenciais...")
        
    info = obter_info_url(url)
    if not info:
        print("❌ Não foi possível carregar as informações desta URL.")
        return False
        
    # Determina o nome do canal/perfil
    if is_tiktok:
        canal_nome = info.get('title') or info.get('uploader') or info.get('id') or "Perfil_TikTok"
        canal_nome = canal_nome.split("on TikTok")[0].strip()
        canal_nome_limpo = limpar_nome(f"TikTok_{canal_nome}")
    elif is_instagram:
        canal_nome = info.get('title') or info.get('uploader') or info.get('id') or "Perfil_Instagram"
        canal_nome = canal_nome.split("on Instagram")[0].strip()
        canal_nome_limpo = limpar_nome(f"Instagram_{canal_nome}")
    else:
        canal_nome = info.get('channel') or info.get('uploader') or info.get('title') or "Canal_Desconhecido"
        canal_nome_limpo = limpar_nome(canal_nome)
        
    # Garante que a pasta base de salvamento existe
    if not os.path.exists(pasta_salvar):
        try:
            os.makedirs(pasta_salvar)
        except Exception as e:
            print(f"❌ Erro ao criar a pasta de salvamento '{pasta_salvar}': {e}")
            return False
            
    pasta_canal = os.path.join(pasta_salvar, canal_nome_limpo)
    if not os.path.exists(pasta_canal):
        os.makedirs(pasta_canal)
        
    caminho_links = os.path.join(pasta_salvar, f"{canal_nome_limpo}_links.txt")
    
    print(f"🎬 Origem: '{canal_nome}'")
    print(f"📂 Diretório de Destino: {pasta_canal}")
    print(f"📄 Arquivo de Links: {caminho_links}")
    
    # Inicializa o arquivo de links
    with open(caminho_links, "w", encoding="utf-8") as f_links:
        f_links.write(f"# LISTA DE LINKS EXTRAÍDAS: {canal_nome}\n")
        f_links.write(f"# URL de Origem: {url}\n")
        
    entries = info.get('entries') or []
    if not entries:
        # Tenta tratar a URL de vídeo único no Instagram/TikTok
        entries = [{'url': url, 'title': canal_nome}]
        
    try:
        # Se for TikTok
        if is_tiktok:
            total = len(entries)
            print(f"📂 Perfil TikTok detectado. Carregando {total} posts...")
            caminho_consolidado = os.path.join(pasta_canal, "resultado_transcricoes.txt")
            with open(caminho_consolidado, "w", encoding="utf-8") as f:
                f.write(f"=== RELATÓRIO CONSOLIDADO - PERFIL TIKTOK: {canal_nome} ===\n")
                f.write(f"Perfil URL: {url}\n\n")
                
            for index, entry in enumerate(entries, 1):
                if _stop_event.is_set():
                    print("\n🛑 Varredura interrompida pelo usuário.")
                    break
                video_url = entry.get('url')
                if video_url:
                    with open(caminho_links, "a", encoding="utf-8") as f_links:
                        f_links.write(f"{video_url}\n")
                    processar_video_tiktok(video_url, pasta_canal, caminho_links, index, total, languages, delay, erros_acumulados)
        # Se for Instagram
        elif is_instagram:
            total = len(entries)
            print(f"📂 Perfil Instagram detectado. Carregando {total} posts...")
            caminho_consolidado = os.path.join(pasta_canal, "resultado_transcricoes.txt")
            with open(caminho_consolidado, "w", encoding="utf-8") as f:
                f.write(f"=== RELATÓRIO CONSOLIDADO - PERFIL INSTAGRAM: {canal_nome} ===\n")
                f.write(f"Perfil URL: {url}\n\n")
                
            for index, entry in enumerate(entries, 1):
                if _stop_event.is_set():
                    print("\n🛑 Varredura interrompida pelo usuário.")
                    break
                video_url = entry.get('url')
                if video_url:
                    with open(caminho_links, "a", encoding="utf-8") as f_links:
                        f_links.write(f"{video_url}\n")
                    processar_video_tiktok(video_url, pasta_canal, caminho_links, index, total, languages, delay, erros_acumulados)
        else:
            # Se for YouTube
            _type = info.get('_type', 'playlist')
            is_channel = any(entry.get('_type') == 'playlist' or 'playlist' in entry.get('url', '') for entry in entries if entry)
            
            if is_channel or (info.get('webpage_url_basename') == 'playlists' or 'playlists' in url):
                print(f"📂 Canal YouTube detectado. Iniciando extração de {len(entries)} playlists...")
                for playlist_entry in entries:
                    processar_playlist_youtube(playlist_entry, pasta_canal, caminho_links, languages, delay, erros_acumulados)
            else:
                print(f"🎬 Playlist única YouTube detectada.")
                processar_playlist_youtube(info, pasta_canal, caminho_links, languages, delay, erros_acumulados)
                
    except KeyboardInterrupt:
        print("\n\n🛑 Processo interrompido pelo usuário via teclado (Ctrl+C)!")
        print("⚠️ Resetando a execução... Os arquivos salvos até o momento foram preservados.")
        # Exibe os erros das tentativas feitas até o momento da interrupção
        exibir_erros_consolidado(erros_acumulados)
        return True
        
    print(f"\n✨ Processo de extração concluído para: '{canal_nome}'!")
    
    # Exibe relatório final consolidado de erros
    exibir_erros_consolidado(erros_acumulados)
    
    # Gera automaticamente o relatório analítico em formato Markdown (.md) e atualiza o banco de dados
    print("\n📊 Gerando relatório analítico consolidado e atualizando base neural automaticamente...")
    gerar_relatorio_analitico(pasta_canal, canal_nome_limpo, pasta_salvar, formato='md', compartilhavel=compartilhavel)
    
    # Abre o diretório no Windows Explorer
    try:
        caminho_absoluto = os.path.abspath(pasta_canal)
        print(f"📂 Abrindo pasta de arquivos: {caminho_absoluto}")
        os.startfile(caminho_absoluto)
    except Exception as e:
        print(f"⚠️ Não foi possível abrir o diretório automaticamente: {e}")
        
    return True

def loop_interativo():
    limpar_tela()
    exibir_cabecalho()
    
    while True:
        url = input("\n🔗 Insira a URL do canal/playlist do YouTube, perfil do TikTok ou Instagram (ou 'sair' para fechar): ").strip()
        
        if url.lower() in ['sair', 'exit', 'fechar', 'close']:
            print("👋 Encerrando a aplicação. Obrigado por usar o transcritor!")
            break
            
        if not url:
            limpar_tela()
            exibir_cabecalho()
            print("⚠️ URL inválida. Por favor, tente novamente.")
            continue
            
        # Validação simples de URLs aceitas
        is_valida = any(dominio in url for dominio in ["youtube.com", "youtu.be", "tiktok.com", "instagram.com"])
        if not is_valida:
            limpar_tela()
            exibir_cabecalho()
            print("\n⚠️ AVISO: URL não reconhecida! Por favor, insira um link válido do YouTube, TikTok ou Instagram.")
            continue
            
        # 1. Configura a importação de cookies do navegador para evitar bloqueios
        print("\n🔑 Deseja importar os cookies de login do seu navegador para evitar bloqueios de IP?")
        print("(Altamente recomendado para Instagram e TikTok. O navegador selecionado deve ser fechado)")
        print("1. Chrome")
        print("2. Edge")
        print("3. Firefox")
        print("4. Brave")
        print("5. Não importar (Pular)")
        escolha_nav = input("Selecione uma opção (1-5) ou aperte Enter para Pular: ").strip()
        
        if escolha_nav in ['1', '2', '3', '4']:
            nav_map = {'1': 'chrome', '2': 'edge', '3': 'firefox', '4': 'brave'}
            exportar_cookies_do_navegador(nav_map[escolha_nav], ARQUIVO_COOKIES)
            
        # 2. Configura preferência de idioma
        print("\n🌍 Escolha o idioma de preferência para a transcrição:")
        print("1. Português ('pt') com fallback para Inglês ('en') [Padrão]")
        print("2. Apenas Português ('pt')")
        print("3. Apenas Inglês ('en')")
        print("4. Outro (digite os códigos de idioma separados por vírgula, ex: es,fr,it)")
        
        escolha_idioma = input("Selecione uma opção (1-4) ou aperte Enter: ").strip()
        
        languages = ['pt', 'en']
        if escolha_idioma == '2':
            languages = ['pt']
        elif escolha_idioma == '3':
            languages = ['en']
        elif escolha_idioma == '4':
            custom_lang = input("Digite os códigos de idioma (ex: es,fr): ").strip()
            if custom_lang:
                languages = [lang.strip() for lang in custom_lang.split(",") if lang.strip()]
                
        # 3. Configura o delay (tempo de espera)
        delay_input = input("\n⏳ Digite o tempo de espera (delay) entre vídeos em segundos (recomendado: 5, padrão: 5): ").strip()
        try:
            delay = float(delay_input) if delay_input else 5.0
        except ValueError:
            delay = 5.0
            
        # 4. Configura a pasta de salvamento com sugestões dinâmicas baseadas no sistema operacional
        caminho_home = os.path.expanduser("~")
        sugestao_desktop = os.path.join(caminho_home, "Desktop", "transcricoes")
        sugestao_raiz_c = "C:\\transcricoes"
        sugestao_projeto = os.path.abspath(PASTA_BASE)
        
        print("\n📂 Onde deseja salvar os arquivos transcritos?")
        print(f"[1] Área de Trabalho: {sugestao_desktop}")
        print(f"[2] Raiz do Disco C:  {sugestao_raiz_c}")
        print(f"[3] Pasta do Projeto:  {sugestao_projeto}")
        escolha_pasta = input("Selecione uma opção (1-3), digite um caminho personalizado ou aperte Enter para o padrão [3]: ").strip()
        
        if escolha_pasta == '1':
            pasta_salvar = sugestao_desktop
        elif escolha_pasta == '2':
            pasta_salvar = sugestao_raiz_c
        elif escolha_pasta == '3' or not escolha_pasta:
            pasta_salvar = PASTA_BASE
        else:
            pasta_salvar = escolha_pasta
            
        # 4.5 Configura o consentimento de compartilhamento comunitário de sacadas e citações
        print("\n🌍 Compartilhamento de Conhecimento Comunitário:")
        print("Deseja autorizar a gravação e compartilhamento das sacadas e citações extraídas")
        print("para fortalecer a base de conhecimento comum da comunidade?")
        print("1. Sim, autorizo o compartilhamento anônimo [Recomendado]")
        print("2. Não, manter a memória apenas localmente no meu computador")
        escolha_comp = input("Selecione uma opção (1-2) ou aperte Enter para o padrão [1]: ").strip()
        compartilhavel = 1 if escolha_comp != '2' else 0
            
        sucesso = processar_url_principal(url, languages, delay, pasta_salvar, compartilhavel)
        
        if sucesso:
            opcao = input("\n🔄 Deseja enviar mais algum item para extração? (S/N): ").strip().upper()
            if opcao != 'S':
                print("👋 Encerrando a aplicação. Obrigado por usar o transcritor!")
                break
            else:
                limpar_tela()
                exibir_cabecalho()
        else:
            print("⚠️ Ocorreu um erro ao processar. Deseja tentar com outro link?")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Para argumentos via CLI, assume configurações padrão de segurança: pt/en, 5s delay e pasta padrão 'transcricoes'
        processar_url_principal(sys.argv[1], ['pt', 'en'], 5.0, PASTA_BASE)
        opcao = input("\n🔄 Deseja processar mais algum item? (S/N): ").strip().upper()
        if opcao == 'S':
            loop_interativo()
        else:
            print("👋 Encerrando a aplicação.")
    else:
        loop_interativo()
