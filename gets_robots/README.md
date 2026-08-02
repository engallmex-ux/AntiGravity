# 🤖 Suite de Robôs de Extração e Auditoria GETS (CEB / Unicamp)

Esta suite automatiza a varredura, auditoria de seletores JSF/HTML, acompanhamento de progresso em tempo real e extração de ordens de serviço do portal **GETS**.

## 🚀 Como Executar

Execute o terminal interativo:

```bash
.venv\Scripts\python.exe -m gets_robots.cli
```

Ou através do script orquestrador:

```bash
.venv\Scripts\python.exe gets_robots/run_pipeline.py
```

## 📋 Recursos

- **Progresso Dinâmico no Terminal**: Exibição visual de porcentagem `(Páginas Visitadas / Total Descoberto) * 100`.
- **Navegador Visível (Headless=False)**: Acompanhe o cursor clicando elemento por elemento no portal.
- **Relatório Completo**: Gera o arquivo `mapa_mental.md` (com fluxograma Mermaid) e `gets_schema.json`.
- **Credenciais Automáticas**: Lê de arquivos `.env` locais.
