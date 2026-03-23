#!/bin/bash
# ============================================================================
# NEXUS - Unified Start Script
# ============================================================================
# Starts both the backend server and frontend in one command
#
# Usage:
#   ./start-all.sh              - Start both servers
#   ./start-all.sh --backend    - Start only backend
#   ./start-all.sh --frontend   - Start only frontend
#   ./start-all.sh --detach     - Run in background
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT="${NEXUS_BACKEND_PORT:-3001}"
WS_PORT="${NEXUS_WS_PORT:-3002}"
FRONTEND_PORT="${NEXUS_FRONTEND_PORT:-3000}"
HOST="${NEXUS_HOST:-0.0.0.0}"

# Parse arguments
BACKEND_ONLY=false
FRONTEND_ONLY=false
DETACH=false

for arg in "$@"; do
  case $arg in
    --backend)
      BACKEND_ONLY=true
      shift
      ;;
    --frontend)
      FRONTEND_ONLY=true
      shift
      ;;
    --detach|-d)
      DETACH=true
      shift
      ;;
  esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ============================================================================
# FUNCTIONS
# ============================================================================

print_banner() {
  echo -e "${PURPLE}"
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║                                                              ║"
  echo "║   ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗              ║"
  echo "║   ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝              ║"
  echo "║   ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗              ║"
  echo "║   ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║              ║"
  echo "║   ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║              ║"
  echo "║   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝              ║"
  echo "║                                                              ║"
  echo "║   Intelligent AI Agent Framework                            ║"
  echo "║                                                              ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

check_dependencies() {
  echo -e "${CYAN}🔍 Checking dependencies...${NC}"
  
  # Check for bun
  if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun is not installed. Please install from https://bun.sh${NC}"
    exit 1
  fi
  echo -e "   ${GREEN}✓${NC} Bun $(bun --version)"
  
  # Check for node (fallback)
  if command -v node &> /dev/null; then
    echo -e "   ${GREEN}✓${NC} Node $(node --version)"
  fi
  
  echo ""
}

start_backend() {
  echo -e "${CYAN}🚀 Starting NEXUS Backend Server...${NC}"
  echo -e "   ${BLUE}HTTP API:${NC}  http://${HOST}:${BACKEND_PORT}"
  echo -e "   ${BLUE}WebSocket:${NC} ws://${HOST}:${WS_PORT}"
  echo ""
  
  cd "$SCRIPT_DIR"
  
  if [ "$DETACH" = true ]; then
    bun run server.ts --port $BACKEND_PORT --ws-port $WS_PORT > /tmp/nexus-backend.log 2>&1 &
    echo $! > /tmp/nexus-backend.pid
    echo -e "   ${GREEN}✓${NC} Backend started (PID: $(cat /tmp/nexus-backend.pid))"
  else
    bun run server.ts --port $BACKEND_PORT --ws-port $WS_PORT
  fi
}

start_frontend() {
  echo -e "${CYAN}🌐 Starting NEXUS Frontend...${NC}"
  echo -e "   ${BLUE}URL:${NC} http://localhost:${FRONTEND_PORT}"
  echo ""
  
  cd "$PROJECT_ROOT"
  
  if [ "$DETACH" = true ]; then
    bun run dev > /tmp/nexus-frontend.log 2>&1 &
    echo $! > /tmp/nexus-frontend.pid
    echo -e "   ${GREEN}✓${NC} Frontend started (PID: $(cat /tmp/nexus-frontend.pid))"
  else
    bun run dev
  fi
}

start_all() {
  print_banner
  check_dependencies
  
  if [ "$BACKEND_ONLY" = true ]; then
    start_backend
  elif [ "$FRONTEND_ONLY" = true ]; then
    start_frontend
  else
    # Start backend in background
    cd "$SCRIPT_DIR"
    bun run server.ts --port $BACKEND_PORT --ws-port $WS_PORT > /tmp/nexus-backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > /tmp/nexus-backend.pid
    
    echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
    sleep 2
    
    # Start frontend in background
    cd "$PROJECT_ROOT"
    bun run dev > /tmp/nexus-frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > /tmp/nexus-frontend.pid
    
    echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
    echo ""
    
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ NEXUS is running!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "   ${BLUE}Frontend:${NC}  http://localhost:${FRONTEND_PORT}"
    echo -e "   ${BLUE}Backend:${NC}   http://localhost:${BACKEND_PORT}"
    echo -e "   ${BLUE}WebSocket:${NC} ws://localhost:${WS_PORT}"
    echo ""
    echo -e "   ${YELLOW}Logs:${NC}"
    echo -e "   Backend:  /tmp/nexus-backend.log"
    echo -e "   Frontend: /tmp/nexus-frontend.log"
    echo ""
    echo -e "   ${YELLOW}To stop:${NC} kill \$(cat /tmp/nexus-backend.pid) \$(cat /tmp/nexus-frontend.pid)"
    echo ""
    
    # Wait for processes
    wait $BACKEND_PID $FRONTEND_PID
  fi
}

# ============================================================================
# MAIN
# ============================================================================

# Cleanup function
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down NEXUS...${NC}"
  
  if [ -f /tmp/nexus-backend.pid ]; then
    kill $(cat /tmp/nexus-backend.pid) 2>/dev/null || true
    rm /tmp/nexus-backend.pid
  fi
  
  if [ -f /tmp/nexus-frontend.pid ]; then
    kill $(cat /tmp/nexus-frontend.pid) 2>/dev/null || true
    rm /tmp/nexus-frontend.pid
  fi
  
  echo -e "${GREEN}✅ Shutdown complete${NC}"
  exit 0
}

# Register cleanup
trap cleanup SIGINT SIGTERM

# Run
start_all
