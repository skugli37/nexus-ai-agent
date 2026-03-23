# NEXUS Node.js Agent Image
# Optimized for secure Node.js code execution

FROM node:20-bookworm-slim AS base

# Metadata
LABEL maintainer="NEXUS Team"
LABEL description="NEXUS Node.js Agent - Secure Node.js execution environment"
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

# Set environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256" \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# Install global npm packages for agent capabilities
RUN npm install -g \
    typescript@5.3.3 \
    ts-node@10.9.2 \
    pnpm@8.15.3 \
    yarn@1.22.21 \
    && npm cache clean --force

# Install common npm packages globally for reuse
RUN npm install -g \
    axios@1.6.7 \
    lodash@4.17.21 \
    uuid@9.0.1 \
    date-fns@3.3.1 \
    zod@3.22.4 \
    cheerio@1.0.0-rc.12 \
    && npm cache clean --force

# Security configurations
RUN chmod 755 /workspace && \
    chmod 700 /home/nexus

# Switch to non-root user
USER nexus

# Initialize npm for the workspace
RUN npm init -y

# Default command
CMD ["node", "--version"]

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

# Install development packages
RUN npm install -g \
    eslint@8.57.0 \
    prettier@3.2.5 \
    nodemon@3.1.0 \
    && npm cache clean --force

USER nexus

# ============================================================================
# Production stage
# ============================================================================

FROM base AS production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

CMD ["node"]
