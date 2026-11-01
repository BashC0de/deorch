FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# ── Builder stage ─────────────────────────────────────────────────────────────
FROM base AS builder

RUN pip install hatchling

COPY pyproject.toml ./
RUN pip install --prefix=/install .

# ── Development stage ─────────────────────────────────────────────────────────
FROM base AS development

COPY --from=builder /install /usr/local
COPY pyproject.toml ./
RUN pip install -e ".[dev]"

COPY src/ ./src/
COPY alembic.ini ./

EXPOSE 8000
CMD ["uvicorn", "deorch_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/src"]

# ── Production stage ──────────────────────────────────────────────────────────
FROM base AS production

RUN groupadd -r deorch && useradd -r -g deorch deorch

COPY --from=builder /install /usr/local

WORKDIR /app
COPY src/ ./src/
COPY alembic.ini ./

RUN chown -R deorch:deorch /app
USER deorch

EXPOSE 8000
CMD ["uvicorn", "deorch_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
