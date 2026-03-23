# NEXUS Python Agent Image
# Optimized for secure Python code execution

FROM python:3.11-slim-bookworm AS base

# Metadata
LABEL maintainer="NEXUS Team"
LABEL description="NEXUS Python Agent - Secure Python execution environment"
LABEL version="1.0.0"

# Security: Create non-root user
RUN groupadd -r nexus --gid=1000 && \
    useradd -r -g nexus --uid=1000 --home-dir=/home/nexus --shell=/bin/bash nexus && \
    mkdir -p /home/nexus && \
    chown -R nexus:nexus /home/nexus

# Install system dependencies (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create workspace
WORKDIR /workspace
RUN chown -R nexus:nexus /workspace

# Install Python packages for agent capabilities
RUN pip install --no-cache-dir \
    numpy==1.26.4 \
    pandas==2.2.0 \
    requests==2.31.0 \
    httpx==0.26.0 \
    aiohttp==3.9.3 \
    pydantic==2.6.1 \
    python-dateutil==2.8.2 \
    python-dotenv==1.0.1 \
    beautifulsoup4==4.12.3 \
    lxml==5.1.0 \
    scikit-learn==1.4.0 \
    matplotlib==3.8.2 \
    seaborn==0.13.2 \
    && pip cache purge

# Security configurations
RUN chmod 755 /workspace && \
    chmod 700 /home/nexus

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Switch to non-root user
USER nexus

# Default command
CMD ["python", "--version"]

# ============================================================================
# Build stage for additional tools
# ============================================================================

FROM base AS tools

USER root

# Install additional development tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    vim \
    && rm -rf /var/lib/apt/lists/*

USER nexus

# ============================================================================
# Production stage
# ============================================================================

FROM base AS production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "print('healthy')" || exit 1

CMD ["python"]
