# NEXUS Full Agent Image
# Complete agent environment with Python, Node.js, Bash, and common tools

FROM debian:bookworm-slim AS base

# Metadata
LABEL maintainer="NEXUS Team"
LABEL description="NEXUS Full Agent - Complete execution environment with all tools"
LABEL version="1.0.0"

# Set environment
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Security: Create non-root user early
RUN groupadd -r nexus --gid=1000 && \
    useradd -r -g nexus --uid=1000 --home-dir=/home/nexus --shell=/bin/bash nexus && \
    mkdir -p /home/nexus && \
    chown -R nexus:nexus /home/nexus

# Install base system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Essential tools
    curl \
    wget \
    ca-certificates \
    gnupg \
    # Archive utilities
    zip \
    unzip \
    tar \
    gzip \
    bzip2 \
    xz-utils \
    # Text processing
    vim \
    nano \
    less \
    # Network utilities
    netcat-openbsd \
    iputils-ping \
    # Process management
    procps \
    htop \
    # Build essentials (minimal)
    build-essential \
    # Git
    git \
    # JSON/Text processing
    jq \
    # Cleanup
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# ============================================================================
# Python Installation
# ============================================================================

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create symlinks for python
RUN ln -sf /usr/bin/python3 /usr/bin/python && \
    ln -sf /usr/bin/pip3 /usr/bin/pip

# Install Python packages
RUN pip install --no-cache-dir --break-system-packages \
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
    openpyxl==3.1.2 \
    xlrd==2.0.1 \
    Pillow==10.2.0 \
    && pip cache purge || true

# ============================================================================
# Node.js Installation
# ============================================================================

# Add Node.js repository
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set Node.js environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# Install global npm packages
RUN npm install -g \
    typescript@5.3.3 \
    ts-node@10.9.2 \
    pnpm@8.15.3 \
    yarn@1.22.21 \
    axios@1.6.7 \
    lodash@4.17.21 \
    uuid@9.0.1 \
    date-fns@3.3.1 \
    zod@3.22.4 \
    cheerio@1.0.0-rc.12 \
    && npm cache clean --force

# ============================================================================
# Additional Tools
# ============================================================================

# Install additional useful tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Database clients (minimal)
    sqlite3 \
    # Network tools
    nmap \
    # Text/code utilities
    dos2unix \
    # File utilities
    file \
    tree \
    # Math utilities
    bc \
    # Cleanup
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# ============================================================================
# Workspace Setup
# ============================================================================

# Create workspace
WORKDIR /workspace
RUN chown -R nexus:nexus /workspace

# Set Python environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Security configurations
RUN chmod 755 /workspace && \
    chmod 700 /home/nexus

# Switch to non-root user
USER nexus

# Initialize npm for the workspace
RUN npm init -y

# Default command
CMD ["bash"]

# ============================================================================
# Development stage
# ============================================================================

FROM base AS development

USER root

# Install additional development tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Debugging tools
    strace \
    ltrace \
    gdb \
    # Network debugging
    tcpdump \
    wireshark-common \
    # Additional editors
    emacs-nox \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Install development npm packages
RUN npm install -g \
    eslint@8.57.0 \
    prettier@3.2.5 \
    nodemon@3.1.0 \
    tsx@4.7.1 \
    && npm cache clean --force

USER nexus

# ============================================================================
# Production stage
# ============================================================================

FROM base AS production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "print('healthy')" && node -e "console.log('healthy')" || exit 1

CMD ["bash"]
