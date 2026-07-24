import os
import re
import sys
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

# Configura o terminal para UTF-8, garantindo compatibilidade com emojis no Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

ARQUIVO_LINKS = "links.txt"
ARQUIVO_SAIDA = "resultado_transcricoes.txt"

def extrair_id_video(url):
    """
    Extrai o ID de 11 caracteres de um link do YouTube (funciona com links normais e Shorts).
    """
    padrao = r'(?:v=|\/shorts\/|\/embed\/|\/v\/|youtu\.be\/|\/v=|^)([^#\&\?^\/]{11})'
    resultado = re.search(padrao, url)
    return resultado.group(1) if resultado else None

def limpar_nome_arquivo(nome):
    """
    Remove caracteres inválidos para nomes de arquivos no Windows.
    """
    # Substitui caracteres inválidos (\, /, :, *, ?, ", <, >, |) por nada ou espaço
    nome_limpo = re.sub(r'[\\/*?:"<>|]', "", nome)
    # Remove espaços em branco múltiplos
    nome_limpo = re.sub(r'\s+', " ", nome_limpo).strip()
    return nome_limpo

def obter_titulo_video(url):
    """
    Usa yt-dlp para obter o título real do vídeo.
    """
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'no_warnings': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            return info.get('title')
        except Exception:
            return None

def carregar_links_do_arquivo():
    """
    Carrega os links do arquivo links.txt. Se o arquivo não existir, cria um modelo.
    """
    if not os.path.exists(ARQUIVO_LINKS):
        modelo = (
            "# Cole suas URLs do YouTube abaixo (uma por linha).\n"
            "# Linhas iniciadas com '#' serão ignoradas.\n"
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ\n"
        )
        with open(ARQUIVO_LINKS, "w", encoding="utf-8") as f:
            f.write(modelo)
        print(f"📄 Criado o arquivo '{ARQUIVO_LINKS}' com links de exemplo.")
        return ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]
        
    links = []
    with open(ARQUIVO_LINKS, "r", encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if linha and not linha.startswith("#"):
                links.append(linha)
    return links

def extrair_transcricoes(lista_de_urls):
    pasta_destino = "transcricoes"
    if not os.path.exists(pasta_destino):
        os.makedirs(pasta_destino)
        
    # Inicializa ou limpa o arquivo de saída consolidado
    with open(ARQUIVO_SAIDA, "w", encoding="utf-8") as f_saida:
        f_saida.write("=== RELATÓRIO CONSOLIDADO DE TRANSCRIÇÕES ===\n\n")

    for url in lista_de_urls:
        video_id = extrair_id_video(url)
        
        if not video_id:
            msg_erro = f"❌ Não foi possível identificar o ID do vídeo para a URL: {url}"
            print(msg_erro)
            registrar_no_consolidado(url, "Desconhecido", "Erro: URL inválida", msg_erro)
            continue
            
        print(f"🔄 Obtendo informações do vídeo ID {video_id}...")
        titulo_video = obter_titulo_video(url)
        if not titulo_video:
            titulo_video = f"Video_{video_id}"
            
        nome_arquivo_limpo = limpar_nome_arquivo(titulo_video)
        print(f"🔄 Processando transcrição de: '{titulo_video}'...")
        
        try:
            # Busca a transcrição preferencialmente em português ('pt'), com fallback para inglês ('en')
            api = YouTubeTranscriptApi()
            lista_transcricao = api.fetch(video_id, languages=['pt', 'en'])
            
            # Estima a duração do vídeo usando a última legenda
            duracao_segundos = 0
            if lista_transcricao:
                ultimo_item = lista_transcricao[-1]
                duracao_segundos = int(ultimo_item.start + ultimo_item.duration)
            
            # Formata a duração (ex: 01:23:45 ou 05:30)
            horas = duracao_segundos // 3600
            minutos = (duracao_segundos % 3600) // 60
            segundos = duracao_segundos % 60
            if horas > 0:
                duracao_formatada = f"{horas:02d}:{minutos:02d}:{segundos:02d}"
            else:
                duracao_formatada = f"{minutos:02d}:{segundos:02d}"
            
            # Junta todas as frases em um único bloco de texto
            texto_completo = " ".join([item.text for item in lista_transcricao])
            
            # Salva o resultado individual usando o TÍTULO do vídeo como nome do arquivo
            caminho_arquivo = os.path.join(pasta_destino, f"{nome_arquivo_limpo}.txt")
            with open(caminho_arquivo, "w", encoding="utf-8") as arquivo:
                arquivo.write(texto_completo)
                
            print(f"✅ Transcrição salva com sucesso em: {caminho_arquivo}")
            registrar_no_consolidado(url, titulo_video, duracao_formatada, texto_completo)
            
        except NoTranscriptFound:
            msg = "⚠️ Nenhuma transcrição em português ou inglês encontrada para este vídeo."
            print(f"⚠️ Vídeo '{titulo_video}': {msg}")
            registrar_no_consolidado(url, titulo_video, "Desconhecida", msg)
        except TranscriptsDisabled:
            msg = "🚫 As transcrições estão desativadas para este vídeo."
            print(f"🚫 Vídeo '{titulo_video}': {msg}")
            registrar_no_consolidado(url, titulo_video, "Desconhecida", msg)
        except Exception as e:
            msg = f"💥 Ocorreu um erro inesperado: {e}"
            print(f"💥 Vídeo '{titulo_video}': {msg}")
            registrar_no_consolidado(url, titulo_video, "Desconhecida", msg)

def registrar_no_consolidado(url, titulo, duracao, texto):
    with open(ARQUIVO_SAIDA, "a", encoding="utf-8") as f:
        f.write("=" * 70 + "\n")
        f.write(f"TÍTULO: {titulo}\n")
        f.write(f"LINK: {url}\n")
        f.write(f"DURAÇÃO ESTIMADA: {duracao}\n")
        f.write("=" * 70 + "\n")
        f.write(texto + "\n\n")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        links = sys.argv[1:]
    else:
        links = carregar_links_do_arquivo()
        
    if links:
        print(f"📋 Iniciando processamento de {len(links)} link(s)...")
        extrair_transcricoes(links)
        print(f"\n✨ Processo concluído! Os dados consolidados estão em '{ARQUIVO_SAIDA}'")
    else:
        print(f"ℹ️ Nenhum link encontrado para processar no arquivo '{ARQUIVO_LINKS}'.")
