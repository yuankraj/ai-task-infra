# ============================================
# Stage 1: Builder - install dependencies
# ============================================
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ============================================
# Stage 2: Production image
# ============================================
FROM python:3.12-slim AS production

# Create non-root user
RUN groupadd -r worker && useradd -r -g worker -u 1001 worker

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /home/worker/.local

# Copy application source
COPY --chown=worker:worker worker.py .

# Environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/home/worker/.local/bin:$PATH \
    WORKER_VERSION=1.0.0

# Switch to non-root user
USER worker

# Health check - we check if the process is running via a sentinel file
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import redis; r = redis.Redis(host='${REDIS_HOST:-redis}', port=int('${REDIS_PORT:-6379}'), password='${REDIS_PASSWORD:-}' or None); r.ping()" || exit 1

CMD ["python", "-u", "worker.py"]
