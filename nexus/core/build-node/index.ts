/**
 * NEXUS Build Node System
 * 
 * Pipeline-based skill execution inspired by OpenClaw's BUILD.md system
 * 
 * @module core/build-node
 */

// Types
export * from './types';

// Base classes
export { NodeExecutor } from './executor';

// Executors
export { SkillNodeExecutor } from './executors/skill-executor';
export { ToolNodeExecutor, type ToolHandler } from './executors/tool-executor';
export { ConditionNodeExecutor } from './executors/condition-executor';
export { CodeNodeExecutor } from './executors/code-executor';
export { HTTPNodeExecutor } from './executors/http-executor';
export { TransformNodeExecutor } from './executors/transform-executor';

// Pipeline
export { PipelineBuilder } from './pipeline-builder';
export { PipelineExecutor, type ExecutorConfig } from './pipeline-executor';

// Convenience imports
import { PipelineBuilder } from './pipeline-builder';
import { PipelineExecutor } from './pipeline-executor';

/**
 * Create a new pipeline builder
 */
export function createPipeline(name?: string): PipelineBuilder {
  const builder = new PipelineBuilder();
  if (name) {
    builder.setName(name);
  }
  return builder;
}

/**
 * Create a pipeline executor
 */
export function createExecutor(config?: Partial<ExecutorConfig>): PipelineExecutor {
  return new PipelineExecutor(config);
}

// Default instances
export const defaultExecutor = new PipelineExecutor();
