#!/bin/bash
# NEXUS Server Startup Script
# Usage: ./start-server.sh [--port PORT] [--ws-port WS_PORT]

PORT=${1:-3000}
WS_PORT=${2:-3002}

echo "Starting NEXUS Server on port $PORT..."
echo "WebSocket on port $WS_PORT..."

cd "$(dirname "$0")"

# Kill any existing server
pkill -f "bun run server.ts" 2>/dev/null

# Start server
bun run server.ts --port $PORT --ws-port $WS_PORT
