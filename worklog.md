# DEEP RESEARCH REPORT: Agent Zero Framework
**Task ID: 1-b**  
**Date: 2025-01-09**

---

## 1. AGENT ZERO FRAMEWORK - Executive Summary

### Repository Information
- **GitHub**: https://github.com/agent0ai/agent-zero
- **Stars**: 16,276 ⭐
- **Forks**: 3,341
- **Language**: Python
- **License**: Custom (Other)
- **Website**: https://agent-zero.ai

### Core Philosophy
Agent Zero is a **personal, organic agentic framework** designed to be:
- Dynamic and organically growing
- Learning as you use it
- Fully transparent, readable, comprehensible
- Customizable and interactive
- Using the computer as a tool to accomplish tasks

---

## 2. SELF-EVOLVING MECHANISM

### 2.1 Dynamic Behavior System

Agent Zero implements a sophisticated **behavior adjustment mechanism** that allows the agent to modify its behavior in real-time:

```python
# From behaviour_adjustment.py
async def update_behaviour(agent: Agent, log_item: LogItem, adjustments: str):
    # Get system message and current ruleset
    system = agent.read_prompt("behaviour.merge.sys.md")
    current_rules = read_rules(agent)
    
    # Call util LLM to merge new adjustments
    adjustments_merge = await agent.call_utility_model(
        system=system,
        message=msg,
        callback=log_callback,
    )
    
    # Update rules file
    rules_file = get_custom_rules_file(agent)
    files.write_file(rules_file, adjustments_merge)
```

**Key Features:**
- Behavior changes are automatically integrated into the system prompt
- Rules are merged intelligently, avoiding duplicates and conflicts
- Custom rules stored in agent's memory directory as `behaviour.md`
- Changes are applied without disrupting other components

### 2.2 Organic Growth Through Memory

The memory system enables **organic learning**:

```python
class Memory:
    class Area(Enum):
        MAIN = "main"        # User-provided information
        FRAGMENTS = "fragments"  # Auto-updated conversation pieces
        SOLUTIONS = "solutions"  # Successful solutions from past
```

**Memory Categories:**
1. **MAIN**: User-provided information (API keys, preferences, context)
2. **FRAGMENTS**: Auto-extracted pieces from conversations
3. **SOLUTIONS**: Stores successful solutions for future reference

### 2.3 Self-Correction Mechanism

The solving prompt guides self-correction:

```markdown
## Problem solving
0 outline plan
1 check memories solutions skills prefer skills
2 break task into subtasks if needed
3 solve or delegate
4 complete task
   - focus user task
   - present results verify with tools
   - don't accept failure retry be high-agency
   - save useful info with memorize tool
```

---

## 3. TOOL CREATION MECHANISM

### 3.1 Computer as Tool Philosophy

Agent Zero uses the **operating system as a tool**:
- No single-purpose tools pre-programmed
- Writes its own code and uses terminal to create tools
- Default tools: online search, memory, communication, code/terminal execution

### 3.2 Code Execution Tool

```python
class CodeExecution(Tool):
    async def execute(self, **kwargs) -> Response:
        runtime = self.args.get("runtime", "").lower().strip()
        
        if runtime == "python":
            response = await self.execute_python_code(...)
        elif runtime == "nodejs":
            response = await self.execute_nodejs_code(...)
        elif runtime == "terminal":
            response = await self.execute_terminal_command(...)
```

**Capabilities:**
- Execute Python, Node.js, and Shell code
- Multiple session support for multitasking
- SSH and local execution modes
- Real-time output streaming

### 3.3 Skills System (SKILL.md Standard)

```yaml
---
name: "my-skill"
description: "What this skill does"
tags: ["category", "purpose"]
---

# Skill Instructions
Your detailed instructions here...
```

**Cross-Platform Compatibility:**
- Claude Code, Cursor, Goose
- OpenAI Codex CLI, GitHub Copilot
- Semantic recall via vector memory
- Token-efficient dynamic loading

---

## 4. LEARNING & IMPROVEMENT CYCLES

### 4.1 Message History Summarization

Agent Zero employs sophisticated context management:

- **Dynamic Compression**: Recent messages remain original, older messages compressed
- **Multiple Compression Levels**: Efficient context window usage
- **Bulk and Topic Summarization**: Groups related messages thematically
- **Context Window Optimization**: Near-infinite short-term memory

### 4.2 Solution Memorization

The system automatically extracts and stores successful solutions:

1. Agent completes task successfully
2. Utility model analyzes the conversation
3. Durable knowledge extracted from noise
4. Solution stored in memory for future reference

### 4.3 Persistent Memory with VectorDB

```python
class MyFaiss(FAISS):
    # Vector database for semantic search
    # Embeddings generated locally
    # Hybrid model: automatic + manual management
```

---

## 5. TRANSPARENCY & DEBUG-ABILITY

### 5.1 Prompt-Based Architecture

Everything is defined in markdown prompts:
- `agent.system.main.md` - Central hub
- `agent.system.main.role.md` - Agent role definition
- `agent.system.main.solving.md` - Problem-solving approach
- `agent.system.tool.*.md` - Individual tool prompts

### 5.2 Real-Time Streaming

- Terminal interface streams in real-time
- Users can intervene at any point
- HTML logs saved for every session
- Interactive intervention during execution

### 5.3 Extension System

25+ extension hooks for transparency:
```
python/extensions/
├── agent_init/
├── message_loop_start/
├── message_loop_end/
├── monologue_start/
├── monologue_end/
├── reasoning_stream/
├── tool_execute_before/
├── tool_execute_after/
├── system_prompt/
└── ...
```

---

## 6. MULTI-AGENT COOPERATION

### 6.1 Hierarchical Agent Structure

```python
class Delegation(Tool):
    async def execute(self, message="", reset="", **kwargs):
        # Create subordinate agent
        sub = Agent(self.agent.number + 1, config, self.agent.context)
        
        # Register superior/subordinate relationship
        sub.set_data(Agent.DATA_NAME_SUPERIOR, self.agent)
        self.agent.set_data(Agent.DATA_NAME_SUBORDINATE, sub)
        
        # Run subordinate monologue
        result = await subordinate.monologue()
```

### 6.2 Communication Flow

```
User (Superior)
    ↓
Agent 0
    ↓ delegates to
Subordinate Agent 1
    ↓ delegates to
Subordinate Agent 2
    ↓
Results flow back up
```

### 6.3 Profile Specialization

- Subordinates can have different agent profiles
- Each profile has custom prompts, tools, extensions
- Avoids delegating to same profile as superior

---

## 7. AUTONOMOUS FEATURES

### 7.1 Task Scheduler

```python
class SchedulerTool(Tool):
    async def execute(self, **kwargs):
        if self.method == "create_scheduled_task":
            # Cron-like scheduling
            # "schedule": {"minute": "*/20", "hour": "*", ...}
        elif self.method == "create_adhoc_task":
            # One-time tasks
        elif self.method == "create_planned_task":
            # Planned future tasks
```

**Scheduler Capabilities:**
- Scheduled tasks (cron-like)
- Ad-hoc tasks (one-time)
- Planned tasks (future execution)
- Task state management (IDLE, RUNNING, COMPLETED)

### 7.2 Self-Correction & High-Agency

From the solving prompt:
```
don't accept failure retry be high-agency
save useful info with memorize tool
```

### 7.3 Performance Evaluation

- Automatic solution extraction
- Memory consolidation after sessions
- Behavioral rule evolution

---

## 8. TECHNICAL IMPLEMENTATION

### 8.1 Directory Structure

```
/a0 (Docker runtime)
├── python/
│   ├── tools/           # Tool implementations
│   ├── helpers/         # Utility functions
│   ├── extensions/      # Extension hooks
│   └── api/            # API endpoints
├── prompts/            # System prompts
├── agents/             # Agent profiles
├── memory/             # VectorDB storage
├── knowledge/          # Knowledge base
├── usr/
│   ├── skills/         # Custom skills
│   ├── projects/       # Project workspaces
│   └── secrets.env     # Secrets store
└── webui/              # Web interface
```

### 8.2 Core Agent Implementation

```python
class AgentContext:
    _contexts: dict[str, "AgentContext"] = {}
    _contexts_lock = threading.RLock()
    
    def __init__(self, config, id, name, agent0, log, paused, ...):
        self.id = id or AgentContext.generate_id()
        self.config = config
        self.data = data or {}
        self.log = log or Log.Log()
        self.agent0 = agent0 or Agent(0, self.config, self)
```

### 8.3 State Management

- Thread-safe context management
- Persistent chat history (JSON)
- Deferred task handling
- WebSocket real-time infrastructure

### 8.4 Persistence Layer

- FAISS vector database for memory
- Local file storage for logs
- Project-scoped credentials
- Backup & restore functionality

---

## 9. COMPARISON: Agent Zero vs OpenClaw

### OpenClaw Mission Control
- **GitHub**: https://github.com/abhi1693/openclaw-mission-control
- **Stars**: 2,911 ⭐
- **Language**: TypeScript
- **Focus**: AI Agent Orchestration Dashboard
- **License**: MIT

### Feature Comparison

| Feature | Agent Zero | OpenClaw |
|---------|-----------|----------|
| **Architecture** | Single agent framework | Multi-agent orchestration |
| **Self-Evolution** | ✅ Behavior adjustment | ❌ Not designed for |
| **Memory System** | ✅ VectorDB + Solutions | ❌ External dependency |
| **Code Execution** | ✅ Built-in (Python/Node/Shell) | ❌ Via gateway |
| **Tool Creation** | ✅ Dynamic via code | ❌ Predefined tools |
| **Transparency** | ✅ Full prompt visibility | ⚠️ Dashboard-based |
| **Multi-Agent** | ✅ Hierarchical delegation | ✅ Orchestration focused |
| **Scheduling** | ✅ Built-in scheduler | ❌ External service |
| **Skills System** | ✅ SKILL.md standard | ❌ Not implemented |
| **UI** | ✅ Built-in Web UI | ✅ Dashboard UI |
| **Docker** | ✅ First-class support | ⚠️ Deployment option |

### What Agent Zero Has That OpenClaw Doesn't

1. **Self-Evolving Behavior**
   - Real-time behavior adjustment
   - Rules merge intelligently
   - Persistent behavior memory

2. **Organic Learning**
   - Solution memorization
   - Fragment extraction
   - Vector-based semantic memory

3. **Dynamic Tool Creation**
   - Code execution as tool creation
   - No predefined tool limitations
   - Computer as tool philosophy

4. **SKILL.md Standard**
   - Cross-platform skill compatibility
   - Semantic skill recall
   - Token-efficient loading

5. **Full Transparency**
   - All prompts visible and editable
   - Real-time intervention
   - Complete debug-ability

6. **Hierarchical Multi-Agent**
   - Superior/subordinate relationships
   - Context inheritance
   - Profile specialization

### What OpenClaw Has That Agent Zero Doesn't

1. **Orchestration Dashboard**
   - Visual agent management
   - Task assignment UI
   - Multi-agent coordination

2. **Gateway Integration**
   - External service integration
   - API-based agent control
   - Centralized management

---

## 10. AGENT0 ACADEMIC CONCEPTS

While the specific "Agent0" academic paper wasn't directly accessible, Agent Zero implements several key concepts from AI agent research:

### 10.1 Tool-Integrated Reasoning

The framework embodies tool-integrated reasoning through:
- JSON-formatted tool calls with thoughts
- Structured reasoning before tool use
- Result integration into subsequent reasoning

```json
{
    "thoughts": [
        "Need to do...",
        "I can use...",
    ],
    "tool_name": "code_execution_tool",
    "tool_args": {...}
}
```

### 10.2 Multi-Step Co-Evolution

Agent Zero demonstrates co-evolution through:
- Behavior rules evolving with use
- Solutions becoming part of memory
- Skills dynamically loaded based on context

### 10.3 Zero Data Learning

The framework achieves zero-shot capabilities through:
- Prompt-based behavior definition
- No hardcoded task-specific logic
- General-purpose assistant philosophy

### 10.4 Curriculum Agent Concept

Implicit curriculum through:
- Task decomposition (subtasks)
- Progressive problem-solving steps
- Memory-guided solution retrieval

---

## 11. LIMITATIONS & CONSIDERATIONS

### 11.1 Security Concerns

> "Agent Zero Can Be Dangerous! With proper instruction, Agent Zero is capable of many things, even potentially dangerous actions concerning your computer, data, or accounts."

**Mitigations:**
- Docker isolation recommended
- Careful instruction required
- No safety rails by design

### 11.2 Model Dependency

- Behavior quality depends on LLM capability
- Utility model needed for summarization
- Embedding model required for memory

### 11.3 Context Limitations

- Dynamic compression trades detail for context
- Long conversations may lose nuance
- Solution extraction quality varies

---

## 12. CONCLUSION

Agent Zero represents a **paradigm shift** in AI agent frameworks:

1. **Organic Growth**: Unlike static frameworks, Agent Zero grows and adapts
2. **Full Transparency**: Every aspect is visible and modifiable
3. **Computer as Tool**: Dynamic capability creation, not predefined tools
4. **Learning Architecture**: Persistent memory with solution extraction
5. **Hierarchical Intelligence**: Multi-agent cooperation built-in

**Key Takeaways for OpenClaw Integration:**

- Consider adopting SKILL.md standard for cross-platform compatibility
- Implement behavior adjustment mechanism for self-evolution
- Add persistent memory with solution memorization
- Consider hierarchical multi-agent architecture
- Prioritize transparency and debug-ability

---

## APPENDIX: Key Files Reference

| File | Purpose |
|------|---------|
| `agent.py` | Core agent implementation |
| `python/tools/code_execution_tool.py` | Code execution (Python/Node/Shell) |
| `python/tools/behaviour_adjustment.py` | Dynamic behavior modification |
| `python/tools/call_subordinate.py` | Multi-agent delegation |
| `python/tools/scheduler.py` | Task scheduling |
| `python/helpers/memory.py` | VectorDB memory system |
| `prompts/agent.system.main.md` | Central system prompt |
| `prompts/agent.system.main.solving.md` | Problem-solving logic |

---

*Report generated: 2025-01-09*  
*Research Task ID: 1-b*

---
## Task ID: 2-b - CLI Developer
### Work Task
Create NEXUS CLI interface in `/home/z/my-project/nexus/cli/` directory with all required commands, build node system, and configuration management.

### Work Summary
Successfully implemented a comprehensive NEXUS CLI interface with the following components:

**1. config.ts** - Configuration Module
- `ConfigManager` class for loading, saving, and validating configuration
- `SessionManager` class for session lifecycle management
- Environment variable support (NEXUS_HOME, NEXUS_PRIMARY_MODEL, etc.)
- Default configuration with sensible defaults
- Configuration validation and error handling

**2. build-node.ts** - Build Node System
- `SkillLoader` class for loading SKILL.md format skills (Agent Zero standard)
- `MemoryManager` class with main/fragment/solution memory types
- `ToolRegistry` class with built-in tools (code_execution, memorize, web_search, browser_action, response)
- `NodeExecutor` class for executing different node types (skill, tool, memory, agent, condition, loop, parallel)
- `PipelineBuilder` class with topological sort for dependency resolution

**3. commands.ts** - CLI Commands Implementation
- `init` - Initialize new NEXUS project with directory structure and default files
- `start` - Start NEXUS agent and create/load sessions
- `stop` - Stop agent sessions
- `status` - Display comprehensive status report
- `chat` - Interactive chat with memory integration
- `dream` - Knowledge consolidation cycle
- `forge` - Create new tools and skills
- `reflect` - Self-reflection for behavior adjustment
- `help` and `version` commands

**4. index.ts** - Main CLI Entry Point
- `NexusCLI` class with argument parsing using `parseArgs`
- Support for interactive and non-interactive modes
- Project-local config detection
- Global options support (--help, --version, --debug, --config, --session)

**Files Created:**
- `/home/z/my-project/nexus/cli/config.ts` (408 lines)
- `/home/z/my-project/nexus/cli/build-node.ts` (1060 lines)
- `/home/z/my-project/nexus/cli/commands.ts` (1074 lines)
- `/home/z/my-project/nexus/cli/index.ts` (323 lines)
- `/home/z/my-project/nexus-cli.ts` (entry point wrapper)

**Usage:**
```bash
bun run nexus-cli.ts <command> [options]
bun run nexus-cli.ts init my-project
bun run nexus-cli.ts chat
bun run nexus-cli.ts status
```

All lint checks pass. CLI tested successfully with all commands working as expected.

---
## Task ID: 2 - Web UI Developer
### Work Task
Create a complete Web UI for NEXUS AI agent with Next.js 15 + React + Tailwind CSS + shadcn/ui, including dashboard, chat interface, skills management, tools panel, memory visualization, and settings pages.

### Work Summary
Successfully implemented a comprehensive NEXUS Web UI with modern dark theme design. The implementation includes:

**1. Core Components Created:**

- **AgentChat.tsx** (320 lines) - Main chat component with:
  - Message list with auto-scrolling
  - Code block rendering with syntax highlighting
  - Tool call visualization with expandable details
  - Typing indicator animation
  - Message timestamps and user/assistant avatars
  - Send button with loading state
  - Keyboard shortcuts (Enter to send)

- **AgentStatus.tsx** (210 lines) - Status dashboard with:
  - Status indicator (idle/processing/dreaming/reflecting/learning/error)
  - Metrics cards (tasks completed, success rate, avg response time, tokens used)
  - Current task display with progress bar
  - Dream cycles and learning iterations tracking
  - Memory and tools quick stats

- **ToolPanel.tsx** (260 lines) - Tool management panel with:
  - Tool cards with enable/disable toggle
  - Category badges and usage statistics
  - Parameter display for each tool
  - Create/edit/delete tool functionality
  - Search and filter capabilities

- **MemoryPanel.tsx** (250 lines) - Memory visualization with:
  - Memory type filtering (main/fragment/solution)
  - Expandable memory cards
  - Add new memory functionality
  - Memory statistics by type
  - Search and delete capabilities

- **SkillPanel.tsx** (430 lines) - Skill browser and manager with:
  - Installed skills vs Marketplace tabs
  - Install/uninstall functionality
  - Rating and download counts
  - Tag-based categorization
  - Search and filter capabilities

**2. Main Dashboard Page (page.tsx - 400 lines):**

- Responsive sidebar navigation (collapsible on desktop, bottom nav on mobile)
- Dashboard view with AgentStatus and quick action cards
- Chat view with full AgentChat component
- Skills view with SkillPanel
- Tools view with ToolPanel
- Memory view with MemoryPanel
- Settings view with configuration display

**3. Dark Theme Design System:**

Updated `globals.css` with NEXUS design colors:
```typescript
colors: {
  primary: '#6366f1',      // Indigo
  secondary: '#8b5cf6',    // Purple  
  success: '#22c55e',      // Green
  warning: '#f59e0b',      // Amber
  error: '#ef4444',        // Red
  background: '#0f172a',   // Dark slate
  surface: '#1e293b',      // Slate
  text: '#f8fafc',         // Light
  muted: '#94a3b8',        // Gray
}
```

Added custom scrollbar styling and animations (pulse-glow, gradient-shift).

**4. API Routes Created:**

- **`/api/nexus/skills/route.ts`** - Skills CRUD operations:
  - GET: List all skills with parsing from SKILL.md files
  - POST: Create new skill or install from marketplace
  - PATCH: Update existing skill
  - DELETE: Uninstall/delete skill

- **`/api/nexus/tools/route.ts`** - Tools CRUD operations:
  - GET: List all tools from config
  - POST: Create new tool
  - PATCH: Update tool (enable/disable, edit)
  - DELETE: Remove tool

- Updated **`/api/nexus/status/route.ts`** to load persisted metrics and agent state from config files.

**5. Features Implemented:**

- Responsive design (mobile-friendly with bottom navigation)
- Accessibility (ARIA labels, keyboard navigation)
- Loading states and error handling
- Real-time status polling (5-second intervals)
- Custom animations and transitions
- Code block rendering with copy functionality

**Files Created/Modified:**
- `/home/z/my-project/src/components/nexus/AgentChat.tsx` (new)
- `/home/z/my-project/src/components/nexus/AgentStatus.tsx` (new)
- `/home/z/my-project/src/components/nexus/ToolPanel.tsx` (new)
- `/home/z/my-project/src/components/nexus/MemoryPanel.tsx` (new)
- `/home/z/my-project/src/components/nexus/SkillPanel.tsx` (new)
- `/home/z/my-project/src/app/page.tsx` (rewritten)
- `/home/z/my-project/src/app/layout.tsx` (updated for dark mode)
- `/home/z/my-project/src/app/globals.css` (updated with NEXUS theme)
- `/home/z/my-project/src/app/api/nexus/skills/route.ts` (new)
- `/home/z/my-project/src/app/api/nexus/tools/route.ts` (new)
- `/home/z/my-project/src/app/api/nexus/status/route.ts` (updated)

All lint checks pass for the new code. Dev server running successfully with all API endpoints responding.

---
## Task ID: 1 - Docker Isolation Layer Developer
### Work Task
Create a complete Docker sandbox system for NEXUS AI agent in `/home/z/my-project/nexus/` directory. Implement container lifecycle management, resource limits, code execution, volume mounting, network isolation, image building, and container stats monitoring.

### Work Summary
Successfully implemented a comprehensive Docker sandbox system with the following components:

**1. core/docker-sandbox.ts** (1053 lines) - Main DockerSandbox Class
- **Container Lifecycle Management:**
  - `createContainer(config)` - Create containers with full configuration
  - `startContainer(id)` - Start containers
  - `stopContainer(id, timeout)` - Stop containers with grace period
  - `removeContainer(id, force)` - Remove containers with volume cleanup
  - `destroyContainer(id)` - Stop and remove convenience method

- **Resource Limits:**
  - CPU limit support (e.g., 0.5 = 50% of one CPU)
  - Memory limit support (e.g., "512m", "1g")
  - Timeout handling with automatic container termination
  - Security options (no-new-privileges, capability dropping)

- **Code Execution:**
  - `execute(containerId, command, callbacks)` - Execute commands in containers
  - `executeCode(containerId, code, language)` - Execute Python/Node.js/Bash code
  - `executeInSandbox(code, language, config)` - Ephemeral container execution
  - Streaming output support via callbacks

- **Image Management:**
  - `pullImage(image)` - Pull images from registry
  - `buildImage(dockerfile, tag)` - Build images from Dockerfiles
  - `imageExists(image)` - Check local image availability
  - `removeImage(image, force)` - Remove images

- **Container Info & Stats:**
  - `getContainerStats(containerId)` - Detailed resource usage
  - `listContainers(all)` - List NEXUS-managed containers
  - `getContainerInfo(containerId)` - Container details

- **Error Handling:**
  - `DockerSandboxError` - Base error class
  - `ContainerTimeoutError` - Timeout-specific errors
  - `ContainerNotFoundError` - Missing container errors
  - `ImageNotFoundError` - Missing image errors
  - `DockerNotAvailableError` - Docker daemon unavailable

- **Event Emission:**
  - `container:created`, `container:started`, `container:stopped`, `container:removed`
  - `image:pulled`, `image:built`, `image:removed`
  - `cleanup:complete`

**2. core/__tests__/docker-sandbox.test.ts** (843 lines) - Full Test Suite
- Connection and availability tests
- Container lifecycle tests (create, start, stop, remove)
- Code execution tests (Python, Node.js, Bash)
- Image management tests
- Stats and info tests
- Error handling tests
- Event emission tests
- Configuration validation tests

**3. docker/agent-python/Dockerfile** - Python Agent Image
- Based on python:3.11-slim-bookworm
- Non-root user (nexus)
- Common packages: numpy, pandas, requests, pydantic, beautifulsoup4, scikit-learn, matplotlib
- Security-hardened configuration

**4. docker/agent-nodejs/Dockerfile** - Node.js Agent Image
- Based on node:20-bookworm-slim
- Non-root user (nexus)
- Global packages: typescript, ts-node, pnpm, yarn, axios, lodash, zod, cheerio
- Security-hardened configuration

**5. docker/agent-full/Dockerfile** - Full Agent Image
- Based on debian:bookworm-slim
- Non-root user (nexus)
- Python 3.11 + Node.js 20
- Additional tools: git, sqlite3, jq, curl, wget
- Complete development environment

**Files Created:**
- `/home/z/my-project/nexus/core/docker-sandbox.ts` (1053 lines)
- `/home/z/my-project/nexus/core/__tests__/docker-sandbox.test.ts` (843 lines)
- `/home/z/my-project/nexus/docker/agent-python/Dockerfile` (85 lines)
- `/home/z/my-project/nexus/docker/agent-nodejs/Dockerfile` (70 lines)
- `/home/z/my-project/nexus/docker/agent-full/Dockerfile` (195 lines)

**Dependencies Added:**
- `dockerode@4.0.10` - Docker API client
- `@types/dockerode@3.3.47` - TypeScript type definitions

**Usage Example:**
```typescript
import { DockerSandbox } from './core/docker-sandbox';

const sandbox = new DockerSandbox({
  defaultTimeout: 30000,
  defaultMemoryLimit: '512m',
});

// Check Docker availability
const available = await sandbox.isAvailable();

// Execute Python code in sandbox
const result = await sandbox.executeInSandbox(
  'print("Hello from Python!")',
  'python'
);

console.log(result.stdout); // "Hello from Python!"
```

All TypeScript checks pass. Implementation is production-ready with comprehensive error handling and resource management.

---
## Task ID: 3 - ClawHub Integration Developer
### Work Task
Create ClawHub API client for skill discovery and installation with caching, rate limiting, and offline support. Also implement AI-powered skill suggestion using embeddings.

### Work Summary
Successfully implemented a comprehensive ClawHub integration with the following components:

**1. core/clawhub-client.ts** (880+ lines) - ClawHub API Client
- **ClawHubSkill Interface**: Complete skill metadata (id, name, description, author, version, tags, downloads, rating, skillMdUrl)
- **SearchOptions Interface**: Comprehensive search filters (limit, offset, category, tags, author, sortBy, sortOrder, minRating, minDownloads)
- **SkillSearchResult Interface**: Paginated search results with metadata
- **InstallOptions Interface**: Installation configuration with progress callbacks
- **SkillValidation Interface**: Validation results with errors, warnings, and metadata

- **ClawHubClient Class Features:**
  - `initialize()`: Initialize client with z-ai-web-dev-sdk integration
  - `search(query, options)`: Skill search with full filter support
  - `getSkill(skillId)`: Get specific skill by ID
  - `downloadSkill(skillId)`: Download skill content
  - `installSkill(skillId, targetPath, options)`: Install skill with validation
  - `uninstallSkill(skillName)`: Remove installed skill
  - `listInstalled()`: List all installed skills
  - `listCategories()`: Get available categories
  - `getTrending(limit)`: Get trending skills
  - `getFeatured()`: Get featured skills
  - `searchByTag(tag)`: Search by tag
  - `searchByAuthor(author)`: Search by author
  - `validateSkill(content)`: Validate skill content before installation
  - `getRecommendations(context, limit)`: AI-generated recommendations

- **Caching System:**
  - Memory cache for fast access
  - File cache for persistence
  - 1 hour TTL by default
  - Cache key generation using MD5 hashing
  - Cache statistics and clearing

- **Rate Limiting:**
  - 100 requests per minute limit
  - Automatic rate limit tracking
  - RateLimitError with retry information
  - Header-based rate limit updates

- **Offline Mode Support:**
  - Toggle offline mode
  - Offline skill search through installed skills
  - Offline category listing
  - Graceful fallback from network errors

- **Error Classes:**
  - `ClawHubError`: Base error class
  - `RateLimitError`: Rate limit exceeded (429)
  - `NetworkError`: Network/timeout errors
  - `SkillNotFoundError`: Skill not found (404)
  - `SkillValidationError`: Validation failures

**2. core/skill-suggester.ts** (620+ lines) - AI-Powered Skill Suggestion
- **TaskAnalysis Interface**: Complete task analysis results (type, domain, requiredCapabilities, keywords, complexity, suggestedCategories, confidence)
- **SkillRecommendation Interface**: Ranked skill recommendation with relevance score, match reasons, capability matches
- **SuggestionContext Interface**: Full context for suggestions (task, history, installed skills, preferences)
- **UserPreferences Interface**: User customization (preferred categories, authors, min rating, exclude tags)

- **SkillSuggester Class Features:**
  - `suggest(context)`: Get skill suggestions for a task
  - `quickSuggest(query, limit)`: Fast suggestion for simple queries
  - `analyzeTask(description)`: Analyze task requirements
  - `getEmbeddingRecommendations(embedding, skills, topK)`: Embedding-based recommendations
  - `precomputeEmbeddings(skills)`: Batch embedding computation
  - `clearEmbeddingCache()`: Clear embedding cache
  - `getEmbeddingCacheStats()`: Cache statistics

- **AI Task Analysis:**
  - Uses z-ai-web-dev-sdk for intelligent task understanding
  - Domain detection (coding, writing, analysis, research, automation, etc.)
  - Capability extraction (web_search, code_execution, file_operations, etc.)
  - Complexity estimation
  - Keyword extraction for search
  - Fallback to rule-based analysis when AI unavailable

- **Ranking Algorithm:**
  - Semantic similarity (40% weight)
  - Keyword matching (25% weight)
  - Capability matching (20% weight)
  - Rating and popularity (10% weight)
  - User preferences (5% weight)
  - Boost for installed skills if prioritized

- **Embedding Management:**
  - Integration with EmbeddingsEngine
  - Skill embedding caching
  - Cosine similarity for semantic matching
  - 24-hour embedding cache TTL

**3. core/__tests__/clawhub.test.ts** (700+ lines) - Comprehensive Test Suite
- **ClawHubClient Tests:**
  - Initialization tests
  - Offline mode tests
  - Skill validation tests
  - Cache management tests
  - Error handling tests
  - Installation tests

- **SkillSuggester Tests:**
  - Initialization tests
  - Task analysis tests
  - Suggestion tests
  - Embedding cache tests
  - User preferences tests
  - Batch operations tests

- **Integration Tests:**
  - ClawHubClient + SkillSuggester integration
  - Chained operations
  - Consistent results

- **Performance Tests:**
  - Task analysis speed
  - Suggestion speed
  - Multiple requests handling

- **Edge Case Tests:**
  - Empty task description
  - Very long task description
  - Special characters
  - Unicode content
  - Zero maxSuggestions
  - High minRelevanceScore

**Files Created:**
- `/home/z/my-project/nexus/core/clawhub-client.ts` (880+ lines)
- `/home/z/my-project/nexus/core/skill-suggester.ts` (620+ lines)
- `/home/z/my-project/nexus/core/__tests__/clawhub.test.ts` (700+ lines)

**API Endpoint Configuration:**
- Default endpoint: `https://api.clawhub.io/v1`
- Configurable via ClawHubConfig
- Health check endpoint: `/health`

**Usage Example:**
```typescript
import { ClawHubClient, SkillSuggester } from './core';

// Initialize ClawHub client
const client = new ClawHubClient({
  offlineMode: false,
});
await client.initialize();

// Search for skills
const result = await client.search('code review', {
  limit: 10,
  minRating: 4.0,
});

// Install a skill
await client.installSkill('code-assistant', undefined, {
  validateBeforeInstall: true,
  onProgress: (progress) => console.log(progress.message),
});

// Get AI-powered suggestions
const suggester = new SkillSuggester(client);
await suggester.initialize();

const suggestions = await suggester.suggest({
  taskDescription: 'Write Python code to analyze sales data',
  maxSuggestions: 5,
  userPreferences: {
    minRating: 4.0,
    preferredCategories: ['coding', 'analysis'],
  },
});
```

All TypeScript types are properly exported. Implementation follows the existing NEXUS architecture patterns and integrates with the EmbeddingsEngine for semantic matching.

---
## Task ID: 2.2 - WebSocket Real-time Communication
### Work Task
Create WebSocket server and client for real-time agent communication with client connection management, agent subscription, message broadcasting, event streaming, and ping/pong heartbeat.

### Work Summary
Successfully implemented a comprehensive WebSocket real-time communication system for NEXUS with the following components:

**1. core/websocket-server.ts** (730+ lines) - NexusWebSocketServer Class
- **Type Definitions:**
  - `NexusWSMessageType`: status, chat, tool_call, memory, skill, error, heartbeat, subscribe, unsubscribe, history
  - `NexusWSMessage`: Structured message format with type, payload, timestamp, agentId, messageId
  - `WSClient`: Client connection with subscription tracking and heartbeat status
  - `NexusWSServerConfig`: Server configuration options (port, host, pingInterval, pingTimeout, maxClients, etc.)
  - `BroadcastOptions`: Broadcast targeting options

- **NexusWebSocketServer Class Features:**
  - `start()`: Start WebSocket server on configured port (default 3002)
  - `broadcast(agentId, message, options)`: Broadcast to agent subscribers
  - `broadcastToAll(message)`: Broadcast to all connected clients
  - `sendToClient(clientId, message)`: Send to specific client
  - `sendError(clientId, errorMessage, details)`: Send error messages
  - `getClients(agentId)`: Get clients subscribed to an agent
  - `getAllClients()`: Get all connected clients
  - `getStats()`: Get server statistics
  - `emitEvent(agentId, event)`: Emit NEXUS events to subscribers
  - `close()`: Graceful server shutdown

- **Connection Management:**
  - Client ID generation and tracking
  - Maximum client limit enforcement
  - Client metadata storage (IP, user agent)
  - Welcome message on connection

- **Subscription System:**
  - Subscribe to specific agents
  - Subscribe to specific event types
  - Unsubscribe from agents/events
  - Agent-to-clients mapping for efficient broadcasting

- **Heartbeat Mechanism:**
  - Configurable ping interval (default 30s)
  - Configurable ping timeout (default 60s)
  - Automatic dead client cleanup
  - Client responsiveness tracking

- **Message History:**
  - Optional message history storage
  - Configurable history limit (default 50 messages)
  - History retrieval API

- **Event Emission:**
  - `server:started`, `server:stopped`, `server:error`
  - `client:connected`, `client:disconnected`, `client:error`
  - `message:received`, `message:broadcast`, `message:broadcast:all`, `message:custom`
  - `agent:subscribed`, `agent:unsubscribed`

**2. web/hooks/useAgentWebSocket.ts** (530+ lines) - React Hook for WebSocket Client
- **Type Definitions:**
  - `UseAgentWebSocketOptions`: Hook configuration options
  - `UseAgentWebSocketReturn`: Complete hook return interface
  - `QueuedMessage`: Internal message queue structure

- **useAgentWebSocket Hook Features:**
  - Auto-connect on mount (configurable)
  - Auto-reconnection with exponential backoff
  - Message queuing when disconnected
  - Event subscriptions with type filtering
  - Proper cleanup on unmount
  - Real-time connection state tracking

- **Public Methods:**
  - `send(type, payload)`: Send message (queues when disconnected)
  - `subscribe(eventTypes)`: Subscribe to event types
  - `unsubscribe(eventTypes)`: Unsubscribe from event types
  - `subscribeAgent(agentId)`: Subscribe to another agent
  - `unsubscribeAgent(agentId)`: Unsubscribe from agent
  - `clearMessages()`: Clear message history
  - `reconnect()`: Force reconnection
  - `disconnect()`: Disconnect WebSocket
  - `connect()`: Manual connection
  - `flushQueue()`: Flush queued messages

- **Utility Hooks:**
  - `useAgentEvents(agentId, eventTypes, handler)`: Subscribe to specific events
  - `useAgentStatus(agentId, onStatusChange)`: Status updates only
  - `useAgentToolCalls(agentId, onToolCall)`: Tool call events only
  - `useAgentMemory(agentId, onMemoryUpdate)`: Memory events only

- **Auto-Reconnection:**
  - Exponential backoff (1s to 30s max)
  - Configurable max attempts (default 10)
  - Automatic reconnection state tracking

- **Message Queue:**
  - Configurable max queue size (default 100)
  - Auto-flush on reconnection
  - Retry failed messages (up to 3 attempts)

**3. web/app/api/nexus/ws/route.ts** (105 lines) - Next.js WebSocket API Route
- **GET /api/nexus/ws**: Get WebSocket connection information
  - Returns wsUrl, port, host, protocol
  - Dynamic URL construction for different environments

- **POST /api/nexus/ws**: Send message through WebSocket server
  - Accepts agentId, type, payload
  - Broadcasts to subscribers

- **DELETE /api/nexus/ws**: Disconnect a client
  - Client ID parameter required

**4. src/hooks/useNexusWebSocket.ts** (530+ lines) - Main App React Hook
- Same features as web/hooks/useAgentWebSocket.ts
- Integrates with Next.js app at `/home/z/my-project/src/hooks/`

**5. src/app/api/nexus/ws/route.ts** (95 lines) - Main App API Route
- Same features as web/app/api/nexus/ws/route.ts
- Integrates with Next.js app at `/home/z/my-project/src/app/api/nexus/ws/`

**Files Created:**
- `/home/z/my-project/nexus/core/websocket-server.ts` (730+ lines)
- `/home/z/my-project/nexus/web/hooks/useAgentWebSocket.ts` (530+ lines)
- `/home/z/my-project/nexus/web/app/api/nexus/ws/route.ts` (105 lines)
- `/home/z/my-project/src/hooks/useNexusWebSocket.ts` (530+ lines)
- `/home/z/my-project/src/app/api/nexus/ws/route.ts` (95 lines)

**Updated Files:**
- `/home/z/my-project/nexus/core/index.ts` - Added WebSocket exports

**Usage Example (Server):**
```typescript
import { NexusWebSocketServer } from './core/websocket-server';

const wsServer = new NexusWebSocketServer({
  port: 3002,
  pingInterval: 30000,
  pingTimeout: 60000,
});

await wsServer.start();

// Broadcast to agent subscribers
wsServer.broadcast('agent-001', {
  type: 'status',
  payload: { status: 'processing' },
  timestamp: new Date(),
  agentId: 'agent-001',
});

// Get server stats
const stats = wsServer.getStats();
console.log(`Connected clients: ${stats.totalClients}`);
```

**Usage Example (Client Hook):**
```typescript
import { useNexusWebSocket } from '@/hooks/useNexusWebSocket';

function AgentMonitor({ agentId }) {
  const { isConnected, messages, send, subscribe } = useNexusWebSocket({
    agentId,
    autoConnect: true,
    autoReconnect: true,
    eventTypes: ['status', 'tool_call'],
    onMessage: (msg) => console.log('Received:', msg),
  });

  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      {messages.map(msg => <div key={msg.messageId}>{msg.type}</div>)}
    </div>
  );
}
```

**Dependencies Required:**
- `ws` package and `@types/ws` for the WebSocket server (needs installation in nexus/)

All lint checks pass for the new code. Implementation uses native WebSocket API (not socket.io) as specified.

---
## Task ID: 4 - Messaging Platforms Integration Developer
### Work Task
Create WhatsApp and Telegram integration for NEXUS with support for webhook and polling modes, message queuing, rate limiting, and message formatting.

### Work Summary
Successfully implemented a comprehensive messaging platforms integration for NEXUS with the following components:

**1. messaging/types.ts** (480+ lines) - Shared Types and Interfaces
- **Core Message Types:**
  - `MessagingPlatformType`: 'whatsapp' | 'telegram' | 'web'
  - `MessageType`: text, image, audio, document, video, location, contact
  - `MessageStatus`: pending, sent, delivered, read, failed
  - `Message`: Unified message format across all platforms

- **Platform Interface:**
  - `MessagingPlatform`: Interface all platforms must implement
  - `SendOptions`: Message sending options (parseMode, replyTo, silent, metadata)
  - `FormattedMessage`: Platform-specific message formatting

- **WhatsApp Types:**
  - `WhatsAppConfig`: Business API configuration (phoneNumberId, accessToken, verifyToken, appSecret)
  - `WhatsAppWebhookEntry`, `WhatsAppWebhookChange`, `WhatsAppWebhookValue`
  - `WhatsAppMessageData`: Full message type support
  - `WhatsAppStatusData`: Message delivery status
  - `WhatsAppApiResponse`: API response structure

- **Telegram Types:**
  - `TelegramConfig`: Bot API configuration (botToken, useWebhook, webhookUrl)
  - `TelegramUpdate`: Complete update object with all message types
  - `TelegramMessage`, `TelegramUser`, `TelegramChat`
  - `TelegramInlineKeyboardMarkup`, `TelegramInlineKeyboardButton`
  - `TelegramSendOptions`: Extended send options for Telegram
  - `TelegramApiResponse`: Generic API response

- **Rate Limiting & Queuing:**
  - `RateLimitConfig`: Rate limit configuration
  - `QueuedMessage`: Message queue structure

- **Broadcast Types:**
  - `BroadcastTarget`: Platform + recipients
  - `BroadcastMessage`: Broadcast tracking
  - `BroadcastResult`: Broadcast results

- **Error Handling:**
  - `MessagingError`: Platform-specific error class
  - `MessagingErrorCode`: Error code enumeration

**2. messaging/whatsapp.ts** (800+ lines) - WhatsApp Business API Client
- **WhatsAppClient Class Features:**
  - `initialize()`: Verify credentials and start queue processor
  - `disconnect()`: Clean disconnect with cache clearing
  - `sendMessage(to, text, options)`: Send text messages with formatting
  - `sendImage(to, imageUrl, caption)`: Send image messages
  - `sendDocument(to, documentUrl, filename, caption)`: Send documents
  - `sendAudio(to, audioUrl)`: Send audio messages
  - `sendVideo(to, videoUrl, caption)`: Send video messages
  - `sendLocation(to, latitude, longitude, name, address)`: Send location
  - `sendContact(to, contacts)`: Send contact cards
  - `sendButtonMessage(to, bodyText, buttons)`: Send interactive buttons
  - `handleWebhook(body)`: Parse incoming webhooks
  - `verifyWebhook(mode, token, challenge)`: Webhook verification
  - `verifySignature(payload, signature)`: HMAC signature verification
  - `getMessageStatus(messageId)`: Get delivery status
  - `markAsRead(messageIds)`: Mark messages as read
  - `downloadMedia(mediaId)`: Download media from WhatsApp
  - `uploadMedia(mediaBuffer, filename, mimeType)`: Upload media

- **Rate Limiting:**
  - Built-in RateLimiter class
  - Configurable rate limit (default: 80 messages/second)
  - Automatic message queuing when rate limited
  - Queue processor with retry logic

- **Webhook Handling:**
  - Parse text, image, audio, document, video, location, contact messages
  - Handle message status updates (sent, delivered, read, failed)
  - Event emission for all message events

**3. messaging/telegram.ts** (950+ lines) - Telegram Bot API Client
- **TelegramClient Class Features:**
  - `initialize()`: Verify bot token and start polling/webhook
  - `disconnect()`: Stop polling, delete webhook, clean up
  - `sendMessage(to, text, options)`: Send text with HTML/Markdown support
  - `sendImage(to, imageUrl, caption)`: Send photos
  - `sendDocument(to, documentUrl, filename, caption)`: Send documents
  - `sendAudio(to, audioUrl, caption, title)`: Send audio files
  - `sendVideo(to, videoUrl, caption)`: Send videos
  - `sendVoice(to, voiceUrl, caption)`: Send voice messages
  - `sendLocation(to, latitude, longitude, title, address)`: Send location/venue
  - `sendContact(to, phoneNumber, firstName, lastName)`: Send contacts
  - `sendMessageWithKeyboard(to, text, keyboard)`: Inline keyboard support
  - `editMessage(chatId, messageId, text)`: Edit sent messages
  - `editInlineKeyboard(chatId, messageId, keyboard)`: Edit inline keyboards
  - `deleteMessage(chatId, messageId)`: Delete messages
  - `pinMessage(chatId, messageId, silent)`: Pin messages
  - `answerCallbackQuery(queryId, text, showAlert)`: Answer callback queries
  - `handleWebhook(body)`: Parse incoming webhooks
  - `getChat(chatId)`: Get chat information
  - `getChatMember(chatId, userId)`: Get member info
  - `getFileUrl(fileId)`: Get file download URL
  - `downloadFile(fileId)`: Download files
  - `getMyCommands()`, `setMyCommands()`: Bot command management

- **Polling Mode:**
  - Long polling with configurable timeout
  - Automatic update tracking (lastUpdateId)
  - Graceful stop handling

- **Webhook Mode:**
  - `setWebhook(webhookUrl)`: Set webhook URL
  - `deleteWebhook()`: Remove webhook
  - `getWebhookInfo()`: Get webhook status
  - Secret token support for verification

- **Inline Keyboard Support:**
  - `createInlineKeyboard(buttons)`: Helper function for keyboards
  - Button types: callback_data, url
  - Multi-row keyboard support

- **Group Chat Support:**
  - Chat type detection (private, group, supergroup, channel)
  - New members / left member events
  - Chat title updates

**4. messaging/manager.ts** (690+ lines) - Unified Messaging Manager
- **MessagingManager Class Features:**
  - `registerPlatform(platform, options)`: Register platforms with priority
  - `unregisterPlatform(platformType)`: Remove platforms
  - `getPlatform(platformType)`: Get specific platform
  - `getPlatforms()`: List all registered platforms
  - `setPlatformEnabled(platformType, enabled)`: Enable/disable platforms
  - `isPlatformAvailable(platformType)`: Check availability

- **Factory Methods:**
  - `createWhatsAppClient(config)`: Create and register WhatsApp client
  - `createTelegramClient(config)`: Create and register Telegram client

- **Message Sending:**
  - `sendMessage(platformType, to, text, options)`: Platform-specific send
  - `sendImage(platformType, to, imageUrl, caption)`: Send images
  - `sendDocument(platformType, to, documentUrl, filename, caption)`: Send documents
  - `sendToBestAvailable(to, text, options)`: Try platforms by priority

- **Broadcast Messaging:**
  - `broadcast(text, targets, options)`: Multi-platform broadcast
  - `getBroadcastStatus(broadcastId)`: Track broadcast status
  - Per-recipient result tracking

- **Message Handling:**
  - `onMessage(handler)`: Register message handlers
  - `handleWebhook(platformType, body)`: Platform-specific webhook handling
  - Automatic event forwarding from platforms

- **Message Formatting:**
  - `formatMessage(platformType, text, format)`: Platform-specific formatting
  - Markdown to WhatsApp format conversion
  - Telegram character escaping

- **Life Cycle:**
  - `initialize()`: Initialize all platforms
  - `disconnect()`: Disconnect all platforms
  - `getStatus()`: Get comprehensive status

- **Event Handling:**
  - `subscribe(eventType, handler)`: Subscribe to events
  - `emitEvent(event)`: Emit events

**5. messaging/index.ts** (45 lines) - Module Entry Point
- Export all types
- Export all client classes and factory functions
- Export messaging manager
- Module metadata (version, name, description)

**6. messaging/__tests__/messaging.test.ts** (750+ lines) - Comprehensive Test Suite
- **Types Tests:**
  - Message interface tests
  - Platform type tests
  - Message type tests
  - Message status tests
  - MessagingError tests

- **WhatsAppClient Tests:**
  - Constructor tests
  - Initialization tests
  - sendMessage tests
  - sendImage/sendDocument tests
  - Webhook parsing tests
  - Webhook verification tests
  - Rate limiting tests
  - Disconnect tests

- **TelegramClient Tests:**
  - Constructor tests
  - Initialization tests
  - sendMessage tests
  - HTML/Markdown formatting tests
  - Inline keyboard tests
  - Webhook parsing tests
  - Callback query tests
  - Polling tests
  - Disconnect tests

- **MessagingManager Tests:**
  - Platform registration tests
  - Platform enable/disable tests
  - Message sending tests
  - Broadcast tests
  - Message handler tests
  - Message formatting tests
  - Status tests

- **Integration Tests:**
  - End-to-end message flow
  - Rate limiting behavior

**Files Created:**
- `/home/z/my-project/nexus/messaging/types.ts` (480+ lines)
- `/home/z/my-project/nexus/messaging/whatsapp.ts` (800+ lines)
- `/home/z/my-project/nexus/messaging/telegram.ts` (950+ lines)
- `/home/z/my-project/nexus/messaging/manager.ts` (690+ lines)
- `/home/z/my-project/nexus/messaging/index.ts` (45 lines)
- `/home/z/my-project/nexus/messaging/__tests__/messaging.test.ts` (750+ lines)

**Updated Files:**
- `/home/z/my-project/nexus/package.json` - Added messaging to files array, test script, vitest dependency

**API Endpoints Used:**
- WhatsApp: `https://graph.facebook.com/v18.0/{phone-number-id}/messages`
- Telegram: `https://api.telegram.org/bot{token}/{method}`

**Usage Example:**
```typescript
import { MessagingManager } from './messaging';

// Create messaging manager
const manager = new MessagingManager({
  enableBroadcast: true,
  enableLogging: true,
});

// Create WhatsApp client
await manager.createWhatsAppClient({
  businessAccountId: 'your_business_id',
  phoneNumberId: 'your_phone_id',
  accessToken: 'your_access_token',
  verifyToken: 'your_verify_token',
});

// Create Telegram client
await manager.createTelegramClient({
  botToken: 'your_bot_token',
  useWebhook: false, // Use polling
});

// Send message
await manager.sendMessage('whatsapp', '+1234567890', 'Hello!');

// Broadcast to multiple platforms
await manager.broadcast('Hello everyone!', [
  { platform: 'whatsapp', recipients: ['+1111111111', '+2222222222'] },
  { platform: 'telegram', recipients: ['123', '456'] },
]);

// Handle incoming messages
manager.onMessage((message) => {
  console.log(`Received from ${message.platform}: ${message.content}`);
});
```

**Key Features:**
- ✅ Both webhook and polling modes supported
- ✅ Rate limit handling with automatic queuing
- ✅ Message queuing with retry logic
- ✅ Message formatting (Markdown/HTML)
- ✅ Inline keyboard support (Telegram)
- ✅ Group chat support (Telegram)
- ✅ Media handling (images, documents, audio, video)
- ✅ Location and contact sharing
- ✅ Message status tracking
- ✅ Broadcast messaging
- ✅ Platform priority management

All TypeScript checks pass. Implementation follows the existing NEXUS architecture patterns with EventEmitter-based event handling and comprehensive error management.
