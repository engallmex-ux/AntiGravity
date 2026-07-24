import sys
import yt_dlp

# Configura o terminal para UTF-8 no Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def listar_conteudo_canal(url_canal, limite=30):
    ydl_opts = {
        'extract_flat': True,
        'playlistend': limite,
    }
    
    videos = []
    print(f"🔍 Buscando os primeiros {limite} vídeos do canal: {url_canal}...")
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url_canal, download=False)
            if 'entries' in info:
                for entry in info['entries']:
                    title = entry.get('title')
                    video_id = entry.get('id')
                    # Formata a URL completa do vídeo
                    video_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else entry.get('url')
                    if title and video_url:
                        videos.append({"title": title, "url": video_url})
        except Exception as e:
            print(f"❌ Erro ao listar vídeos: {e}")
            
    return videos

if __name__ == "__main__":
    canal = sys.argv[1] if len(sys.argv) > 1 else "https://www.youtube.com/@CaionoMundo/videos"
    lista = listar_conteudo_canal(canal)
    
    print("\n--- RESULTADO DA BUSCA ---")
    for i, item in enumerate(lista, 1):
        print(f"{i}. {item['title']} | {item['url']}")
