'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch,
  Play,
  Save,
  Plus,
  Trash2,
  Settings,
  Zap,
  Code,
  Globe,
  Database,
  GitMerge,
  Move,
  ChevronRight,
  GripVertical,
  X
} from 'lucide-react';

// Node types
interface PipelineNode {
  id: string;
  type: 'skill' | 'tool' | 'condition' | 'parallel' | 'code' | 'http' | 'transform';
  name: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

interface NodeConnection {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePort: string;
  targetPort: string;
}

// Node type configurations
const nodeTypes = {
  skill: { icon: Zap, color: 'bg-amber-500', label: 'Skill' },
  tool: { icon: Settings, color: 'bg-blue-500', label: 'Tool' },
  condition: { icon: GitBranch, color: 'bg-purple-500', label: 'Condition' },
  parallel: { icon: GitMerge, color: 'bg-green-500', label: 'Parallel' },
  code: { icon: Code, color: 'bg-slate-500', label: 'Code' },
  http: { icon: Globe, color: 'bg-orange-500', label: 'HTTP' },
  transform: { icon: Database, color: 'bg-cyan-500', label: 'Transform' },
};

// Node palette component
function NodePalette({ onAddNode }: { onAddNode: (type: PipelineNode['type']) => void }) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium text-slate-200">Add Node</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {Object.entries(nodeTypes).map(([type, config]) => {
          const Icon = config.icon;
          return (
            <Button
              key={type}
              variant="outline"
              className="h-auto py-2 flex-col gap-1 border-slate-600 hover:border-slate-500"
              onClick={() => onAddNode(type as PipelineNode['type'])}
            >
              <Icon className={cn('h-4 w-4', config.color.replace('bg-', 'text-'))} />
              <span className="text-xs">{config.label}</span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}

// Single node component
function PipelineNodeComponent({
  node,
  isSelected,
  onSelect,
  onDelete,
  onDragStart,
  onDrag
}: {
  node: PipelineNode;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onDrag: (dx: number, dy: number) => void;
}) {
  const config = nodeTypes[node.type];
  const Icon = config.icon;

  const statusColors = {
    pending: 'border-slate-600',
    running: 'border-blue-500 animate-pulse',
    completed: 'border-green-500',
    failed: 'border-red-500'
  };

  return (
    <div
      className={cn(
        'absolute w-48 rounded-lg border-2 bg-slate-800 shadow-lg cursor-move transition-all',
        isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : statusColors[node.status || 'pending'],
        'hover:border-slate-400'
      )}
      style={{ left: node.x, top: node.y }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseDown={onDragStart}
    >
      {/* Header */}
      <div className={cn('flex items-center gap-2 p-2 rounded-t-lg', config.color)}>
        <GripVertical className="h-4 w-4 text-white/50" />
        <Icon className="h-4 w-4 text-white" />
        <span className="text-sm font-medium text-white truncate flex-1">{node.name}</span>
        {isSelected && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <X className="h-3 w-3 text-white" />
          </Button>
        )}
      </div>
      
      {/* Body */}
      <div className="p-2 text-xs text-slate-400">
        <Badge variant="outline" className="text-xs border-slate-600">
          {node.type}
        </Badge>
        {node.status && (
          <div className="mt-2 flex items-center gap-1">
            <div className={cn(
              'w-2 h-2 rounded-full',
              node.status === 'running' && 'bg-blue-500 animate-pulse',
              node.status === 'completed' && 'bg-green-500',
              node.status === 'failed' && 'bg-red-500',
              node.status === 'pending' && 'bg-slate-500'
            )} />
            <span className="capitalize">{node.status}</span>
          </div>
        )}
      </div>

      {/* Ports */}
      <div className="absolute left-0 top-1/2 w-3 h-3 -translate-x-1/2 rounded-full bg-slate-600 border-2 border-slate-400" />
      <div className="absolute right-0 top-1/2 w-3 h-3 translate-x-1/2 rounded-full bg-indigo-600 border-2 border-indigo-400" />
    </div>
  );
}

// Node configuration panel
function NodeConfigPanel({
  node,
  onUpdate,
  onClose
}: {
  node: PipelineNode;
  onUpdate: (updates: Partial<PipelineNode>) => void;
  onClose: () => void;
}) {
  const [name, setName] = React.useState(node.name);

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-sm font-medium text-slate-200">
          Configure {node.type}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onUpdate({ name })}
            className="bg-slate-900 border-slate-600"
          />
        </div>

        {node.type === 'skill' && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Skill Name</label>
            <Input
              placeholder="skill-name"
              className="bg-slate-900 border-slate-600"
              onChange={(e) => onUpdate({ config: { ...node.config, skillName: e.target.value } })}
              value={(node.config.skillName as string) || ''}
            />
          </div>
        )}

        {node.type === 'tool' && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tool Name</label>
            <Input
              placeholder="tool-name"
              className="bg-slate-900 border-slate-600"
              onChange={(e) => onUpdate({ config: { ...node.config, toolName: e.target.value } })}
              value={(node.config.toolName as string) || ''}
            />
          </div>
        )}

        {node.type === 'http' && (
          <>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">URL</label>
              <Input
                placeholder="https://api.example.com"
                className="bg-slate-900 border-slate-600"
                onChange={(e) => onUpdate({ config: { ...node.config, httpUrl: e.target.value } })}
                value={(node.config.httpUrl as string) || ''}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Method</label>
              <select
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
                value={(node.config.httpMethod as string) || 'GET'}
                onChange={(e) => onUpdate({ config: { ...node.config, httpMethod: e.target.value } })}
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
                <option>PATCH</option>
              </select>
            </div>
          </>
        )}

        {node.type === 'condition' && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Condition Expression</label>
            <Input
              placeholder="{{variable}} === 'value'"
              className="bg-slate-900 border-slate-600 font-mono"
              onChange={(e) => onUpdate({ config: { ...node.config, condition: e.target.value } })}
              value={(node.config.condition as string) || ''}
            />
          </div>
        )}

        {node.type === 'code' && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Code</label>
            <textarea
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm font-mono h-32"
              placeholder="// JavaScript code here"
              onChange={(e) => onUpdate({ config: { ...node.config, codeScript: e.target.value } })}
              value={(node.config.codeScript as string) || ''}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main Pipeline Builder component
export function PipelineBuilderUI() {
  const [nodes, setNodes] = React.useState<PipelineNode[]>([]);
  const [connections, setConnections] = React.useState<NodeConnection[]>([]);
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [pipelineName, setPipelineName] = React.useState('My Pipeline');
  const [isRunning, setIsRunning] = React.useState(false);

  const canvasRef = React.useRef<HTMLDivElement>(null);

  // Add new node
  const addNode = (type: PipelineNode['type']) => {
    const config = nodeTypes[type];
    const newNode: PipelineNode = {
      id: `node-${Date.now()}`,
      type,
      name: `${config.label} ${nodes.length + 1}`,
      x: 100 + (nodes.length % 3) * 200,
      y: 100 + Math.floor(nodes.length / 3) * 150,
      config: {},
      status: 'pending'
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode.id);
  };

  // Delete node
  const deleteNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
    setConnections(connections.filter(c => c.sourceId !== id && c.targetId !== id));
    setSelectedNode(null);
  };

  // Update node
  const updateNode = (id: string, updates: Partial<PipelineNode>) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  // Handle drag start
  const handleDragStart = (nodeId: string, e: React.MouseEvent) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y
    });
    setIsDragging(true);
  };

  // Handle drag move
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!selectedNode) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      updateNode(selectedNode, { x: Math.max(0, newX), y: Math.max(0, newY) });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, selectedNode, dragOffset]);

  // Run pipeline - REAL EXECUTION (no simulation)
  const runPipeline = async () => {
    if (nodes.length === 0) return;
    
    setIsRunning(true);
    
    // Reset all node statuses
    setNodes(nodes.map(n => ({ ...n, status: 'pending' as const })));

    try {
      const response = await fetch('/api/nexus/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pipelineName,
          nodes: nodes.map(n => ({
            id: n.id,
            type: n.type,
            name: n.name,
            config: n.config,
            x: n.x,
            y: n.y
          })),
          connections: connections.map(c => ({
            id: c.id,
            sourceId: c.sourceId,
            targetId: c.targetId,
            sourcePort: 'output',
            targetPort: 'input'
          })),
          save: false
        })
      });

      if (!response.ok) {
        throw new Error('Pipeline execution failed');
      }

      const result = await response.json();
      
      // Update node statuses based on REAL results
      for (const nodeResult of result.nodeResults || []) {
        setNodes(prev => prev.map(n => 
          n.id === nodeResult.nodeId 
            ? { ...n, status: nodeResult.success ? 'completed' as const : 'failed' as const }
            : n
        ));
      }
    } catch (error) {
      console.error('Pipeline execution error:', error);
      // Mark all pending nodes as failed
      setNodes(prev => prev.map(n => 
        n.status === 'pending' ? { ...n, status: 'failed' as const } : n
      ));
    } finally {
      setIsRunning(false);
    }
  };

  // Save pipeline
  const savePipeline = async () => {
    const pipeline = {
      name: pipelineName,
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        name: n.name,
        config: n.config
      })),
      connections
    };

    try {
      const response = await fetch('/api/nexus/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipeline)
      });
      
      if (response.ok) {
        alert('Pipeline saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save pipeline:', error);
    }
  };

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="grid grid-cols-[250px_1fr_280px] gap-4 h-full">
      {/* Left Panel - Node Palette */}
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Pipeline Name</label>
          <Input
            value={pipelineName}
            onChange={(e) => setPipelineName(e.target.value)}
            className="bg-slate-800 border-slate-600"
          />
        </div>
        
        <NodePalette onAddNode={addNode} />
        
        <div className="space-y-2">
          <Button
            className="w-full bg-green-600 hover:bg-green-500"
            onClick={runPipeline}
            disabled={isRunning || nodes.length === 0}
          >
            {isRunning ? (
              <>
                <GitBranch className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Pipeline
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full border-slate-600"
            onClick={savePipeline}
            disabled={nodes.length === 0}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Pipeline
          </Button>
        </div>
        
        {/* Pipeline Stats */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-slate-200">Stats</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400 space-y-2">
            <div className="flex justify-between">
              <span>Nodes:</span>
              <Badge variant="secondary">{nodes.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Connections:</span>
              <Badge variant="secondary">{connections.length}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Center - Canvas */}
      <Card className="bg-slate-900/50 border-slate-700 overflow-hidden relative">
        <div
          ref={canvasRef}
          className="absolute inset-0 overflow-auto"
          onClick={() => setSelectedNode(null)}
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        >
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <Plus className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Add nodes from the palette to start building</p>
              </div>
            </div>
          )}
          
          {nodes.map((node) => (
            <PipelineNodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNode === node.id}
              onSelect={() => setSelectedNode(node.id)}
              onDelete={() => deleteNode(node.id)}
              onDragStart={(e) => handleDragStart(node.id, e)}
              onDrag={() => {}}
            />
          ))}
        </div>
      </Card>

      {/* Right Panel - Configuration */}
      <div>
        {selectedNodeData ? (
          <NodeConfigPanel
            node={selectedNodeData}
            onUpdate={(updates) => updateNode(selectedNodeData.id, updates)}
            onClose={() => setSelectedNode(null)}
          />
        ) : (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6 text-center text-slate-500">
              <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select a node to configure</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default PipelineBuilderUI;
