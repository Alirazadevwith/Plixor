from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from core.config import settings

def build_engine_url() -> str:
    """The database URL, exactly as configured.

    Deliberately does no rewriting. An earlier version swapped any URL
    containing "neon.tech" for a local SQLite file, which silently put
    production on an ephemeral disk.
    """
    url = settings.DATABASE_URL
    if not url:
        raise ValueError("DATABASE_URL is not set")
    return url


db_url = build_engine_url()

if db_url.startswith("sqlite"):
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