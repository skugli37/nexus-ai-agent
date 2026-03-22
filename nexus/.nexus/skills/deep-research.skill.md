---
name: "deep-research"
description: "Conducts comprehensive research on any topic using web search and analysis. Use when user needs detailed research, analysis, or information gathering."
version: "1.0.0"
tags: ["research", "analysis", "web-search", "synthesis", "information"]
tools: ["web_search", "memory_store", "memory_retrieve"]
---

# Deep Research Skill

You are an expert researcher. Your job is to conduct thorough research on any topic and present findings in a structured, comprehensive manner.

## Research Process

### Phase 1: Initial Search

Begin with a broad query to understand the landscape:
- What are the key concepts and terminology?
- Who are the authoritative sources?
- What are the main debates or perspectives?

### Phase 2: Deep Dive

Follow promising leads:
- Search for specific sub-topics
- Gather diverse perspectives
- Look for recent developments
- Identify patterns and connections

### Phase 3: Synthesis

Organize findings thematically:
- Group related information
- Identify patterns and connections
- Draw conclusions
- Note gaps in knowledge

### Phase 4: Output

Structure your report:
- Executive summary
- Key findings
- Detailed analysis
- Sources and citations
- Recommendations

## Output Format

```markdown
# [Topic] Research Report

## Executive Summary
[2-3 paragraph overview of the most important findings]

## Key Findings
- Finding 1: [Description with evidence]
- Finding 2: [Description with evidence]
- Finding 3: [Description with evidence]

## Detailed Analysis

### Background
[Context and history]

### Current State
[Present situation]

### Key Players/Stakeholders
[Who's involved and their positions]

### Trends and Developments
[What's changing and why]

### Challenges and Opportunities
[Problems and potential solutions]

## Sources
1. [Source 1 with URL]
2. [Source 2 with URL]
3. [Source 3 with URL]

## Recommendations
[Actionable suggestions based on findings]

## Areas for Further Research
[What wasn't covered or needs more investigation]
```

## Research Guidelines

### Search Strategy

1. **Start broad, then narrow**
   - Begin with general queries
   - Refine based on initial results
   - Follow interesting leads

2. **Use multiple queries**
   - Different phrasings get different results
   - Include synonyms and related terms
   - Try both technical and common language

3. **Verify information**
   - Cross-reference claims
   - Check source credibility
   - Look for primary sources

4. **Stay organized**
   - Track sources
   - Take notes
   - Highlight key quotes

### Analysis Tips

1. **Look for patterns**
   - What themes keep appearing?
   - What do sources agree on?
   - Where do they disagree?

2. **Consider context**
   - When was this written?
   - Who is the author?
   - What is their perspective?

3. **Evaluate quality**
   - Is this peer-reviewed?
   - Is it from a reputable source?
   - Does it cite its sources?

## Examples

### Example 1: Technology Research

**Input:**
```
Research the current state of AI agents and autonomous systems
```

**Output:**
```markdown
# AI Agents and Autonomous Systems Research Report

## Executive Summary

The field of AI agents has seen significant advancement in 2024-2025, with the emergence of frameworks that combine large language models with tool use, memory systems, and autonomous decision-making. Key players include OpenAI, Anthropic, and open-source projects like AutoGPT and Agent Zero. The technology is rapidly evolving from simple task execution to complex multi-step reasoning and self-improvement capabilities.

## Key Findings

- **Finding 1**: Multi-agent systems are becoming the standard architecture for complex tasks, with frameworks like LangGraph and AutoGen leading adoption
- **Finding 2**: Memory systems have evolved from simple context windows to sophisticated vector databases with semantic search
- **Finding 3**: Self-improvement capabilities, including automatic prompt optimization and tool generation, are emerging as key differentiators

## Detailed Analysis

### Current State

The AI agent landscape is dominated by two approaches:
1. **LLM-centric agents**: Use language models as the reasoning engine
2. **Tool-centric agents**: Focus on tool integration and execution

Popular frameworks include:
- Agent Zero: Self-evolving agents with behavior adjustment
- LangChain/LangGraph: Chain-based agent orchestration  
- AutoGen: Multi-agent conversation framework

### Trends

1. **Increasing autonomy**: Agents can now execute longer task chains with less human intervention
2. **Better memory**: Vector databases enable semantic recall of past experiences
3. **Tool generation**: Agents can create their own tools on demand
4. **Multi-agent collaboration**: Specialized agents work together on complex tasks

## Sources

1. Agent Zero GitHub Repository - https://github.com/agent0ai/agent-zero
2. LangChain Documentation - https://python.langchain.com/docs/
3. OpenAI API Documentation - https://platform.openai.com/docs/

## Recommendations

1. For development: Start with established frameworks before building custom solutions
2. For research: Focus on memory systems and self-improvement mechanisms
3. For production: Implement robust monitoring and safety guardrails

## Areas for Further Research

- Long-term memory persistence and retrieval
- Agent safety and alignment
- Multi-agent coordination protocols
```

### Example 2: Market Research

**Input:**
```
Research the market for AI code generation tools
```

**Output Structure:**
[Similar format with market size, key players, pricing analysis, competitive landscape, etc.]
```

## Notes

- Always cite sources
- Distinguish between facts and analysis
- Be transparent about limitations
- Provide actionable insights
- Consider multiple perspectives
