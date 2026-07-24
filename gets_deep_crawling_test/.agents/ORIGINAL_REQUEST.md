# Original User Request

## 2026-07-21T21:27:24Z

O projeto visa mapear e auditar de forma automatizada o portal GETS (Hospital Unicamp) utilizando a equipe de agentes para simular cliques de navegação, extrair seletores HTML e exibir o progresso em tempo real.

Working directory: C:\Users\Holter\teamwork_projects\gets_deep_crawling_test
Integrity mode: development

## Requirements

### R1. Rastreamento e Mapeamento por Cliques Reais (Modo Visível)
O sistema de agentes deve efetuar login no portal GETS utilizando as credenciais existentes salvas no arquivo `.env` local (`lucas.fonseca.4@hubrasil.gov.br`). O robô deve navegar pelos menus internos simulando cliques reais, mapeando as transições de rotas ("De onde para onde"). O navegador Playwright deve ser iniciado obrigatoriamente em modo visível (headless=False) para acompanhamento em tempo real.

### R2. Extração de Seletores e Inputs
Para cada página acessada, o robô deve mapear todos os formulários e extrair os seletores CSS válidos e os identificadores JSF (como ViewState) de caixas de texto, selects e botões.

### R3. Indicador de Progresso Dinâmico (Porcentagem)
O robô deve calcular e exibir dinamicamente o progresso em tempo real tanto no console quanto no status do painel Markdown, utilizando a fórmula `(Páginas Visitadas / Total de Páginas Descobertas) * 100`, mostrando a estimativa de quanto falta para concluir a varredura.

### R4. Geração de Relatórios e Schema
Consolidar a estrutura mapeada em um arquivo JSON (`gets_schema.json`) e gerar um relatório técnico consolidado de auditoria em Markdown (`mapa_mental.md`) contendo a tabela de rotas, a tabela de seletores e o diagrama Mermaid no diretório de trabalho.

## Acceptance Criteria

### Cobertura de Rotas e Páginas
- [ ] O robô de cliques deve mapear no mínimo 8 subpáginas internas distintas do GETS.
- [ ] O relatório final deve conter a tabela de transição detalhando pelo menos 10 conexões de roteamento passo-a-passo (Origem -> Clique -> Destino).
- [ ] Exibir a barra/porcentagem de progresso em tempo real durante a execução (ex: `Mapeamento: 4/12 páginas - 33.3% Concluído`).
- [ ] O arquivo `gets_schema.json` e o `mapa_mental.md` devem ser salvos no diretório de trabalho `gets_deep_crawling_test`.
- [ ] Todos os campos de formulário das páginas de "Pendências" e "Abertura de OS" do GETS devem ser identificados com seletores CSS testados e válidos.
