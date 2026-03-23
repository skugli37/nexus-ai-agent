/**
 * NEXUS Multi-Agent Delegation System
 * Implements hierarchical agent structure like Agent Zero
 * 
 * Features:
 * - Agent profiles for specialization
 * - Hierarchical delegation
 * - Task routing based on capability
 * - Parallel and sequential task execution
 */

import { EventEmitter } from 'events';
import ZAI from 'z-ai-web-dev-sdk';
import { Agent } from './agent';
import { 
  Task, 
  TaskOutput, 
  TaskPriority, 
  TaskStatus,
  NexusEvent,
  NexusEventType,
  NexusError
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  tools: string[];
  maxSubordinates: number;
  capabilities: string[];
  priority: number; // Lower = higher priority for task routing
}

export interface DelegationResult {
  taskId: string;
  subordinateId: string;
  output: TaskOutput;
  duration: number;
  tokensUsed: number;
  success: boolean;
  error?: string;
}

export interface SubordinateAgent {
  id: string;
  profile: AgentProfile;
  agent: Agent;
  superiorId: string | null;
  subordinates: SubordinateAgent[];
  taskHistory: Task[];
  status: 'idle' | 'busy' | 'error';
  totalTasksCompleted: number;
  totalTokensUsed: number;
  averageResponseTime: number;
}

export interface DelegationOptions {
  profileHint?: string;
  maxRetries?: number;
  timeout?: number;
  parallel?: boolean;
}

// ============================================================================
// Default Agent Profiles
// ============================================================================

const DEFAULT_PROFILES: AgentProfile[] = [
  {
    id: 'coordinator',
    name: 'Coordinator',
    role: 'Main coordinator for complex multi-step tasks',
    systemPrompt: `You are a coordinator agent. Your job is to:
1. Analyze complex tasks and break them into subtasks
2. Delegate subtasks to specialized agents
3. Synthesize results from multiple agents
4. Ensure task completion with high quality

Always think step-by-step and verify results before completing.`,
    tools: ['delegate', 'synthesize', 'plan', 'memory_store', 'memory_retrieve'],
    maxSubordinates: 5,
    capabilities: ['planning', 'coordination', 'synthesis', 'task_decomposition'],
    priority: 1
  },
  {
    id: 'researcher',
    name: 'Researcher',
    role: 'Specialized in information gathering and analysis',
    systemPrompt: `You are a research agent. Your job is to:
1. Gather comprehensive information on topics
2. Analyze and synthesize findings
3. Identify patterns and insights
4. Provide well-organized research reports

Be thorough, cite sources, and present findings clearly.`,
    tools: ['web_search', 'analyze', 'summarize', 'memory_store'],
    maxSubordinates: 2,
    capabilities: ['research', 'analysis', 'web_search', 'summarization'],
    priority: 2
  },
  {
    id: 'coder',
    name: 'Coder',
    role: 'Specialized in code generation and debugging',
    systemPrompt: `You are a coding agent. Your job is to:
1. Write clean, efficient, well-documented code
2. Debug and fix issues
3. Optimize performance
4. Follow best practices and patterns

Always include error handling and tests when appropriate.`,
    tools: ['code_execute', 'file_write', 'file_read', 'test', 'memory_store'],
    maxSubordinates: 2,
    capabilities: ['code_generation', 'debugging', 'testing', 'optimization'],
    priority: 2
  },
  {
    id: 'writer',
    name: 'Writer',
    role: 'Specialized in content creation and editing',
    systemPrompt: `You are a writing agent. Your job is to:
1. Create engaging, high-quality content
2. Edit and improve existing text
3. Adapt style and tone as needed
4. Ensure clarity and correctness

Be creative while maintaining accuracy and professionalism.`,
    tools: ['write', 'edit', 'format', 'memory_store'],
    maxSubordinates: 1,
    capabilities: ['writing', 'editing', 'formatting', 'creative_content'],
    priority: 3
  },
  {
    id: 'analyst',
    name: 'Analyst',
    role: 'Specialized in data analysis and visualization',
    systemPrompt: `You are an analyst agent. Your job is to:
1. Analyze data and identify patterns
2. Create visualizations and reports
3. Extract insights and recommendations
4. Validate findings statistically

Be data-driven and support conclusions with evidence.`,
    tools: ['analyze', 'visualize', 'calculate', 'memory_store'],
    maxSubordinates: 2,
    capabilities: ['data_analysis', 'visualization', 'statistics', 'reporting'],
    priority: 2
  }
];

// ============================================================================
// Delegation Manager
// ============================================================================

export class DelegationManager extends EventEmitter {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private agents: Map<string, SubordinateAgent> = new Map();
  private rootAgent: SubordinateAgent | null = null;
  private agentCounter: number = 0;
  private profiles: Map<string, AgentProfile> = new Map();
  private initialized: boolean = false;

  constructor() {
    super();
    this.initializeProfiles();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.zai = await ZAI.create();
    this.initialized = true;
  }

  /**
   * Initialize default agent profiles
   */
  private initializeProfiles(): void {
    for (const profile of DEFAULT_PROFILES) {
      this.profiles.set(profile.id, profile);
    }
  }

  /**
   * Register a custom agent profile
   */
  registerProfile(profile: AgentProfile): void {
    this.profiles.set(profile.id, profile);
    this.emit('profile:registered', { profileId: profile.id });
  }

  /**
   * Get all available profiles
   */
  getProfiles(): AgentProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Create a new subordinate agent
   */
  async createSubordinate(
    profileId: string,
    superiorId: string | null = null
  ): Promise<SubordinateAgent> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new NexusError('AGENT_NOT_INITIALIZED', `Profile ${profileId} not found`);
    }

    this.agentCounter++;
    const agentId = `agent-${profile.id}-${this.agentCounter}`;

    const agent = new Agent({
      id: agentId,
      name: `${profile.name}-${this.agentCounter}`,
      autoStartDreamCycles: false
    });

    await agent.initialize();

    const subordinate: SubordinateAgent = {
      id: agentId,
      profile,
      agent,
      superiorId,
      subordinates: [],
      taskHistory: [],
      status: 'idle',
      totalTasksCompleted: 0,
      totalTokensUsed: 0,
      averageResponseTime: 0
    };

    this.agents.set(agentId, subordinate);

    // Link to superior
    if (superiorId) {
      const superior = this.agents.get(superiorId);
      if (superior && superior.subordinates.length < superior.profile.maxSubordinates) {
        superior.subordinates.push(subordinate);
      }
    } else if (!this.rootAgent) {
      this.rootAgent = subordinate;
    }

    this.emit('agent:created', { agentId, profileId, superiorId });

    return subordinate;
  }

  /**
   * Delegate a task to a subordinate
   */
  async delegateTask(
    task: Task,
    fromAgentId: string,
    options: DelegationOptions = {}
  ): Promise<DelegationResult> {
    const fromAgent = this.agents.get(fromAgentId);
    if (!fromAgent) {
      throw new NexusError('AGENT_NOT_INITIALIZED', `Agent ${fromAgentId} not found`);
    }

    // Determine best profile for task
    const targetProfileId = options.profileHint || await this.selectBestProfile(task);

    // Find or create subordinate
    let subordinate = fromAgent.subordinates.find(
      s => s.profile.id === targetProfileId && s.status === 'idle'
    );

    if (!subordinate && fromAgent.subordinates.length < fromAgent.profile.maxSubordinates) {
      subordinate = await this.createSubordinate(targetProfileId, fromAgentId);
    }

    if (!subordinate) {
      throw new NexusError('TASK_EXECUTION_FAILED', 'No available subordinate for delegation');
    }

    subordinate.status = 'busy';
    const startTime = Date.now();

    try {
      // Execute task with timeout
      const timeout = options.timeout || 60000;
      const output = await this.executeWithTimeout(
        subordinate.agent.processInput(task.input.content),
        timeout
      );

      subordinate.status = 'idle';
      subordinate.taskHistory.push(task);
      subordinate.totalTasksCompleted++;
      subordinate.totalTokensUsed += output.tokensUsed;
      subordinate.averageResponseTime = 
        (subordinate.averageResponseTime * (subordinate.totalTasksCompleted - 1) + (Date.now() - startTime)) 
        / subordinate.totalTasksCompleted;

      const result: DelegationResult = {
        taskId: task.id,
        subordinateId: subordinate.id,
        output,
        duration: Date.now() - startTime,
        tokensUsed: output.tokensUsed,
        success: true
      };

      this.emit('delegation:complete', result);

      return result;
    } catch (error) {
      subordinate.status = 'error';
      
      const result: DelegationResult = {
        taskId: task.id,
        subordinateId: subordinate.id,
        output: {
          content: '',
          tokensUsed: 0,
          confidence: 0
        },
        duration: Date.now() - startTime,
        tokensUsed: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      this.emit('delegation:failed', result);
      
      // Retry logic
      if ((options.maxRetries || 0) > 0) {
        return this.delegateTask(task, fromAgentId, {
          ...options,
          maxRetries: (options.maxRetries || 1) - 1
        });
      }

      throw error;
    }
  }

  /**
   * Delegate multiple tasks in parallel
   */
  async delegateParallel(
    tasks: Task[],
    fromAgentId: string,
    options: DelegationOptions = {}
  ): Promise<DelegationResult[]> {
    const promises = tasks.map(task => 
      this.delegateTask(task, fromAgentId, options)
    );
    
    return Promise.all(promises);
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Select the best profile for a task
   */
  private async selectBestProfile(task: Task): Promise<string> {
    if (!this.zai) {
      return 'coordinator';
    }

    const taskDescription = task.input.content;
    const profileDescriptions = Array.from(this.profiles.values())
      .map(p => `${p.id}: ${p.role} (${p.capabilities.join(', ')})`)
      .join('\n');

    try {
      const response = await this.zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `Select the best agent profile for this task. Respond with only the profile ID (one word).

Available profiles:
${profileDescriptions}`
          },
          { role: 'user', content: taskDescription }
        ],
        max_tokens: 20,
        temperature: 0
      });

      const selectedProfile = response.choices[0]?.message?.content?.trim().toLowerCase() || 'coordinator';
      
      // Validate
      if (this.profiles.has(selectedProfile)) {
        return selectedProfile;
      }
    } catch {
      // Fallback to keyword matching
    }

    // Fallback: keyword matching
    return this.matchByKeywords(taskDescription);
  }

  /**
   * Match task to profile by keywords
   */
  private matchByKeywords(taskDescription: string): string {
    const lower = taskDescription.toLowerCase();
    
    const keywordMap: Record<string, string[]> = {
      coder: ['code', 'function', 'debug', 'implement', 'script', 'program', 'api', 'bug', 'fix'],
      researcher: ['research', 'find', 'search', 'gather', 'information', 'analyze', 'investigate'],
      writer: ['write', 'document', 'article', 'content', 'blog', 'edit', 'draft', 'text'],
      analyst: ['analyze', 'data', 'statistics', 'chart', 'report', 'metrics', 'visualization'],
      coordinator: ['coordinate', 'plan', 'organize', 'manage', 'delegate', 'oversee']
    };

    let bestMatch = 'coordinator';
    let bestScore = 0;

    for (const [profileId, keywords] of Object.entries(keywordMap)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = profileId;
      }
    }

    return bestMatch;
  }

  /**
   * Get agent hierarchy
   */
  getHierarchy(): string {
    if (!this.rootAgent) return 'No agents created';
    return this.buildHierarchyString(this.rootAgent, 0);
  }

  private buildHierarchyString(agent: SubordinateAgent, depth: number): string {
    const indent = '  '.repeat(depth);
    const statusEmoji = agent.status === 'idle' ? '🟢' : agent.status === 'busy' ? '🟡' : '🔴';
    let result = `${indent}${statusEmoji} ${agent.profile.name} (${agent.id})\n`;
    result += `${indent}   Tasks: ${agent.totalTasksCompleted} | Tokens: ${agent.totalTokensUsed}\n`;
    
    for (const sub of agent.subordinates) {
      result += this.buildHierarchyString(sub, depth + 1);
    }
    
    return result;
  }

  /**
   * Get all agents
   */
  getAgents(): SubordinateAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): SubordinateAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalAgents: number;
    idleAgents: number;
    busyAgents: number;
    errorAgents: number;
    totalTasksCompleted: number;
    totalTokensUsed: number;
  } {
    const agents = Array.from(this.agents.values());
    
    return {
      totalAgents: agents.length,
      idleAgents: agents.filter(a => a.status === 'idle').length,
      busyAgents: agents.filter(a => a.status === 'busy').length,
      errorAgents: agents.filter(a => a.status === 'error').length,
      totalTasksCompleted: agents.reduce((sum, a) => sum + a.totalTasksCompleted, 0),
      totalTokensUsed: agents.reduce((sum, a) => sum + a.totalTokensUsed, 0)
    };
  }

  /**
   * Shutdown all agents
   */
  async shutdown(): Promise<void> {
    for (const agent of this.agents.values()) {
      try {
        await agent.agent.shutdown();
      } catch (error) {
        console.error(`Failed to shutdown agent ${agent.id}:`, error);
      }
    }
    this.agents.clear();
    this.rootAgent = null;
    this.initialized = false;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

export default DelegationManager;
