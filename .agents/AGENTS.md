# Regras Globais do Projeto: Robô Analista GETS (Engenharia Clínica)

## 🛡️ 1. Protocolo Estrito de Segurança e Permissões (Read-Only Default)
- **Modo Padrão**: Todos os robôs e varreduras funcionam exclusivamente em **Modo Somente Leitura (Read-Only)**.
- **Solicitação de Permissão Explícita**: Caso seja necessário realizar qualquer alteração, preenchimento de teste ou criação no portal GETS:
  1. O robô/agente DEVE parar e avisar o usuário antecedente.
  2. Indicar a **URL / Página Exata** onde a ação ocorrerá.
  3. Descrever os **campos, dados e botões** que serão afetados.
  4. Aguardar o consentimento explícito do usuário antes de enviar o formulário.

## 🎯 2. Política de Dados 100% Reais (Zero Alucinações / Zero Dados Fictícios)
- **Fidelidade aos Dados**: NUNCA inventar ou alucinar nomes de equipamentos, setores, patrimônios, clientes ou técnicos.
- **Transparência de Lacunas**: O que não tiver sido extraído do sistema GETS ou não constar no banco SQLite `gets_data.db` DEVE ser exibido como `"Aguardando varredura"` ou `"-"`.
- **Proibição de Dados Fictícios**: Proibida a exibição de dados mock/dummy fictícios na interface web, nos relatórios ou nos dashboards. Todos os números e tabelas DEVEM refletir estritamente a realidade capturada.

## 🧠 3. Papel do Agente: Robô Analista GETS ("Usuário Master")
- Mapear a arquitetura, seletores HTML/JSF e rotas do portal GETS sem depender do suporte da universidade/desenvolvedor original.
- Manter histórico de varreduras para **comparação periódica de versões** (detectando novos campos, mudanças de layout ou novas telas).
- Suportar extração do **Inventário Master Completo de Ativos** para alimentar bancos de dados locais (SQLite `gets_data.db`) e dashboards (Grafana / Web UI).
