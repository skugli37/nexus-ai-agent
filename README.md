# NEXUS - Autonomous AI Agent System

<div align="center">

![NEXUS](https://img.shields.io/badge/NEXUS-AI%20Agent-0D6EFD?style=for-the-badge)

**A revolutionary AI agent with Conscious/Subconscious architecture**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/runtime-bun-black?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-blue?logo=typescript)](https://www.typescriptlang.org/)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Architecture](#architecture)

</div>

---

## Features

### 🧠 Dual-Processing Architecture
- **Conscious Module**: Active, real-time reasoning and task execution with LLM integration
- **Subconscious Module**: Background learning, memory consolidation, pattern recognition

### 🔮 Vector-Based Semantic Memory
- Real LLM embeddings via z-ai-web-dev-sdk
- Memory types: Episodic, Semantic, Procedural, Working
- Semantic search with cosine similarity
- Automatic consolidation during dream cycles

### ⚒️ Dynamic Tool Forge
- Generates executable TypeScript/Python code
- Sandbox execution environment with timeout control
- Automatic validation and testing
- Multiple tool categories: utility, data, api, analysis, generation

### 🤖 Multi-Agent Delegation System
- Hierarchical agent structure (like Agent Zero)
- Specialized agent profiles: Coordinator, Researcher, Coder, Writer, Analyst
- Automatic task routing based on capability matching
- Parallel and sequential task execution

### 🌙 Autonomous Dream Cycles
- Automatic memory consolidation
- Pattern recognition and learning
- Self-improvement generation
- Configurable intervals

### 📦 SKILL.md Standard
- Markdown-based skill definitions (OpenClaw compatible)
- Dynamic skill loading and execution
- Input/output schema support
- Tool integration

---

## Installation

```bash
# Clone the repository
git clone https://github.com/skugli37/nexus-ai-agent.git
cd nexus-ai-agent

# Install dependencies
bun install

# Initialize a new project
bun run nexus init my-project
cd my-project
```

---

## Quick Start

```bash
# Start the NEXUS agent
bun run nexus start

# Interactive chat mode
bun run nexus chat

# View agent status
bun run nexus status

# Run a dream cycle
bun run nexus dream --deep

# Create a new tool
bun run nexus forge tool my-api-client --description "API client tool"

# Create a new skill
bun run nexus forge skill data-analyzer --description "Analyzes datasets"

# Self-reflection
bun run nexus reflect
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                              │
│            (Coordination, Health Monitoring, Events)             │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│     CONSCIOUS        │             │    SUBCONSCIOUS      │
│   (Active Tasks)     │◄───────────►│  (Background Work)   │
├─────────────────────┤             ├─────────────────────┤
│ • Input Processing  │             │ • Dream Cycles       │
│ • LLM Reasoning     │             │ • Memory Consolidate │
│ • Tool Execution    │             │ • Pattern Analysis   │
│ • Skill Execution   │             │ • Self-Improvement   │
└─────────────────────┘             └─────────────────────┘
            │                                   │
            └─────────────────┬─────────────────┘
                              ▼
                ┌─────────────────────────┐
                │      VECTOR STORE        │
                │   (Semantic Memory)      │
                │   with LLM Embeddings    │
                └─────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│     TOOL FORGE       │             │    DELEGATION        │
│  (Code Generation)   │             │   (Multi-Agent)      │
├─────────────────────┤             ├─────────────────────┤
│ • TypeScript Gen    │             │ • Coordinator        │
│ • Python Gen        │             │ • Researcher         │
│ • Sandbox Execution │             │ • Coder              │
│ • Validation        │             │ • Writer             │
└─────────────────────┘             └─────────────────────┘
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `nexus init [name]` | Initialize a new NEXUS project |
| `nexus start [session]` | Start the NEXUS agent |
| `nexus stop [session]` | Stop the agent |
| `nexus status [session]` | View agent status |
| `nexus chat [session]` | Interactive chat mode |
| `nexus dream [--deep]` | Run dream cycle |
| `nexus forge <type> <name>` | Create new tool or skill |
| `nexus reflect` | Run self-reflection |
| `nexus help` | Show help |
| `nexus version` | Show version |

### Interactive Chat Commands

```
/help      Show available commands
/memorize  Store information in memory
/recall    Retrieve from memory
/status    Show session status
/dream     Quick dream cycle
/clear     Clear conversation
/exit      End session
```

---

## Skills System

Skills are stored as `.skill.md` files in `.nexus/skills/`:

```markdown
---
name: "my-skill"
description: "What this skill does"
version: "1.0.0"
tags: ["category", "purpose"]
tools: ["tool1", "tool2"]
---

# My Skill

Detailed instructions for the skill...

## Inputs
- input1: Description (type, required)
- input2: Description (type, optional)

## Outputs
- result: Output description
```

### Built-in Skills

- **code-generator**: Generates executable TypeScript/Python code
- **deep-research**: Comprehensive web research and synthesis
- **hello**: Default greeting skill

---

## Configuration

Create `nexus.json` in your project:

```json
{
  "name": "my-nexus-project",
  "version": "1.0.0",
  "nexus": {
    "home": ".nexus",
    "model": {
      "primary": "gpt-4",
      "utility": "gpt-3.5-turbo",
      "maxTokens": 4096
    },
    "agent": {
      "defaultProfile": "default",
      "maxSubordinates": 5,
      "autonomousMode": true
    }
  }
}
```

---

## API Usage

```typescript
import { 
  Agent, 
  Orchestrator, 
  VectorStore, 
  EmbeddingsEngine,
  ToolForge,
  DelegationManager 
} from 'nexus-ai-agent';

// Create agent
const agent = new Agent({ name: 'MyAgent' });
await agent.initialize();

// Process input
const output = await agent.processInput('Hello, how are you?');
console.log(output.content);

// Store memory
agent.storeMemory('Important information', 'semantic', 0.9);

// Trigger dream cycle
await agent.triggerDreamCycle();

// Shutdown
await agent.shutdown();
```

---

## Development

```bash
# Run in development mode with hot reload
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Build for production
bun run build
```

---

## Project Structure

```
nexus/
├── core/
│   ├── agent.ts           # Main agent class
│   ├── orchestrator.ts    # Top-level controller
│   ├── conscious.ts       # Active processing
│   ├── subconscious.ts    # Background processing
│   ├── scheduler.ts       # Cron scheduling
│   ├── vector-store.ts    # Semantic memory
│   ├── embeddings.ts      # LLM embeddings
│   ├── tool-forge.ts      # Code generation
│   ├── skill-executor.ts  # Skill execution
│   ├── delegation.ts      # Multi-agent
│   ├── types.ts           # Type definitions
│   └── index.ts           # Exports
├── cli/
│   ├── index.ts           # CLI entry point
│   ├── commands.ts        # CLI commands
│   ├── config.ts          # Configuration
│   ├── build-node.ts      # Build nodes
│   └── interactive.ts     # Interactive mode
├── tools/
│   └── registry.ts        # Tool registry
├── .nexus/
│   ├── skills/            # Skill files
│   ├── memory/            # Vector storage
│   ├── sessions/          # Session data
│   └── tools/             # Generated tools
├── docs/
│   └── plans/             # Implementation plans
├── package.json
├── tsconfig.json
└── README.md
```

---

## Comparison with Similar Systems

| Feature | NEXUS | Agent Zero | OpenClaw |
|---------|-------|------------|----------|
| Language | TypeScript | Python | TypeScript |
| Dual Processing | ✅ | ✅ | ❌ |
| Vector Memory | ✅ | ✅ | ❌ |
| Tool Forge | ✅ | ✅ | ❌ |
| Multi-Agent | ✅ | ✅ | ✅ |
| Dream Cycles | ✅ | ✅ | ❌ |
| SKILL.md Standard | ✅ | ✅ | ✅ |
| CLI | ✅ | ✅ | ❌ |
| Self-Evolution | ✅ | ✅ | ❌ |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Inspired by [Agent Zero](https://github.com/agent0ai/agent-zero)
- Compatible with [OpenClaw](https://github.com/abhi1693/openclaw-mission-control) skill format
- Built with [Bun](https://bun.sh) and [TypeScript](https://www.typescriptlang.org/)

---

<div align="center">

Made with ❤️ by the NEXUS Team

**[⬆ Back to Top](#nexus---autonomous-ai-agent-system)**

</div>
