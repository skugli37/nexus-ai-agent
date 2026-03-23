'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Wrench,
  Plus,
  Search,
  Play,
  Settings,
  Code,
  Terminal,
  Globe,
  Database,
  FileCode,
  Trash2,
  Edit,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';

// Types
interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  enabled: boolean;
  lastUsed?: string;
  usageCount: number;
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
}

// Tool icons mapping
const toolIcons: Record<string, React.ElementType> = {
  code_execution: Code,
  browser_action: Globe,
  memorize: Database,
  web_search: Globe,
  response: Terminal,
  default: Wrench
};

// Tool category colors
const categoryColors: Record<string, string> = {
  execution: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  memory: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  web: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  system: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  default: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
};

// Tool card component
function ToolCard({ tool, onToggle, onEdit, onDelete }: { 
  tool: Tool;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (tool: Tool) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = toolIcons[tool.name] || toolIcons.default;
  const categoryColor = categoryColors[tool.category] || categoryColors.default;

  return (
    <Card className={cn(
      'bg-slate-800/50 border-slate-700 transition-all hover:border-slate-600',
      !tool.enabled && 'opacity-60'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn('p-2 rounded-lg', categoryColor.split(' ')[0])}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-slate-200">{tool.name}</h4>
                <Badge variant="outline" className={cn('text-xs', categoryColor)}>
                  {tool.category}
                </Badge>
              </div>
              <p className="text-sm text-slate-400 mt-1">{tool.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span>Used {tool.usageCount} times</span>
                {tool.lastUsed && (
                  <span>Last: {new Date(tool.lastUsed).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-200"
              onClick={() => onToggle(tool.id, !tool.enabled)}
            >
              {tool.enabled ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-200"
              onClick={() => onEdit(tool)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-red-400"
              onClick={() => onDelete(tool.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {tool.parameters.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <p className="text-xs text-slate-400 mb-2">Parameters:</p>
            <div className="flex flex-wrap gap-2">
              {tool.parameters.map((param) => (
                <Badge key={param.name} variant="outline" className="text-xs border-slate-600 text-slate-400">
                  {param.name}
                  {param.required && <span className="text-red-400 ml-1">*</span>}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Default tools data
const defaultTools: Tool[] = [
  {
    id: 'code_execution',
    name: 'code_execution',
    description: 'Execute Python, JavaScript, or shell commands in a sandboxed environment',
    category: 'execution',
    parameters: [
      { name: 'code', type: 'string', description: 'Code to execute', required: true },
      { name: 'runtime', type: 'string', description: 'Runtime to use', required: true }
    ],
    enabled: true,
    usageCount: 127
  },
  {
    id: 'memorize',
    name: 'memorize',
    description: 'Store and retrieve information from persistent memory',
    category: 'memory',
    parameters: [
      { name: 'content', type: 'string', description: 'Content to store', required: true },
      { name: 'area', type: 'string', description: 'Memory area', required: false }
    ],
    enabled: true,
    usageCount: 89
  },
  {
    id: 'web_search',
    name: 'web_search',
    description: 'Search the web for information',
    category: 'web',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true }
    ],
    enabled: true,
    usageCount: 45
  },
  {
    id: 'browser_action',
    name: 'browser_action',
    description: 'Control a headless browser for web automation',
    category: 'web',
    parameters: [
      { name: 'action', type: 'string', description: 'Action to perform', required: true },
      { name: 'url', type: 'string', description: 'URL to navigate', required: false }
    ],
    enabled: true,
    usageCount: 23
  },
  {
    id: 'response',
    name: 'response',
    description: 'Send a response to the user',
    category: 'system',
    parameters: [
      { name: 'message', type: 'string', description: 'Response message', required: true }
    ],
    enabled: true,
    usageCount: 312
  }
];

// Main ToolPanel component
export function ToolPanel() {
  const [tools, setTools] = React.useState<Tool[]>(defaultTools);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingTool, setEditingTool] = React.useState<Tool | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Filter tools by search
  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch tools from API
  const fetchTools = React.useCallback(async () => {
    try {
      const response = await fetch('/api/nexus/tools');
      if (response.ok) {
        const data = await response.json();
        if (data.tools && data.tools.length > 0) {
          setTools(data.tools);
        }
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    }
  }, []);

  React.useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const handleToggle = async (id: string, enabled: boolean) => {
    setTools(prev => prev.map(t => t.id === id ? { ...t, enabled } : t));
    try {
      await fetch('/api/nexus/tools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled })
      });
    } catch (error) {
      console.error('Failed to toggle tool:', error);
    }
  };

  const handleEdit = (tool: Tool) => {
    setEditingTool(tool);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setTools(prev => prev.filter(t => t.id !== id));
    try {
      await fetch('/api/nexus/tools', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (error) {
      console.error('Failed to delete tool:', error);
    }
  };

  const handleCreateTool = async (tool: Partial<Tool>) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/nexus/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tool)
      });
      if (response.ok) {
        const newTool = await response.json();
        setTools(prev => [...prev, newTool]);
        setIsDialogOpen(false);
        setEditingTool(null);
      }
    } catch (error) {
      console.error('Failed to create tool:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-purple-400" />
            Tools
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                className="bg-indigo-600 hover:bg-indigo-500"
                onClick={() => setEditingTool(null)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Tool
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-slate-100">
                  {editingTool ? 'Edit Tool' : 'Create New Tool'}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Define a new tool for NEXUS to use
                </DialogDescription>
              </DialogHeader>
              <ToolForm 
                tool={editingTool} 
                onSubmit={handleCreateTool}
                isLoading={isLoading}
              />
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="pl-9 bg-slate-800 border-slate-600 text-slate-200"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6 pb-6">
          <div className="space-y-3">
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
            {filteredTools.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No tools found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Tool form component for create/edit
function ToolForm({ tool, onSubmit, isLoading }: {
  tool: Tool | null;
  onSubmit: (tool: Partial<Tool>) => void;
  isLoading: boolean;
}) {
  const [name, setName] = React.useState(tool?.name || '');
  const [description, setDescription] = React.useState(tool?.description || '');
  const [category, setCategory] = React.useState(tool?.category || 'default');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...tool,
      name,
      description,
      category,
      parameters: [],
      enabled: true,
      usageCount: 0
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="tool_name"
          className="bg-slate-800 border-slate-600 text-slate-200"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this tool do?"
          className="bg-slate-800 border-slate-600 text-slate-200"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-9 rounded-md bg-slate-800 border border-slate-600 text-slate-200 px-3"
        >
          <option value="execution">Execution</option>
          <option value="memory">Memory</option>
          <option value="web">Web</option>
          <option value="system">System</option>
          <option value="default">Other</option>
        </select>
      </div>
      <DialogFooter>
        <Button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {tool ? 'Update Tool' : 'Create Tool'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default ToolPanel;
