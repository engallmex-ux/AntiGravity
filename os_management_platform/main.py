import os
import sys
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import List, Optional

# Adiciona o diretório atual ao path para importações locais
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base, get_db
import models
from engines.copier_engine import FormCopier
from atendmech.pipeline import AtendMechPipeline

app = FastAPI(
    title="Plataforma de Gestão de OS & Automação AtendMech",
    description="API RESTful para controle de Ordens de Serviço, Copiador Web e triagem de bots.",
    version="1.0.0"
)

# Inicializa as tabelas do banco no startup (SQLite local)
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[FastAPI] Banco de dados inicializado com sucesso!")

# --- SCHEMAS PYDANTIC ---
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "cliente"

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    
    class Config:
        from_attributes = True

class WorkOrderCreate(BaseModel):
    titulo: str
    descricao: str
    prioridade: Optional[str] = "Normal"
    tipo: Optional[str] = "MC"
    solicitante_email: str

class WorkOrderResponse(BaseModel):
    id: int
    titulo: str
    descricao: str
    status: str
    prioridade: str
    tipo: str
    solicitante_id: Optional[int]
    tecnico_id: Optional[int]
    
    class Config:
        from_attributes = True

class CopierRequest(BaseModel):
    url: str
    username: Optional[str] = None
    password: Optional[str] = None
    username_selector: Optional[str] = None
    password_selector: Optional[str] = None
    submit_selector: Optional[str] = None

class AtendMechIncoming(BaseModel):
    solicitante_email: str
    solicitante_name: Optional[str] = "Usuário do Bot"
    titulo_os: str
    descricao_defeito: str
    tipo_os: Optional[str] = "MC"
    prioridade: Optional[str] = "Normal"
    template_url: Optional[str] = ""

# --- ENDPOINTS ---

# 1. Cadastro de Usuários
@app.post("/api/users/", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    # Verifica se já existe
    query = select(models.User).where(models.User.email == user.email)
    result = await db.execute(query)
    db_user = result.scalar_one_or_none()
    if db_user:
        raise HTTPException(status_code=400, detail="E-mail de usuário já cadastrado.")
        
    novo_usuario = models.User(
        name=user.name,
        email=user.email,
        password_hash="pbkdf2:sha256:" + user.password, # Hash simples para demo
        role=user.role
    )
    db.add(novo_usuario)
    await db.commit()
    await db.refresh(novo_usuario)
    return novo_usuario

# 2. Listagem de Ordens de Serviço
@app.get("/api/work-orders/", response_model=List[WorkOrderResponse])
async def list_work_orders(db: AsyncSession = Depends(get_db)):
    query = select(models.WorkOrder)
    result = await db.execute(query)
    return result.scalars().all()

# 3. Abertura Manual de Ordem de Serviço
@app.post("/api/work-orders/", response_model=WorkOrderResponse, status_code=201)
async def create_work_order(wo: WorkOrderCreate, db: AsyncSession = Depends(get_db)):
    # Procura solicitante
    query = select(models.User).where(models.User.email == wo.solicitante_email)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Solicitante não encontrado. Cadastre o usuário primeiro.")
        
    nova_os = models.WorkOrder(
        titulo=wo.titulo,
        descricao=wo.descricao,
        prioridade=wo.prioridade,
        tipo=wo.tipo,
        solicitante_id=user.id
    )
    db.add(nova_os)
    await db.commit()
    await db.refresh(nova_os)
    return nova_os

# 4. Copiador e Mapeador Web (Segundo Plano por Segurança)
def background_copy_task(req: CopierRequest, db_session_factory):
    """Executa a cópia e mapeamento no background."""
    login_config = None
    if req.username and req.password:
        login_config = {
            "url": req.url,
            "username_selector": req.username_selector or "input[name='j_username']",
            "password_selector": req.password_selector or "input[name='j_password']",
            "submit_selector": req.submit_selector or "input[type='submit']",
            "username": req.username,
            "password": req.password
        }
    
    copier = FormCopier(req.url, login_config, headless=True)
    results = copier.extract_forms()
    
    if results:
        # Abre sessão síncrona/assíncrona para salvar no banco
        # Usamos uma rotina assíncrona executada de forma gerenciada
        import asyncio
        async def save():
            async with db_session_factory() as session:
                novo_temp = models.ClonedTemplate(
                    site_nome=results["site_nome"],
                    url=results["url"],
                    campos_schema=results["campos_schema"],
                    layout_html=results["layout_html"]
                )
                session.add(novo_temp)
                await session.commit()
                print(f"[Copier] Template {results['site_nome']} cadastrado com sucesso no banco!")
        
        asyncio.run(save())

@app.post("/api/copier/analyze")
async def trigger_site_copy(req: CopierRequest, background_tasks: BackgroundTasks):
    from database import async_session
    background_tasks.add_task(background_copy_task, req, async_session)
    return {"status": "processando", "mensagem": "Mapeamento do formulário adicionado à fila de segundo plano."}

# 5. Endpoint de Entrada dos Bots AtendMech (Triagem + Validação + Abertura de OS)
@app.post("/api/atendmech/incoming")
async def atendmech_incoming(payload: AtendMechIncoming, db: AsyncSession = Depends(get_db)):
    pipeline = AtendMechPipeline(db)
    result = await pipeline.process_incoming_request({
        "solicitante_email": payload.solicitante_email,
        "solicitante_nome": payload.solicitante_name,
        "titulo_os": payload.titulo_os,
        "descricao_defeito": payload.descricao_defeito,
        "tipo_os": payload.tipo_os,
        "prioridade": payload.prioridade,
        "template_url": payload.template_url
    })
    
    if result["status"] == "erro":
        raise HTTPException(status_code=400, detail=result["mensagem"])
        
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
