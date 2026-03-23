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
  ChevronRight
} from 'lucide-react';
import { AgentChat } from '@/components/nexus/AgentChat';
import { AgentStatus } from '@/components/nexus/AgentStatus';
import { ToolPanel } from '@/components/nexus/ToolPanel';
import { MemoryPanel } from '@/components/nexus/MemoryPanel';
import { SkillPanel } from '@/components/nexus/SkillPanel';
import { PipelineBuilderUI } from '@/components/nexus/PipelineBuilder';
import { GitBranch } from 'lucide-react';

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
  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Agent Configuration</h3>
        
        <div className="space-y-4">
          <SettingRow
            label="Primary Model"
            value="Claude 3.5 Sonnet"
            description="Main LLM for reasoning and responses"
          />
          <SettingRow
            label="Utility Model"
            value="GPT-4o-mini"
            description="Model for summarization and utility tasks"
          />
          <SettingRow
            label="Dream Cycle Interval"
            value="30 minutes"
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
