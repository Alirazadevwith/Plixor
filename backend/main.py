from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import logging

from core.config import settings
from core.messages import Messages
from core.database import engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Schema is owned by Alembic (see Procfile's release command), not by
    create_all -- create_all cannot alter an existing table, so it would
    silently skip every change after the first deploy."""
    from services.llm_provider import describe_configuration

    # Say which provider is live. Without this, a deployment with no key looks
    # healthy until the first student submits and grading quietly does nothing.
    print(describe_configuration(), flush=True)
    yield
    await engine.dispose()


app = FastAPI(
    title="PLIXOR",
    description="AI-Powered Examination & Answer Evaluation Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Log the failure; tell the caller something they can act on.

    The previous version returned str(exc) in development, which is how an
    internal message ends up quoted in a bug report or a screenshot. The
    traceback goes to the log either way, which is where it is useful.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"success": False, "detail": Messages.UNEXPECTED},
    )


from routers import auth, sections, exams, submissions, analytics

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(sections.router, prefix="/api/sections", tags=["sections"])
app.include_router(exams.router, prefix="/api/exams", tags=["exams"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["submissions"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])


@app.get("/")
async def root():
    return {"success": True, "message": "PLIXOR API is running", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"success": True, "status": "healthy"}