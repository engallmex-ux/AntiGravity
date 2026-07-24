import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "sqlite+aiosqlite:///C:/Users/Holter/.gemini/antigravity/scratch/os_management_platform/platform.db"

# Engine assíncrono para SQLite
engine = create_async_engine(DATABASE_URL, echo=False)

# Configuração da fábrica de sessões assíncronas
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    """Gerador de sessão assíncrona para injeção de dependência no FastAPI."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
