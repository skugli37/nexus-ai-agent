'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot,
  Activity,
  Wrench,
  Brain,
  BookOpen,
  Settings,
  Moon,
  Sun,
  Menu,
  X,
  Sparkles,
  Zap,
  Terminal,
  ChevronRight,
  Cpu,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { AgentChat } from '@/components/nexus/AgentChat';
import { AgentStatus } from '@/components/nexus/AgentStatus';
import { ToolPanel } from '@/components/nexus/ToolPanel';
import { MemoryPanel } from '@/components/nexus/MemoryPanel';
import { SkillPanel } from '@/components/nexus/SkillPanel';
import { PipelineBuilderUI } from '@/components/nexus/PipelineBuilder';
import { GitBranch } from 'lucide-react';

// LLM Provider type
type LLMProvider = 'z-ai' | 'openai' | 'anthropic' | 'ollama' | 'custom';

// LLM Provider configurations
const LLM_PROVIDERS: Record<LLMProvider, {
  name: string;
  description: string;
  models: string[];
  requiresKey: boolean;
  envKey?: string;
}> = {
  'z-ai': {
    name: 'Z-AI (Default)',
    description: 'Built-in AI provider - always available',
    models: ['default'],
    requiresKey: false,
  },
  'openai': {
    name: 'OpenAI',
    description: 'GPT-4, GPT-4o, GPT-3.5 Turbo',
    models: ['gpt-4-turbo', 'gpt-4', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    requiresKey: true,
    envKey: 'OPENAI_API_KEY',
  },
  'anthropic': {
    name: 'Anthropic Claude',
    description: 'Claude 3 Opus, Sonnet, Haiku',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    requiresKey: true,
    envKey: 'ANTHROPIC_API_KEY',
  },
  'ollama': {
    name: 'Ollama (Local)',
    description: 'Run models locally on your machine',
    models: ['llama2', 'llama3', 'mistral', 'mixtral', 'codellama', 'deepseek-coder'],
    requiresKey: false,
  },
  'custom': {
    name: 'Custom Endpoint',
    description: 'Any OpenAI-compatible API',
    models: ['depends on endpoint'],
    requiresKey: true,
    envKey: 'CUSTOM_LLM_API_KEY',
  },
};

// Navigation items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
  { id: 'skills', label: 'Skills', icon: BookOpen },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Sidebar component
function Sidebar({ 
  activeTab, 
  setActiveTab, 
  collapsed, 
  setCollapsed 
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}) {
  return (
    <div className={cn(
      'flex flex-col h-full bg-slate-900/80 border-r border-slate-700/50 transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bot className="h-8 w-8 text-indigo-400" />
              <Sparkles className="h-4 w-4 text-purple-400 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                NEXUS
              </h1>
              <p className="text-xs text-slate-500">AI Agent</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-slate-200"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 transition-all',
                  isActive 
                    ? 'bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-400' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
                  collapsed && 'justify-center px-2'
                )}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-xs text-slate-400">System Online</span>
          </div>
          <div className="text-xs text-slate-500">
            <p>v2.0.0 - Self-Evolving</p>
            <p className="mt-1">Conscious Phase Active</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Dashboard view
function DashboardView() {
  return (
    <div className="space-y-6">
      <AgentStatus />
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickActionCard
          title="New Chat"
          description="Start a conversation"
          icon={Bot}
          color="bg-indigo-600"
        />
        <QuickActionCard
          title="Dream Cycle"
          description="Run background processing"
          icon={Moon}
          color="bg-purple-600"
        />
        <QuickActionCard
          title="Create Tool"
          description="Forge a new tool"
          icon={Wrench}
          color="bg-amber-600"
        />
        <QuickActionCard
          title="Self Reflect"
          description="Analyze performance"
          icon={Sparkles}
          color="bg-emerald-600"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-300">Recent Memories</h3>
          <MemoryPanel />
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-300">Available Tools</h3>
          <ToolPanel />
        </div>
      </div>
    </div>
  );
}

// Quick action card
function QuickActionCard({
  title,
  description,
  icon: Icon,
  color
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <button className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-all text-left group">
      <div className={cn('p-2 rounded-lg', color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <h4 className="font-medium text-slate-200 group-hover:text-indigo-400 transition-colors">
          {title}
        </h4>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </button>
  );
}

// Chat view
function ChatView() {
  return (
    <div className="h-[calc(100vh-180px)]">
      <AgentChat />
    </div>
  );
}

// Pipeline view
function PipelineView() {
  return (
    <div className="h-[calc(100vh-180px)]">
      <PipelineBuilderUI />
    </div>
  );
}

// Skills view
function SkillsView() {
  return (
    <div className="h-[calc(100vh-180px)]">
      <SkillPanel />
    </div>
  );
}

// Tools view
function ToolsView() {
  return (
    <div className="h-[calc(100vh-180px)]">
      <ToolPanel />
    </div>
  );
}

// Memory view
function MemoryView() {
  return (
    <div className="h-[calc(100vh-180px)]">
      <MemoryPanel />
    </div>
  );
}

// Settings view
function SettingsView() {
  const [selectedProvider, setSelectedProvider] = React.useState<LLMProvider>('z-ai');
  const [selectedModel, setSelectedModel] = React.useState('default');
  const [apiKey, setApiKey] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      // Call the API to save configuration
      const response = await fetch('http://localhost:3001/llm/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider }),
      });
      
      if (response.ok) {
        alert('Configuration saved!');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* LLM Provider Selection */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-600/20 rounded-lg">
            <Cpu className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">LLM Provider</h3>
            <p className="text-sm text-slate-400">Choose your AI model provider</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {(Object.keys(LLM_PROVIDERS) as LLMProvider[]).map((provider) => {
            const config = LLM_PROVIDERS[provider];
            const isSelected = selectedProvider === provider;
            
            return (
              <button
                key={provider}
                onClick={() => {
                  setSelectedProvider(provider);
                  setSelectedModel(config.models[0]);
                }}
                className={cn(
                  'flex flex-col items-start p-4 rounded-lg border transition-all text-left',
                  isSelected
                    ? 'border-indigo-500 bg-indigo-600/10'
                    : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                )}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="font-medium text-slate-200">{config.name}</span>
                  {isSelected && <Check className="h-4 w-4 text-indigo-400" />}
                </div>
                <p className="text-xs text-slate-400 mb-2">{config.description}</p>
                {config.requiresKey && (
                  <div className="flex items-center gap-1 text-xs text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>Requires API key</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Model Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {LLM_PROVIDERS[selectedProvider].models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* API Key (if needed) */}
        {LLM_PROVIDERS[selectedProvider].requiresKey && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${LLM_PROVIDERS[selectedProvider].envKey}`}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        <Button
          onClick={handleSaveConfig}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Agent Configuration</h3>
        
        <div className="space-y-4">
          <SettingRow
            label="Primary Model"
            value={LLM_PROVIDERS[selectedProvider].name}
            description="Main LLM for reasoning and responses"
          />
          <SettingRow
            label="Selected Model"
            value={selectedModel}
            description="Currently selected model variant"
          />
          <SettingRow
            label="Dream Cycle Interval"
            value="60 minutes"
            description="Time between background processing cycles"
          />
          <SettingRow
            label="Memory Limit"
            value="100 entries"
            description="Maximum number of memories to retain"
          />
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Behavior Rules</h3>
        
        <div className="space-y-3">
          <BehaviorRule
            rule="Always verify tool outputs before presenting results to the user"
            category="accuracy"
          />
          <BehaviorRule
            rule="Break complex tasks into smaller subtasks and track progress"
            category="execution"
          />
          <BehaviorRule
            rule="Save useful solutions and patterns to memory for future reference"
            category="learning"
          />
          <BehaviorRule
            rule="Be transparent about reasoning steps and tool usage"
            category="transparency"
          />
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">System Status</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCard label="API Status" status="online" />
          <StatusCard label="Memory System" status="online" />
          <StatusCard label="Tool Registry" status="online" />
          <StatusCard label="Vector Store" status="online" />
        </div>
      </div>
    </div>
  );
}

// Setting row component
function SettingRow({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
      <div>
        <p className="font-medium text-slate-200">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <Badge variant="outline" className="border-slate-600 text-slate-300">
        {value}
      </Badge>
    </div>
  );
}

// Behavior rule component
function BehaviorRule({
  rule,
  category
}: {
  rule: string;
  category: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
      <ChevronRight className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm text-slate-300">{rule}</p>
        <Badge variant="outline" className="text-xs mt-2 border-slate-600 text-slate-400">
          {category}
        </Badge>
      </div>
    </div>
  );
}

// Status card component
function StatusCard({
  label,
  status
}: {
  label: string;
  status: 'online' | 'offline' | 'degraded';
}) {
  return (
    <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg">
      <div className={cn(
        'w-2 h-2 rounded-full',
        status === 'online' && 'bg-emerald-500',
        status === 'offline' && 'bg-red-500',
        status === 'degraded' && 'bg-amber-500'
      )} />
      <span className="text-sm text-slate-300">{label}</span>
    </div>
  );
}

// Mobile navigation
function MobileNav({
  activeTab,
  setActiveTab
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-700 z-50 lg:hidden">
      <div className="flex justify-around py-2">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              className={cn(
                'flex-col gap-1 h-auto py-2',
                isActive ? 'text-indigo-400' : 'text-slate-400'
              )}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// Main page component
export default function NexusPage() {
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'chat':
        return <ChatView />;
      case 'pipeline':
        return <PipelineView />;
      case 'skills':
        return <SkillsView />;
      case 'tools':
        return <ToolsView />;
      case 'memory':
        return <MemoryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bot className="h-6 w-6 text-indigo-400" />
              <Sparkles className="h-3 w-3 text-purple-400 absolute -top-1 -right-1" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              NEXUS
            </h1>
          </div>
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            Online
          </Badge>
        </div>

        {/* Content Area */}
        <ScrollArea className="h-[calc(100vh-80px)] lg:h-screen p-4 lg:p-6 pb-24 lg:pb-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Terminal className="h-4 w-4" />
              <span className="text-sm font-mono">nexus://{activeTab}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-100">
              {navItems.find(n => n.id === activeTab)?.label || 'Dashboard'}
            </h2>
          </div>

          {/* Dynamic Content */}
          {renderContent()}
        </ScrollArea>
      </main>

      {/* Mobile Navigation */}
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
