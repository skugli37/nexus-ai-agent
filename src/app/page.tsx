'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Brain, 
  Sparkles, 
  MessageSquare, 
  Database, 
  Settings, 
  Zap,
  Moon,
  Sun,
  Activity,
  Clock,
  Cpu,
  HardDrive,
  Terminal,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Bot,
  User,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface AgentState {
  status: 'idle' | 'processing' | 'dreaming' | 'reflecting' | 'error'
  phase: 'conscious' | 'subconscious'
  sessionId: string | null
  lastActivity: string
}

interface Memory {
  id: string
  type: 'episodic' | 'semantic' | 'procedural' | 'working'
  content: string
  importance: number
  createdAt: string
}

interface Skill {
  name: string
  description: string
  version: string
  tags: string[]
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

interface DreamCycle {
  id: string
  phase: string
  memoriesProcessed: number
  patternsDiscovered: number
  improvementsGenerated: number
  startedAt: string
}

// ============================================================================
// Main Component
// ============================================================================

export default function NexusDashboard() {
  // State
  const [agentState, setAgentState] = useState<AgentState>({
    status: 'idle',
    phase: 'conscious',
    sessionId: null,
    lastActivity: new Date().toISOString()
  })
  
  const [memories, setMemories] = useState<Memory[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const [dreamCycle, setDreamCycle] = useState<DreamCycle | null>(null)
  
  // Stats
  const [stats, setStats] = useState({
    tasksCompleted: 0,
    tasksFailed: 0,
    averageResponseTime: 0,
    totalTokensUsed: 0,
    dreamCyclesCompleted: 0,
    learningIterations: 0
  })

  // Fetch agent status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/nexus/status')
      if (response.ok) {
        const data = await response.json()
        setAgentState(data.state || agentState)
        setStats(data.metrics || stats)
        setMemories(data.memories || [])
        setSkills(data.skills || [])
      }
    } catch (error) {
      console.error('Failed to fetch status:', error)
    }
  }, [agentState, stats])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Send message
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)
    setAgentState(prev => ({ ...prev, status: 'processing' }))

    try {
      const response = await fetch('/api/nexus/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputMessage })
      })

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || 'I processed your request.',
        timestamp: new Date().toISOString()
      }
      
      setMessages(prev => [...prev, assistantMessage])
      setStats(prev => ({
        ...prev,
        tasksCompleted: prev.tasksCompleted + 1,
        totalTokensUsed: prev.totalTokensUsed + (data.tokensUsed || 0)
      }))
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Error: Failed to process message',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
      setStats(prev => ({ ...prev, tasksFailed: prev.tasksFailed + 1 }))
    } finally {
      setIsLoading(false)
      setAgentState(prev => ({ ...prev, status: 'idle' }))
    }
  }

  // Trigger dream cycle
  const triggerDreamCycle = async () => {
    setAgentState(prev => ({ ...prev, status: 'dreaming', phase: 'subconscious' }))
    setDreamCycle({
      id: crypto.randomUUID(),
      phase: 'init',
      memoriesProcessed: 0,
      patternsDiscovered: 0,
      improvementsGenerated: 0,
      startedAt: new Date().toISOString()
    })

    try {
      await fetch('/api/nexus/dream', { method: 'POST' })
      setStats(prev => ({
        ...prev,
        dreamCyclesCompleted: prev.dreamCyclesCompleted + 1
      }))
    } catch (error) {
      console.error('Dream cycle failed:', error)
    } finally {
      setAgentState(prev => ({ ...prev, status: 'idle', phase: 'conscious' }))
      setDreamCycle(null)
    }
  }

  // Clear memory
  const clearMemory = async () => {
    await fetch('/api/nexus/memory', { method: 'DELETE' })
    setMemories([])
  }

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-green-500'
      case 'processing': return 'bg-blue-500'
      case 'dreaming': return 'bg-purple-500'
      case 'reflecting': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain className="w-10 h-10 text-purple-500" />
              <Sparkles className="w-5 h-5 text-yellow-400 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                NEXUS
              </h1>
              <p className="text-xs text-gray-400">Intelligent Agent Framework</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(agentState.status)} animate-pulse`} />
              {agentState.status.toUpperCase()}
            </Badge>
            <Badge variant="secondary">
              {agentState.phase === 'conscious' ? <Sun className="w-3 h-3 mr-1" /> : <Moon className="w-3 h-3 mr-1" />}
              {agentState.phase}
            </Badge>
            <Button 
              size="sm" 
              variant="outline"
              onClick={triggerDreamCycle}
              disabled={agentState.status !== 'idle'}
            >
              <Moon className="w-4 h-4 mr-2" />
              Dream
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Stats */}
          <div className="lg:col-span-1 space-y-4">
            {/* Agent Status Card */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-400" />
                  Agent Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Tasks Completed</span>
                  <span className="font-mono">{stats.tasksCompleted}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Tasks Failed</span>
                  <span className="font-mono text-red-400">{stats.tasksFailed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Dream Cycles</span>
                  <span className="font-mono text-purple-400">{stats.dreamCyclesCompleted}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Tokens Used</span>
                  <span className="font-mono">{stats.totalTokensUsed.toLocaleString()}</span>
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Avg Response</span>
                  <span className="font-mono">{stats.averageResponseTime.toFixed(0)}ms</span>
                </div>
              </CardContent>
            </Card>

            {/* Memory Stats */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  Memory
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Entries</span>
                  <span className="font-mono">{memories.length}</span>
                </div>
                <div className="space-y-1">
                  {['episodic', 'semantic', 'procedural', 'working'].map(type => (
                    <div key={type} className="flex justify-between text-xs">
                      <span className="text-gray-500 capitalize">{type}</span>
                      <span className="font-mono">{memories.filter(m => m.type === type).length}</span>
                    </div>
                  ))}
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="w-full text-red-400 hover:text-red-300"
                  onClick={clearMemory}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Clear Memory
                </Button>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Skills ({skills.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  {skills.map(skill => (
                    <div key={skill.name} className="py-1 text-xs">
                      <span className="font-medium">{skill.name}</span>
                      <p className="text-gray-500 truncate">{skill.description}</p>
                    </div>
                  ))}
                  {skills.length === 0 && (
                    <p className="text-gray-500 text-xs">No skills loaded</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 bg-gray-800/50">
                <TabsTrigger value="chat" className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="memory" className="gap-2">
                  <Database className="w-4 h-4" />
                  Memory
                </TabsTrigger>
                <TabsTrigger value="skills" className="gap-2">
                  <Zap className="w-4 h-4" />
                  Skills
                </TabsTrigger>
                <TabsTrigger value="terminal" className="gap-2">
                  <Terminal className="w-4 h-4" />
                  CLI
                </TabsTrigger>
              </TabsList>

              {/* Chat Tab */}
              <TabsContent value="chat" className="mt-4">
                <Card className="bg-gray-800/50 border-gray-700 h-[600px] flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-purple-400" />
                      NEXUS Chat
                    </CardTitle>
                    <CardDescription>
                      Interact with your intelligent agent
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ScrollArea className="flex-1 pr-4">
                      {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                          <Brain className="w-16 h-16 mb-4 opacity-20" />
                          <p>Start a conversation with NEXUS</p>
                          <p className="text-sm">Try: "Hello, what can you do?"</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages.map(msg => (
                            <div 
                              key={msg.id} 
                              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                                  <Bot className="w-4 h-4" />
                                </div>
                              )}
                              <div 
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                  msg.role === 'user' 
                                    ? 'bg-blue-600 text-white' 
                                    : msg.role === 'system'
                                    ? 'bg-red-900/50 text-red-200'
                                    : 'bg-gray-700 text-white'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <span className="text-xs opacity-50 mt-1 block">
                                  {new Date(msg.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                  <User className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          ))}
                          {isLoading && (
                            <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </div>
                              <div className="bg-gray-700 rounded-lg px-4 py-2">
                                <p className="text-sm text-gray-400">Thinking...</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                    
                    <div className="flex gap-2 mt-4">
                      <Input
                        value={inputMessage}
                        onChange={e => setInputMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        className="bg-gray-700 border-gray-600"
                        disabled={isLoading}
                      />
                      <Button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Memory Tab */}
              <TabsContent value="memory" className="mt-4">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-400" />
                      Memory Store
                    </CardTitle>
                    <CardDescription>
                      View and manage agent memories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      {memories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                          <HardDrive className="w-16 h-16 mb-4 opacity-20" />
                          <p>No memories stored yet</p>
                          <p className="text-sm">Chat with NEXUS to create memories</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {memories.map(memory => (
                            <div 
                              key={memory.id} 
                              className="p-3 rounded-lg bg-gray-700/50 border border-gray-600"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {memory.type}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  {new Date(memory.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-300">{memory.content}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-500">Importance:</span>
                                <Progress value={memory.importance * 100} className="h-1 flex-1" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Skills Tab */}
              <TabsContent value="skills" className="mt-4">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      Skills Registry
                    </CardTitle>
                    <CardDescription>
                      Available skills and capabilities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {skills.map(skill => (
                          <div 
                            key={skill.name} 
                            className="p-4 rounded-lg bg-gray-700/50 border border-gray-600 hover:border-purple-500/50 transition-colors"
                          >
                            <h3 className="font-medium mb-1">{skill.name}</h3>
                            <p className="text-sm text-gray-400 mb-3">{skill.description}</p>
                            <div className="flex gap-2 flex-wrap">
                              {skill.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <div className="text-xs text-gray-500 mt-2">v{skill.version}</div>
                          </div>
                        ))}
                        {skills.length === 0 && (
                          <div className="col-span-2 flex flex-col items-center justify-center h-64 text-gray-500">
                            <Zap className="w-16 h-16 mb-4 opacity-20" />
                            <p>No skills loaded</p>
                            <p className="text-sm">Add skills to .nexus/skills/ directory</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CLI Tab */}
              <TabsContent value="terminal" className="mt-4">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-green-400" />
                      NEXUS CLI
                    </CardTitle>
                    <CardDescription>
                      Command-line interface for NEXUS
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-black rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
                      <pre className="whitespace-pre-wrap">{`
╔══════════════════════════════════════════════════════════════╗
║   ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗              ║
║   ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝              ║
║   ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗              ║
║   ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║              ║
║   ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║              ║
║   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝              ║
║                                                              ║
║   Intelligent AI Agent Framework                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

USAGE
  nexus <command> [options]

COMMANDS
  init        Initialize a new NEXUS project
  start       Start the NEXUS agent
  stop        Stop the agent
  status      View agent status
  chat        Interactive chat mode
  dream       Run dream cycle
  forge       Create new tools/skills
  reflect     Run self-reflection

EXAMPLES
  # Initialize a new project
  $ bun run nexus-cli.ts init my-project

  # Start interactive chat
  $ bun run nexus-cli.ts chat

  # Run dream cycle for consolidation
  $ bun run nexus-cli.ts dream --deep

  # Create a new skill
  $ bun run nexus-cli.ts forge skill data-processor

  # Self-reflection
  $ bun run nexus-cli.ts reflect

`}</pre>
                    </div>
                    
                    <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Cpu className="w-4 h-4" />
                        Quick Actions
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <Button size="sm" variant="outline" className="w-full">
                          <RefreshCw className="w-3 h-3 mr-2" />
                          Status
                        </Button>
                        <Button size="sm" variant="outline" className="w-full" onClick={triggerDreamCycle}>
                          <Moon className="w-3 h-3 mr-2" />
                          Dream
                        </Button>
                        <Button size="sm" variant="outline" className="w-full">
                          <Plus className="w-3 h-3 mr-2" />
                          New Skill
                        </Button>
                        <Button size="sm" variant="outline" className="w-full">
                          <Settings className="w-3 h-3 mr-2" />
                          Settings
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {/* Dream Cycle Overlay */}
      {dreamCycle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="bg-gray-800 border-purple-500/50 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <Moon className="w-5 h-5 animate-pulse" />
                Dream Cycle Active
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="capitalize">{dreamCycle.phase.replace('_', ' ')}</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Memories Processed</span>
                  <span>{dreamCycle.memoriesProcessed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Patterns Discovered</span>
                  <span>{dreamCycle.patternsDiscovered}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Improvements</span>
                  <span>{dreamCycle.improvementsGenerated}</span>
                </div>
              </div>
              
              <Progress value={50} className="h-2" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
