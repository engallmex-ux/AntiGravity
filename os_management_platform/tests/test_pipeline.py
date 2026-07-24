import os
import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

sys.stdout.reconfigure(encoding='utf-8')

# Adiciona o diretório raiz ao path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
from atendmech.pipeline import AtendMechPipeline
import models

async def test_atendmech_pipeline():
    # Usando banco de dados SQLite em memória para o teste isolado
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with session_factory() as session:
        pipeline = AtendMechPipeline(session)
        
        # Payload de teste
        payload = {
            "solicitante_email": "tecnico.suporte@empresa.com",
            "solicitante_nome": "Técnico Suporte",
            "titulo_os": "Falha no Ar Condicionado",
            "descricao_defeito": "Pingando água no servidor principal",
            "tipo_os": "MC",
            "prioridade": "Urgente"
        }
        
        print("[Teste] Processando payload no pipeline do AtendMech...")
        res = await pipeline.process_incoming_request(payload)
        
        assert res["status"] == "sucesso", "Falha no pipeline"
        assert res["os_id"] is not None, "OS ID não gerado"
        
        print("\n[✓] Retorno do Pipeline:")
        print(f"    - Status: {res['status']}")
        print(f"    - OS ID Criada: {res['os_id']}")
        print(f"    - Solicitante: {res['solicitante']}")
        print(f"    - Validação: {res['validacao']}")
        
        print("\n🎉 TESTE DO PIPELINE CONCLUÍDO COM SUCESSO!")
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_atendmech_pipeline())
