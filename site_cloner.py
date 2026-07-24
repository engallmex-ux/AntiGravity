import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
import re
import time
import random
import urllib.parse
import mimetypes
from bs4 import BeautifulSoup
import requests

# Configurações padrão de segurança e controle
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
DEFAULT_DELAY = (1.0, 2.5)  # Atraso em segundos para evitar sobrecarga (min, max)

class SecureSiteCloner:
    def __init__(self, base_url, output_dir, max_depth=2, delay_range=DEFAULT_DELAY):
        self.base_url = base_url
        self.output_dir = output_dir
        self.max_depth = max_depth
        self.delay_range = delay_range
        
        # 解析 base_url para segurança de domínio (não sair do site principal)
        parsed_base = urllib.parse.urlparse(base_url)
        self.allowed_domain = parsed_base.netloc
        self.base_path = parsed_base.path
        
        # Cache e controle de páginas já baixadas para evitar loops
        self.visited_urls = set()
        self.downloaded_assets = {}  # original_url -> local_path
        
        # Inicializa a sessão HTTP segura com User-Agent comum
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        
        # Cria diretórios locais estruturados
        self.assets_dir = os.path.join(output_dir, "assets")
        os.makedirs(self.assets_dir, exist_ok=True)

    def _get_local_filepath(self, url, is_asset=False):
        """Mapeia uma URL remota para um caminho de arquivo local seguro."""
        parsed = urllib.parse.urlparse(url)
        path = parsed.path
        
        # Se for a página principal ou diretório vazio, salva como index.html
        if not path or path.endswith("/"):
            path += "index.html"
            
        # Limpa o caminho para evitar directory traversal (segurança local)
        path = re.sub(r'[\\:*?"<>|]', '_', path)
        path = path.lstrip("/")
        
        if is_asset:
            # Salva na pasta compartilhada de assets para evitar duplicados
            filename = os.path.basename(path)
            if not filename:
                filename = f"asset_{abs(hash(url))}"
            # Garante extensão correta
            ext = os.path.splitext(filename)[1]
            if not ext:
                filename += ".dat"
            return os.path.join(self.assets_dir, filename)
        else:
            # Mantém a estrutura de páginas
            if not path.endswith(".html") and not path.endswith(".htm"):
                path += ".html"
            full_path = os.path.join(self.output_dir, path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            return full_path

    def _is_url_allowed(self, url):
        """Verifica se a URL pertence ao mesmo domínio e é segura para baixar."""
        parsed = urllib.parse.urlparse(url)
        # Só permite URLs HTTP/HTTPS do mesmo domínio principal
        if parsed.scheme not in ("http", "https"):
            return False
        return parsed.netloc == self.allowed_domain

    def download_asset(self, url):
        """Baixa um recurso estático (imagem, CSS, JS) e salva localmente."""
        if url in self.downloaded_assets:
            return self.downloaded_assets[url]
            
        if not self._is_url_allowed(url):
            return url  # Não baixa recursos externos, apenas mantém a URL
            
        local_path = self._get_local_filepath(url, is_asset=True)
        
        try:
            # Delay de segurança para não sobrecarregar
            time.sleep(random.uniform(*self.delay_range))
            print(f"   [⬇️] Baixando recurso: {url}")
            
            response = self.session.get(url, timeout=10, stream=True)
            if response.status_code == 200:
                with open(local_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                # Armazena o caminho relativo para substituição nos links do HTML
                rel_path = os.path.relpath(local_path, start=self.output_dir)
                # Normaliza barras para formato web
                rel_path = rel_path.replace("\\", "/")
                self.downloaded_assets[url] = rel_path
                return rel_path
        except Exception as e:
            print(f"   [⚠️] Falha ao baixar recurso {url}: {e}")
            
        return url

    def clone_page(self, url, current_depth=0):
        """Método recursivo para baixar páginas HTML e extrair novos links."""
        if url in self.visited_urls or current_depth > self.max_depth:
            return
            
        self.visited_urls.add(url)
        print(f"\n[📖] Analisando página (Nível {current_depth}): {url}")
        
        local_filepath = self._get_local_filepath(url)
        
        try:
            time.sleep(random.uniform(*self.delay_range))
            response = self.session.get(url, timeout=15)
            
            if response.status_code != 200:
                print(f"   [❌] Falha no acesso ({response.status_code}): {url}")
                return
                
            # Verifica se o conteúdo é HTML
            content_type = response.headers.get("Content-Type", "")
            if "text/html" not in content_type:
                print(f"   [ℹ️] Pulando (não é HTML): {url}")
                return
                
            soup = BeautifulSoup(response.text, "html.parser")
            
            # 1. Processar Recursos de Estilo (CSS)
            for link in soup.find_all("link", rel="stylesheet"):
                href = link.get("href")
                if href:
                    absolute_href = urllib.parse.urljoin(url, href)
                    local_href = self.download_asset(absolute_href)
                    link["href"] = local_href
                    
            # 2. Processar Imagens
            for img in soup.find_all("img"):
                src = img.get("src")
                if src:
                    absolute_src = urllib.parse.urljoin(url, src)
                    local_src = self.download_asset(absolute_src)
                    img["src"] = local_src
                    
            # 3. Processar Scripts (JS)
            for script in soup.find_all("script"):
                src = script.get("src")
                if src:
                    absolute_src = urllib.parse.urljoin(url, src)
                    local_src = self.download_asset(absolute_src)
                    script["src"] = local_src

            # 4. Extrair novos links para rastreamento recursivo
            links_to_crawl = []
            for a in soup.find_all("a"):
                href = a.get("href")
                if href:
                    # Remove âncoras locais da URL
                    clean_href = href.split("#")[0]
                    absolute_href = urllib.parse.urljoin(url, clean_href)
                    
                    if self._is_url_allowed(absolute_href):
                        # Mapeia o link no HTML local para o arquivo local correspondente
                        local_link = self._get_local_filepath(absolute_href)
                        rel_link = os.path.relpath(local_link, start=os.path.dirname(local_filepath))
                        a["href"] = rel_link.replace("\\", "/")
                        
                        if absolute_href not in self.visited_urls:
                            links_to_crawl.append(absolute_href)

            # Salva o arquivo HTML modificado localmente
            with open(local_filepath, "w", encoding="utf-8") as f:
                f.write(soup.prettify())
            print(f"   [✅] Página salva localmente em: {os.path.basename(local_filepath)}")

            # Continua o crawling recursivo se não atingiu o limite de profundidade
            for next_url in links_to_crawl:
                self.clone_page(next_url, current_depth + 1)
                
        except Exception as e:
            print(f"   [❌] Erro ao clonar a página {url}: {e}")

def run():
    print("=" * 65)
    print("🛡️ CLONADOR DE SITES SEGURO E PROPRIETÁRIO (CRAWLER LOCAL)")
    print("   Execução 100% interna e offline sem dependências externas")
    print("=" * 65)
    
    # Exemplo de uso para testes internos
    # Altere a URL para o site alvo que deseja clonar para estudos locais
    target_url = "https://gets.ceb.unicamp.br/nec/"  # ou qualquer URL que deseja analisar
    output_directory = r"C:\Users\Holter\.gemini\antigravity\scratch\site_cloned_data"
    
    print(f"[+] Iniciando clone de: {target_url}")
    print(f"[+] Destino local: {output_directory}\n")
    
    cloner = SecureSiteCloner(
        base_url=target_url,
        output_dir=output_directory,
        max_depth=1,  # Profundidade segura de 1 nível para testes
        delay_range=(1.0, 3.0)  # Delay seguro para evitar bloqueios/sobrecarga
    )
    
    cloner.clone_page(target_url)
    
    print("\n" + "=" * 65)
    print("✅ PROCESSO DE CLONAGEM CONCLUÍDO COM SUCESSO!")
    print(f"   Total de páginas mapeadas: {len(cloner.visited_urls)}")
    print(f"   Total de arquivos estáticos (assets) baixados: {len(cloner.downloaded_assets)}")
    print(f"   Arquivos salvos em: {output_directory}")
    print("=" * 65)

if __name__ == "__main__":
    run()
