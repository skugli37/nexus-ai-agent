/**
 * NEXUS Core Engine
 * Main entry point for all core components
 */

// Core Engine Components
export { Agent } from './agent';

export { Orchestrator } from './orchestrator';
export type { HealthStatus, ComponentHealth, PerformanceMetrics } from './orchestrator';

export { Conscious } from './conscious';
export type { ConsciousConfig } from './conscious';

export { Subconscious } from './subconscious';
export type { SubconsciousConfig } from './subconscious';

export { Scheduler } from './scheduler';
export type { SchedulerConfig } from './scheduler';

// Memory & Embeddings
export { VectorStore } from './vector-store';
export type { VectorStoreConfig, VectorSearchResult } from './vector-store';

export { EmbeddingsEngine } from './embeddings';
export type { EmbeddingResult, TextFeatures } from './embeddings';

// Tool & Skill Systems
export { ToolForge } from './tool-forge';
export type { 
  ToolSpec, 
  GeneratedTool, 
  ForgeResult, 
  ToolParameter as ForgeToolParameter 
} from './tool-forge';

export { SkillExecutor } from './skill-executor';
export type { 
  SkillDefinition, 
  SkillContext, 
  SkillResult, 
  ExecutableSkill,
  SkillInput,
  SkillOutput
} from './skill-executor';

// Multi-Agent Delegation
export { DelegationManager } from './delegation';
export type { 
  AgentProfile, 
  DelegationResult, 
  SubordinateAgent,
  DelegationOptions
} from './delegation';

// Code Execution
export { CodeSandbox, codeSandbox } from './sandbox';
export type { ExecutionResult, ExecutionOptions } from './sandbox';

// Types
export * from './types';

// Version
export const NEXUS_VERSION = '1.0.0';
export const NEXUS_NAME = 'NEXUS';
export const NEXUS_DESCRIPTION = 'Autonomous AI Agent with Conscious/Subconscious Architecture';
