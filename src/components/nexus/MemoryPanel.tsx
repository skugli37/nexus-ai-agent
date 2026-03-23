'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain,
  Search,
  Database,
  Sparkles,
  Clock,
  Hash,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Eye,
  Lightbulb,
  FileText,
  Zap
} from 'lucide-react';

// Types
interface Memory {
  id: string;
  content: string;
  type: 'main' | 'fragment' | 'solution';
  timestamp: string;
  importance?: number;
  tags?: string[];
}

interface MemoryStats {
  total: number;
  byType: Record<string, number>;
}

// Memory type colors
const memoryTypeColors: Record<string, string> = {
  main: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  fragment: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  solution: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
};

// Memory type icons
const memoryTypeIcons: Record<string, React.ElementType> = {
  main: Database,
  fragment: FileText,
  solution: Lightbulb
};

// Memory card component
function MemoryCard({ memory, onDelete }: { 
  memory: Memory;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const Icon = memoryTypeIcons[memory.type] || Database;
  const typeColor = memoryTypeColors[memory.type] || memoryTypeColors.fragment;

  const truncatedContent = memory.content.length > 150 
    ? memory.content.slice(0, 150) + '...' 
    : memory.content;

  return (
    <Card className="bg-slate-800/50 border-slate-700 transition-all hover:border-slate-600">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn('p-2 rounded-lg', typeColor.split(' ')[0])}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={cn('text-xs', typeColor)}>
                  {memory.type}
                </Badge>
                <span className="text-xs text-slate-500">
                  {new Date(memory.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-slate-300">
                {expanded ? memory.content : truncatedContent}
              </p>
              {memory.content.length > 150 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 mt-1 text-xs text-indigo-400 hover:text-indigo-300"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </Button>
              )}
              {memory.tags && memory.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {memory.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs border-slate-600 text-slate-400">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-red-400 shrink-0"
            onClick={() => onDelete(memory.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Stats card
function StatsCard({ title, value, icon: Icon, color }: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="bg-slate-800/30 border-slate-700">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', color)}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-400">{title}</p>
            <p className="text-lg font-bold text-slate-100">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main MemoryPanel component
export function MemoryPanel() {
  const [memories, setMemories] = React.useState<Memory[]>([]);
  const [stats, setStats] = React.useState<MemoryStats>({ total: 0, byType: {} });
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddingMemory, setIsAddingMemory] = React.useState(false);
  const [newMemoryContent, setNewMemoryContent] = React.useState('');
  const [newMemoryType, setNewMemoryType] = React.useState<'main' | 'fragment' | 'solution'>('fragment');

  // Fetch memories
  const fetchMemories = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/nexus/status');
      if (response.ok) {
        const data = await response.json();
        setMemories(data.memories || []);
        setStats(data.memoryStats || { total: 0, byType: {} });
      }
    } catch (error) {
      console.error('Failed to fetch memories:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Filter memories
  const filteredMemories = memories.filter(memory => {
    const matchesSearch = memory.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || memory.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleDelete = async (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
    try {
      await fetch('/api/nexus/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const handleAddMemory = async () => {
    if (!newMemoryContent.trim()) return;

    try {
      const response = await fetch('/api/nexus/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMemoryContent,
          type: newMemoryType
        })
      });

      if (response.ok) {
        const newMemory = await response.json();
        setMemories(prev => [...prev, newMemory]);
        setNewMemoryContent('');
        setIsAddingMemory(false);
      }
    } catch (error) {
      console.error('Failed to add memory:', error);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            Memory
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-200"
              onClick={fetchMemories}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500"
              onClick={() => setIsAddingMemory(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Memory
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <StatsCard
            title="Total"
            value={stats.total}
            icon={Database}
            color="bg-slate-600"
          />
          <StatsCard
            title="Main"
            value={stats.byType['main'] || 0}
            icon={Database}
            color="bg-indigo-600"
          />
          <StatsCard
            title="Fragments"
            value={stats.byType['fragment'] || 0}
            icon={FileText}
            color="bg-amber-600"
          />
          <StatsCard
            title="Solutions"
            value={stats.byType['solution'] || 0}
            icon={Lightbulb}
            color="bg-emerald-600"
          />
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="pl-9 bg-slate-800 border-slate-600 text-slate-200"
            />
          </div>
          <div className="flex gap-1">
            {['main', 'fragment', 'solution'].map((type) => (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-9',
                  filterType === type 
                    ? 'bg-indigo-600 hover:bg-indigo-500'
                    : 'border-slate-600 text-slate-400 hover:text-slate-200'
                )}
                onClick={() => setFilterType(filterType === type ? null : type)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Add Memory Dialog */}
        {isAddingMemory && (
          <div className="px-6 pb-4 border-b border-slate-700">
            <div className="space-y-3">
              <textarea
                value={newMemoryContent}
                onChange={(e) => setNewMemoryContent(e.target.value)}
                placeholder="Enter memory content..."
                className="w-full h-20 rounded-md bg-slate-800 border border-slate-600 text-slate-200 p-3 resize-none"
              />
              <div className="flex items-center justify-between">
                <select
                  value={newMemoryType}
                  onChange={(e) => setNewMemoryType(e.target.value as 'main' | 'fragment' | 'solution')}
                  className="h-9 rounded-md bg-slate-800 border border-slate-600 text-slate-200 px-3"
                >
                  <option value="fragment">Fragment</option>
                  <option value="main">Main</option>
                  <option value="solution">Solution</option>
                </select>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-400"
                    onClick={() => setIsAddingMemory(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-500"
                    onClick={handleAddMemory}
                  >
                    Save Memory
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="h-[350px] px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMemories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  onDelete={handleDelete}
                />
              ))}
              {filteredMemories.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No memories found</p>
                  <p className="text-xs mt-1">Add a new memory to get started</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default MemoryPanel;
