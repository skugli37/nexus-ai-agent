/**
 * NEXUS Core Engine - Conscious Module
 * 
 * The Conscious module handles active, real-time processing:
 * - User input processing
 * - LLM-based reasoning
 * - Task execution
 * - Real-time interaction
 * - Tool calling
 * 
 * This module operates in the "conscious" phase where the agent is
 * actively engaged with the user and executing tasks.
 */

import { EventEmitter } from 'events';
import ZAI from 'z-ai-web-dev-sdk';
import {
  AgentStatus,
  Task,
  TaskInput,
  TaskOutput,
  TaskType,
  TaskPriority,
  ConversationContext,
  Message,
  MessageRole,
  ToolCall,
  ToolResult,
  ToolDefinition,
  LLMConfig,
  LLMResponse,
  IConscious,
  NexusEvent,
  NexusEventType,
  NexusError,
  MemoryContext,
} from './types';

// ============================================================================
// CONSCIOUS MODULE CONFIGURATION
// ============================================================================

export interface ConsciousConfig {
  maxRetries: number;
  timeoutMs: number;
  defaultModel: string;
  systemPrompt: string;
  tools: ToolDefinition[];
}

const DEFAULT_CONFIG: ConsciousConfig = {
  maxRetries: 3,
  timeoutMs: 60000,
  defaultModel: 'gpt-4',
  systemPrompt: `You are NEXUS, an advanced AI agent with conscious and subconscious capabilities.
You process user inputs thoughtfully, reason through problems step by step, and execute tasks efficiently.
You have access to various tools and can learn from your experiences.
Always be helpful, accurate, and transparent in your reasoning.`,
  tools: [],
};

// ============================================================================
// CONSCIOUS MODULE IMPLEMENTATION
// ============================================================================

export class Conscious extends EventEmitter implements IConscious {
  private status: AgentStatus = 'idle';
  private config: ConsciousConfig;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private currentTask: Task | null = null;
  private context: ConversationContext | null = null;
  private memoryContext: MemoryContext | null = null;
  private toolRegistry: Map<string, ToolDefinition> = new Map();

  constructor(config: Partial<ConsciousConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registerDefaultTools();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the conscious module with z-ai-web-dev-sdk
   */
  async initialize(): Promise<void> {
    try {
      this.zai = await ZAI.create();
      this.emitEvent('agent:started', { module: 'conscious' });
      this.status = 'idle';
    } catch (error) {
      this.status = 'error';
      throw new NexusError(
        'AGENT_NOT_INITIALIZED',
        'Failed to initialize conscious module',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  // ==========================================================================
  // INPUT PROCESSING
  // ==========================================================================

  /**
   * Process user input through the conscious reasoning pipeline
   */
  async process(input: string, context?: ConversationContext): Promise<TaskOutput> {
    if (!this.zai) {
      throw new NexusError('AGENT_NOT_INITIALIZED', 'Conscious module not initialized');
    }

    const startTime = Date.now();
    this.status = 'processing';
    this.emitEvent('conscious:input_received', { input: input.slice(0, 100) });

    try {
      // Create or update conversation context
      this.context = context || this.createContext();
      this.addMessage('user', input);

      // Build the message array for LLM
      const messages = this.buildMessages();

      this.emitEvent('conscious:reasoning_started', { messageCount: messages.length });

      // Call LLM for reasoning
      const response = await this.callLLM(messages);

      // Process tool calls if any
      let finalContent = response.content;
      const toolsUsed: string[] = [];

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          this.emitEvent('conscious:tool_call', { toolName: toolCall.name });
          const result = await this.executeTool(toolCall);
          toolsUsed.push(toolCall.name);
          
          // Feed tool result back to LLM if needed
          if (result && !result.isError) {
            // Continue reasoning with tool result
            this.addMessage('tool', JSON.stringify(result.output), {
              toolCalls: [toolCall]
            });
          }
        }
      }

      // Add assistant response to context
      this.addMessage('assistant', finalContent, {
        reasoning: response.reasoning,
        tokens: response.usage.totalTokens
      });

      this.status = 'idle';
      this.emitEvent('conscious:reasoning_completed', {
        tokensUsed: response.usage.totalTokens,
        duration: Date.now() - startTime
      });

      return {
        content: finalContent,
        reasoning: response.reasoning,
        toolsUsed,
        tokensUsed: response.usage.totalTokens,
        confidence: this.calculateConfidence(response)
      };
    } catch (error) {
      this.status = 'error';
      this.emitEvent('agent:error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new NexusError(
        'TASK_EXECUTION_FAILED',
        'Failed to process input',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  // ==========================================================================
  // LLM INTERACTION
  // ==========================================================================

  /**
   * Call the LLM with the prepared messages
   */
  private async callLLM(messages: Array<{role: string; content: string}>): Promise<LLMResponse> {
    if (!this.zai) {
      throw new NexusError('AGENT_NOT_INITIALIZED', 'LLM client not initialized');
    }

    try {
      // Cast messages to proper SDK type (filter out 'tool' role as SDK doesn't support it)
      const typedMessages = messages
        .filter(m => m.role !== 'tool')
        .map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content
        }));
      
      const completion = await this.zai.chat.completions.create({
        messages: [
          { role: 'system' as const, content: this.config.systemPrompt },
          ...typedMessages
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });

      const messageContent = completion.choices[0]?.message?.content || '';
      
      // Extract reasoning if present (could be in special format)
      const reasoning = this.extractReasoning(messageContent);

      return {
        content: messageContent,
        reasoning,
        toolCalls: [], // Tool calls would be extracted from response if supported
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        }
      };
    } catch (error) {
      throw new NexusError(
        'LLM_ERROR',
        'LLM call failed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Extract reasoning steps from LLM response
   */
  private extractReasoning(content: string): string | undefined {
    // Look for reasoning patterns in the content
    const reasoningMatch = content.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
    if (reasoningMatch) {
      return reasoningMatch[1].trim();
    }
    return undefined;
  }

  // ==========================================================================
  // TOOL EXECUTION
  // ==========================================================================

  /**
   * Execute a tool call
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    this.emitEvent('conscious:tool_call', {
      toolName: toolCall.name,
      arguments: toolCall.arguments
    });

    try {
      // Get tool from registry
      const tool = this.toolRegistry.get(toolCall.name);
      if (!tool) {
        return {
          toolCallId: toolCall.id,
          output: { error: `Tool '${toolCall.name}' not found` },
          isError: true
        };
      }

      // Execute tool based on type
      let result: unknown;
      
      switch (toolCall.name) {
        case 'memory_store':
          result = await this.handleMemoryStore(toolCall.arguments);
          break;
        case 'memory_retrieve':
          result = await this.handleMemoryRetrieve(toolCall.arguments);
          break;
        case 'web_search':
          result = await this.handleWebSearch(toolCall.arguments);
          break;
        case 'code_execute':
          result = await this.handleCodeExecute(toolCall.arguments);
          break;
        default:
          result = { message: `Tool ${toolCall.name} executed with args`, args: toolCall.arguments };
      }

      this.emitEvent('conscious:tool_result', {
        toolName: toolCall.name,
        success: true
      });

      return {
        toolCallId: toolCall.id,
        output: result,
        isError: false
      };
    } catch (error) {
      this.emitEvent('conscious:tool_result', {
        toolName: toolCall.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        toolCallId: toolCall.id,
        output: { error: error instanceof Error ? error.message : 'Tool execution failed' },
        isError: true
      };
    }
  }

  // ==========================================================================
  // TOOL HANDLERS
  // ==========================================================================

  private async handleMemoryStore(args: Record<string, unknown>): Promise<unknown> {
    // Store memory in context
    const memory = {
      content: args.content as string,
      type: args.type || 'episodic',
      timestamp: new Date()
    };
    
    // This would integrate with the memory system
    return { stored: true, memory };
  }

  private async handleMemoryRetrieve(args: Record<string, unknown>): Promise<unknown> {
    // Retrieve memories based on query
    const query = args.query as string;
    
    // This would integrate with the memory system
    return { query, memories: [] };
  }

  private async handleWebSearch(args: Record<string, unknown>): Promise<unknown> {
    if (!this.zai) {
      throw new NexusError('AGENT_NOT_INITIALIZED', 'LLM client not initialized');
    }

    const query = args.query as string;
    const num = (args.num as number) || 5;

    try {
      const searchResult = await this.zai.functions.invoke('web_search', {
        query,
        num
      });

      return {
        query,
        results: searchResult
      };
    } catch (error) {
      throw new NexusError(
        'TOOL_ERROR',
        'Web search failed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  private async handleCodeExecute(args: Record<string, unknown>): Promise<unknown> {
    const code = args.code as string;
    const language = (args.language as string || 'javascript').toLowerCase();
    const inputs = (args.inputs as Record<string, unknown>) || {};

    // Only support JavaScript/TypeScript for sandbox execution
    if (language !== 'javascript' && language !== 'typescript' && language !== 'js' && language !== 'ts') {
      // For Python and other languages, use LLM to interpret
      if (this.zai && language === 'python') {
        const completion = await this.zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are a Python interpreter. Execute the given Python code and return the output. Be precise and only return the actual output.'
            },
            { role: 'user', content: `Execute this Python code:\n\`\`\`python\n${code}\n\`\`\`\n\nInputs: ${JSON.stringify(inputs)}` }
          ],
          temperature: 0,
          max_tokens: 2000
        });
        
        return {
          executed: true,
          language,
          output: completion.choices[0]?.message?.content,
          method: 'llm_interpretation'
        };
      }
      
      return {
        executed: false,
        error: `Language '${language}' not supported. Use JavaScript/TypeScript for sandbox execution.`,
        language
      };
    }

    // Dynamic import of sandbox (to avoid circular dependencies)
    const { CodeSandbox } = await import('./sandbox');
    const sandbox = new CodeSandbox({ timeout: 30000, allowFetch: true });

    // Validate code for security
    const validation = sandbox.validateCode(code);
    if (!validation.valid) {
      return {
        executed: false,
        error: 'Code validation failed',
        issues: validation.issues,
        language
      };
    }

    // Execute in sandbox
    const result = await sandbox.execute(code, inputs);

    return {
      executed: result.success,
      language,
      output: result.output,
      error: result.error,
      logs: result.logs,
      duration: result.duration
    };
  }

  // ==========================================================================
  // CONTEXT MANAGEMENT
  // ==========================================================================

  /**
   * Create a new conversation context
   */
  private createContext(): ConversationContext {
    return {
      id: crypto.randomUUID(),
      messages: [],
      totalTokens: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Add a message to the conversation context
   */
  private addMessage(role: MessageRole, content: string, metadata?: Record<string, unknown>): void {
    if (!this.context) return;

    const message: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    this.context.messages.push(message);
    this.context.updatedAt = new Date();
  }

  /**
   * Build messages array for LLM call
   */
  private buildMessages(): Array<{role: string; content: string}> {
    if (!this.context) return [];

    return this.context.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // ==========================================================================
  // TOOL REGISTRY
  // ==========================================================================

  /**
   * Register default tools
   */
  private registerDefaultTools(): void {
    const defaultTools: ToolDefinition[] = [
      {
        name: 'memory_store',
        description: 'Store information in memory for later retrieval',
        parameters: [
          { name: 'content', type: 'string', description: 'Content to store' },
          { name: 'type', type: 'string', description: 'Type of memory (episodic, semantic, procedural)' }
        ],
        required: ['content']
      },
      {
        name: 'memory_retrieve',
        description: 'Retrieve memories based on a query',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query for memories' },
          { name: 'limit', type: 'number', description: 'Maximum number of results' }
        ],
        required: ['query']
      },
      {
        name: 'web_search',
        description: 'Search the web for information',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query' },
          { name: 'num', type: 'number', description: 'Number of results to return' }
        ],
        required: ['query']
      },
      {
        name: 'code_execute',
        description: 'Execute code in a sandboxed environment',
        parameters: [
          { name: 'code', type: 'string', description: 'Code to execute' },
          { name: 'language', type: 'string', description: 'Programming language' }
        ],
        required: ['code']
      }
    ];

    for (const tool of defaultTools) {
      this.toolRegistry.set(tool.name, tool);
    }
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: ToolDefinition): void {
    this.toolRegistry.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): void {
    this.toolRegistry.delete(toolName);
  }

  /**
   * Get all registered tools
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.toolRegistry.values());
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Calculate confidence score for response
   */
  private calculateConfidence(response: LLMResponse): number {
    let confidence = 0.8; // Base confidence

    // Adjust based on response length
    if (response.content.length < 50) {
      confidence -= 0.1;
    }

    // Adjust based on tool usage
    if (response.toolCalls && response.toolCalls.length > 0) {
      confidence += 0.1;
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Set memory context for enhanced reasoning
   */
  setMemoryContext(context: MemoryContext): void {
    this.memoryContext = context;
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get current context
   */
  getContext(): ConversationContext | null {
    return this.context;
  }

  /**
   * Reset the conversation context
   */
  resetContext(): void {
    this.context = null;
    this.status = 'idle';
  }

  // ==========================================================================
  // EVENT EMISSION
  // ==========================================================================

  /**
   * Emit a NEXUS event
   */
  private emitEvent(type: NexusEventType, data: Record<string, unknown>): void {
    const event: NexusEvent = {
      type,
      timestamp: new Date(),
      data,
      source: 'conscious'
    };
    this.emit('nexus:event', event);
  }

  // ==========================================================================
  // TASK EXECUTION
  // ==========================================================================

  /**
   * Execute a specific task
   */
  async executeTask(task: Task): Promise<TaskOutput> {
    this.currentTask = task;
    
    try {
      const output = await this.process(task.input.content, task.input.context);
      return output;
    } finally {
      this.currentTask = null;
    }
  }

  /**
   * Process a reasoning task
   */
  async reason(problem: string, context?: string): Promise<TaskOutput> {
    const reasoningPrompt = context 
      ? `Context: ${context}\n\nProblem: ${problem}`
      : problem;

    return this.process(reasoningPrompt);
  }

  /**
   * Quick response without full context
   */
  async quickResponse(input: string): Promise<string> {
    if (!this.zai) {
      throw new NexusError('AGENT_NOT_INITIALIZED', 'Conscious module not initialized');
    }

    const completion = await this.zai.chat.completions.create({
      messages: [
        { role: 'system', content: this.config.systemPrompt },
        { role: 'user', content: input }
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    return completion.choices[0]?.message?.content || '';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Conscious;
