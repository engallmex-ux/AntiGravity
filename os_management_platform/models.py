from sqlalchemy import String, Integer, ForeignKey, Text, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="cliente") # cliente, atendente, tecnico
    
    # Relacionamentos
    solicitacoes = relationship("WorkOrder", foreign_keys="[WorkOrder.solicitante_id]", back_populates="solicitante")
    atribuicoes = relationship("WorkOrder", foreign_keys="[WorkOrder.tecnico_id]", back_populates="tecnico")

class WorkOrder(Base):
    __tablename__ = "work_orders"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    titulo: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Aberta") # Aberta, Em Andamento, Concluida
    prioridade: Mapped[str] = mapped_column(String(20), default="Normal") # Normal, Baixa, Urgente
    tipo: Mapped[str] = mapped_column(String(10), default="MC") # MP (Preventiva), MC (Corretiva), INST (Instalação)
    
    solicitante_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    tecnico_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    data_abertura: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    logs: Mapped[str] = mapped_column(Text, default="[]") # Histórico de eventos em JSON
    
    # Relações ORM
    solicitante = relationship("User", foreign_keys=[solicitante_id], back_populates="solicitacoes")
    tecnico = relationship("User", foreign_keys=[tecnico_id], back_populates="atribuicoes")

class ClonedTemplate(Base):
    __tablename__ = "cloned_templates"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    site_nome: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(String(255), nullable=False)
    campos_schema: Mapped[str] = mapped_column(Text, nullable=False) # JSON estruturado de inputs e seletores
    layout_html: Mapped[str] = mapped_column(Text, nullable=True) # HTML de referência

class AtendMechBot(Base):
    __tablename__ = "atend_mech_bots"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bot_nome: Mapped[str] = mapped_column(String(100), nullable=False)
    canal: Mapped[str] = mapped_column(String(20), default="Telegram") # Telegram, Whatsapp
    regras_json: Mapped[str] = mapped_column(Text, default="{}") # Regras e fluxos
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
