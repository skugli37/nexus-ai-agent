# 🧠 NEXUS - Intelligent AI Agent Framework

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Runtime-Bun-black)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)](https://www.typescriptlang.org/)

> **NEXUS** is an autonomous AI agent framework with conscious/subconscious processing, inspired by [OpenClaw](https://github.com/nicklalone/OpenClaw) and [Agent Zero](https://github.com/frdel/agent-zero).

## ✨ Features

### 🧠 Dual-Processing Architecture
- **Conscious Module** - Active, real-time processing with LLM reasoning and tool calling
- **Subconscious Module** - Background dream cycles, memory consolidation, pattern recognition

### 🔧 Build Node System (OpenClaw-style)
- **SkillLoader** - Load skills from `.skill.md` markdown files
- **MemoryManager** - Persistent memory with semantic search
- **ToolRegistry** - Extensible tool system
- **PipelineBuilder** - Build execution pipelines with dependencies

### 🌙 Dream Cycle (Agent Zero-style)
1. Memory Scan - Find unprocessed memories
2. Consolidation - Merge similar memories
3. Pattern Analysis - Discover behavioral patterns
4. Learning - Extract lessons from experiences
5. Self-Improvement - Generate behavior adjustments
6. Cleanup - Remove old/irrelevant data

### ⏰ Scheduler
- Cron-based task scheduling
- Priority queue management
- Automatic dream cycles
- Self-reflection sessions

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Show help
bun run nexus --help

# Start the agent
bun run nexus start

# Interactive chat
bun run nexus chat

# View status
bun run nexus status

# Run dream cycle
bun run nexus dream --deep

# Create new skill
bun run nexus forge skill my-skill

# Self-reflection
bun run nexus reflect
```

## 📁 Project Structure

```
nexus/
├── core/
│   ├── agent.ts          # Main agent class (687 lines)
│   ├── orchestrator.ts   # Top-level controller (857 lines)
│   ├── conscious.ts      # Active processing (621 lines)
│   ├── subconscious.ts   # Background processing (886 lines)
│   ├── scheduler.ts      # Cron scheduling (762 lines)
│   └── types.ts          # TypeScript types (478 lines)
├── cli/
│   ├── index.ts          # CLI entry point
│   ├── commands.ts       # All commands (1075 lines)
│   ├── config.ts         # Configuration manager
│   └── build-node.ts     # Build node system (1061 lines)
.nexus/
├── skills/               # .skill.md files
├── memory/               # Persistent memory
├── sessions/             # Session data
├── tools/                # Custom tools
└── logs/                 # Runtime logs
```

## 🛠️ CLI Commands

| Command | Description |
|---------|-------------|
| `nexus init [name]` | Initialize a new NEXUS project |
| `nexus start` | Start the NEXUS agent |
| `nexus stop` | Stop the agent |
| `nexus status` | Show agent status |
| `nexus chat` | Interactive chat mode |
| `nexus dream` | Run dream cycle |
| `nexus forge <type> <name>` | Create new tool/skill |
| `nexus reflect` | Run self-reflection |

## 📝 Skills

Skills are defined in markdown files with YAML front matter:

```markdown
---
name: "my-skill"
description: "Description of the skill"
version: "1.0.0"
tags: ["category", "tag"]
---

# My Skill

Instructions for the skill...

## Inputs
- input1: Description

## Outputs
- result: Description
```

## 🔌 Built-in Tools

- `code_execution` - Execute Python, Node.js, or Shell code
- `memorize` - Store information in memory
- `web_search` - Search the web for information
- `browser_action` - Navigate and interact with web pages
- `response` - Send response to user

## ⚙️ Configuration

Environment variables:

```bash
NEXUS_HOME            # Home directory (default: ~/.nexus)
NEXUS_PRIMARY_MODEL   # Primary LLM model
NEXUS_UTILITY_MODEL   # Utility model for summarization
NEXUS_MAX_TOKENS      # Maximum response tokens
NEXUS_TEMPERATURE     # Response temperature
NEXUS_DEBUG           # Enable debug mode
```

## 🧪 API Usage

```typescript
import { createNexusAgent } from './nexus/core';

// Create and initialize agent
const nexus = await createNexusAgent({
  agent: {
    autoStartDreamCycles: true,
    dreamCycleInterval: 5 * 60 * 1000
  }
});

// Process input
const output = await nexus.processInput('Hello, NEXUS!');
console.log(output.content);

// Get metrics
const metrics = nexus.getMetrics();
console.log(metrics);
```

## 📊 Stats

- **Total Lines**: 7200+
- **Core Modules**: 6
- **CLI Commands**: 8
- **Built-in Tools**: 5

## 🤝 Inspired By

- [OpenClaw](https://github.com/nicklalone/OpenClaw) - Skills system, build nodes
- [Agent Zero](https://github.com/frdel/agent-zero) - Self-evolution, tool creation

## 📜 License

MIT License - feel free to use and modify!

---

Built with ❤️ using TypeScript, Bun, and z-ai-web-dev-sdk
