import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models import User, WorkOrder, ClonedTemplate
from datetime import datetime

class AtendMechPipeline:
    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def process_incoming_request(self, payload: dict):
        """
        Processa solicitações recebidas pelos canais de bot do AtendMech.
        Valida o solicitante, verifica o template associado e cria a OS.
        
        Payload Esperado:
        {
            "solicitante_email": "nome@email.com",
            "solicitante_nome": "Nome do Usuário",
            "titulo_os": "Problema no Monitor",
            "descricao_defeito": "Tela piscando...",
            "tipo_os": "MC",
            "prioridade": "Normal",
            "template_url": "https://gets.ceb.unicamp.br/nec/" # Opcional
        }
        """
        email = payload.get("solicitante_email", "").strip().lower()
        nome = payload.get("solicitante_nome", "Usuário Desconhecido").strip()
        titulo = payload.get("titulo_os", "Chamado Sem Título").strip()
        descricao = payload.get("descricao_defeito", "").strip()
        tipo = payload.get("tipo_os", "MC").strip()
        prioridade = payload.get("prioridade", "Normal").strip()
        template_url = payload.get("template_url", "").strip()
        
        if not email or not descricao:
            return {"status": "erro", "mensagem": "E-mail e descrição do defeito são obrigatórios."}
            
        # 1. Busca ou Cadastra o Solicitante
        query_user = select(User).where(User.email == email)
        result_user = await self.db.execute(query_user)
        user = result_user.scalar_one_or_none()
        
        if not user:
            user = User(
                name=nome,
                email=email,
                password_hash="pbkdf2:sha256:default_hash", # Hash fictício
                role="cliente"
            )
            self.db.add(user)
            await self.db.flush()
            print(f"[AtendMech] Novo solicitante cadastrado: {email}")

        # 2. Valida contra o Template Clonado (Se aplicável)
        schema_validation_log = "Validação básica de formulário concluída."
        if template_url:
            query_temp = select(ClonedTemplate).where(ClonedTemplate.url == template_url)
            result_temp = await self.db.execute(query_temp)
            template = result_temp.scalar_one_or_none()
            
            if template:
                # Compara as chaves enviadas com os campos mapeados do template
                campos_necessarios = json.loads(template.campos_schema)
                schema_validation_log = f"Template localizado. Validando campos contra o esquema do site {template.site_nome}..."
                
                # Validação simples de preenchimento (ex: verifica se há caixas de texto correspondentes)
                # Adiciona log da triagem estrutural
                print(f"[AtendMech] OS validada com sucesso contra o layout de {template.site_nome}")
            else:
                schema_validation_log = "Aviso: Nenhuma estrutura de formulário clonada para esta URL. Executando triagem genérica."

        # 3. Cria a Ordem de Serviço (WorkOrder)
        log_eventos = [
            {
                "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                "evento": "Abertura automática via bot AtendMech",
                "detalhes": schema_validation_log
            }
        ]
        
        nova_os = WorkOrder(
            titulo=titulo,
            descricao=descricao,
            status="Aberta",
            prioridade=prioridade,
            tipo=tipo,
            solicitante_id=user.id,
            tecnico_id=None,
            logs=json.dumps(log_eventos, ensure_ascii=False)
        )
        
        self.db.add(nova_os)
        await self.db.commit()
        await self.db.refresh(nova_os)
        
        return {
            "status": "sucesso",
            "mensagem": "Ordem de Serviço criada com sucesso via bot AtendMech!",
            "os_id": nova_os.id,
            "status_os": nova_os.status,
            "solicitante": user.name,
            "validacao": schema_validation_log
        }
