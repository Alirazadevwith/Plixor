from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from core.config import settings


db_url = settings.DATABASE_URL
if "ep-xxx.neon.tech" in db_url:
    db_url = "sqlite+aiosqlite:///./plixor.db"

if "sqlite" in db_url:
    engine = create_async_engine(
        db_url,
        echo=settings.ENVIRONMENT == "development",
    )
else:
    engine = create_async_engine(
        db_url,
        echo=settings.ENVIRONMENT == "development",
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()