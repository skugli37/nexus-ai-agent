'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Brain,
  Cpu,
  HardDrive,
  Wrench,
  Clock,
  Zap,
  Target,
  CheckCircle2,
  XCircle,
  Loader2,
  Pause,
  Moon,
  Eye,
  TrendingUp
} from 'lucide-react';

// Types
interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  dreamCyclesCompleted: number;
  learningIterations: number;
}

interface AgentState {
  status: 'idle' | 'processing' | 'dreaming' | 'reflecting' | 'learning' | 'error';
  phase: 'conscious' | 'subconscious';
  sessionId: string | null;
  lastActivity: string;
}

interface CurrentTask {
  id: string;
  type: string;
  description: string;
  progress: number;
  startedAt: string;
}

// Status indicator component
function StatusIndicator({ status }: { status: AgentState['status'] }) {
  const config = {
    idle: { icon: Pause, color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Idle' },
    processing: { icon: Loader2, color: 'text-indigo-400', bg: 'bg-indigo-500/20', label: 'Processing', animate: true },
    dreaming: { icon: Moon, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Dreaming' },
    reflecting: { icon: Eye, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Reflecting' },
    learning: { icon: Brain, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Learning' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Error' }
  };

  const { icon: Icon, color, bg, label, animate } = config[status];

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', bg)}>
      <Icon className={cn('h-5 w-5', color, animate && 'animate-spin')} />
      <span className={cn('font-medium', color)}>{label}</span>
    </div>
  );
}

// Metric card component
function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  trend 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  color: string;
  trend?: number;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">{title}</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
            {trend !== undefined && (
              <div className={cn(
                'flex items-center gap-1 text-xs mt-1',
                trend >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                <TrendingUp className={cn('h-3 w-3', trend < 0 && 'rotate-180')} />
                <span>{Math.abs(trend)}%</span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-lg', color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Current task display
function CurrentTaskCard({ task }: { task: CurrentTask | null }) {
  if (!task) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-slate-400">
            <Pause className="h-5 w-5" />
            <span className="text-sm">No active task</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const duration = Date.now() - new Date(task.startedAt).getTime();
  const seconds = Math.floor(duration / 1000);

  return (
    <Card className="bg-slate-800/50 border-slate-700 border-indigo-500/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-medium text-slate-200">{task.description}</span>
          </div>
          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
            {task.type}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-2 bg-slate-700" />
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          <span>Running for {seconds}s</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Main AgentStatus component
export function AgentStatus() {
  const [state, setState] = React.useState<AgentState>({
    status: 'idle',
    phase: 'conscious',
    sessionId: null,
    lastActivity: new Date().toISOString()
  });
  const [metrics, setMetrics] = React.useState<AgentMetrics>({
    tasksCompleted: 0,
    tasksFailed: 0,
    averageResponseTime: 0,
    totalTokensUsed: 0,
    dreamCyclesCompleted: 0,
    learningIterations: 0
  });
  const [currentTask, setCurrentTask] = React.useState<CurrentTask | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Fetch status data
  const fetchStatus = React.useCallback(async () => {
    try {
      const response = await fetch('/api/nexus/status');
      if (response.ok) {
        const data = await response.json();
        setState(data.state);
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const successRate = metrics.tasksCompleted + metrics.tasksFailed > 0
    ? Math.round((metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed)) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-400" />
              Agent Status
            </CardTitle>
            <StatusIndicator status={state.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={cn(
                  'border-slate-600',
                  state.phase === 'conscious' ? 'text-indigo-400' : 'text-purple-400'
                )}
              >
                {state.phase === 'conscious' ? 'Conscious' : 'Subconscious'}
              </Badge>
            </div>
            <div className="text-right text-xs text-slate-500">
              Last activity: {new Date(state.lastActivity).toLocaleTimeString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Tasks Completed"
          value={metrics.tasksCompleted}
          icon={CheckCircle2}
          color="bg-emerald-600"
        />
        <MetricCard
          title="Success Rate"
          value={`${successRate}%`}
          icon={Target}
          color="bg-indigo-600"
        />
        <MetricCard
          title="Avg Response"
          value={`${Math.round(metrics.averageResponseTime)}ms`}
          icon={Zap}
          color="bg-amber-600"
        />
        <MetricCard
          title="Tokens Used"
          value={metrics.totalTokensUsed.toLocaleString()}
          icon={Cpu}
          color="bg-purple-600"
        />
      </div>

      {/* Learning Stats */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          title="Dream Cycles"
          value={metrics.dreamCyclesCompleted}
          icon={Moon}
          color="bg-purple-600"
        />
        <MetricCard
          title="Learning Iterations"
          value={metrics.learningIterations}
          icon={Brain}
          color="bg-emerald-600"
        />
      </div>

      {/* Current Task */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">Current Task</h3>
        <CurrentTaskCard task={currentTask} />
      </div>

      {/* Memory & Tools Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <HardDrive className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Memory Usage</p>
                <p className="text-lg font-bold text-slate-100">128 MB</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-600 rounded-lg">
                <Wrench className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Tools Available</p>
                <p className="text-lg font-bold text-slate-100">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AgentStatus;
