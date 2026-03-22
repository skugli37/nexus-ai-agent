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
  BookOpen,
  Plus,
  Search,
  Download,
  Star,
  Clock,
  Tag,
  ExternalLink,
  Loader2,
  Check,
  X,
  FileText,
  Code,
  Globe,
  Brain,
  Sparkles
} from 'lucide-react';

// Types
interface Skill {
  name: string;
  description: string;
  version: string;
  tags: string[];
  installed?: boolean;
  author?: string;
  rating?: number;
  downloads?: number;
}

// Default skills data
const defaultSkills: Skill[] = [
  {
    name: 'code_execution',
    description: 'Execute Python, JavaScript, and shell commands in a sandboxed environment with real-time output streaming',
    version: '2.0.0',
    tags: ['execution', 'code', 'python', 'javascript', 'shell'],
    installed: true,
    author: 'NEXUS Core',
    rating: 4.9,
    downloads: 15234
  },
  {
    name: 'web_search',
    description: 'Search the web for information with support for multiple search engines and advanced query operators',
    version: '1.5.0',
    tags: ['web', 'search', 'information'],
    installed: true,
    author: 'NEXUS Core',
    rating: 4.7,
    downloads: 12845
  },
  {
    name: 'memory_crystal',
    description: 'Advanced memory management with semantic search, importance scoring, and automatic consolidation',
    version: '3.1.0',
    tags: ['memory', 'storage', 'semantic'],
    installed: true,
    author: 'NEXUS Core',
    rating: 4.8,
    downloads: 9876
  },
  {
    name: 'dream_cycle',
    description: 'Background processing for knowledge consolidation, pattern recognition, and self-improvement',
    version: '1.2.0',
    tags: ['learning', 'dream', 'background'],
    installed: true,
    author: 'NEXUS Core',
    rating: 4.6,
    downloads: 7654
  },
  {
    name: 'tool_forge',
    description: 'Create and modify tools dynamically based on task requirements and usage patterns',
    version: '2.1.0',
    tags: ['tools', 'creation', 'dynamic'],
    installed: true,
    author: 'NEXUS Core',
    rating: 4.5,
    downloads: 5432
  },
  {
    name: 'self_reflect',
    description: 'Analyze past performance and generate behavior adjustments for continuous improvement',
    version: '1.0.0',
    tags: ['reflection', 'improvement', 'learning'],
    installed: true,
    author: 'NEXUS Core',
    rating: 4.4,
    downloads: 4321
  }
];

// Available skills marketplace
const marketplaceSkills: Skill[] = [
  {
    name: 'image_generation',
    description: 'Generate images from text descriptions using AI-powered image synthesis',
    version: '1.0.0',
    tags: ['image', 'ai', 'generation'],
    installed: false,
    author: 'Community',
    rating: 4.8,
    downloads: 8543
  },
  {
    name: 'video_understand',
    description: 'Analyze and understand video content with temporal reasoning',
    version: '1.0.0',
    tags: ['video', 'analysis', 'ai'],
    installed: false,
    author: 'Community',
    rating: 4.6,
    downloads: 6234
  },
  {
    name: 'pdf_processor',
    description: 'Extract text, tables, and metadata from PDF documents',
    version: '2.0.0',
    tags: ['pdf', 'document', 'extraction'],
    installed: false,
    author: 'Community',
    rating: 4.5,
    downloads: 5123
  }
];

// Skill icon map
const skillIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  code: Code,
  execution: Code,
  web: Globe,
  search: Globe,
  memory: Brain,
  learning: Brain,
  document: FileText,
  pdf: FileText,
  image: Sparkles,
  video: Sparkles,
  default: BookOpen
};

// Get skill icon key based on tags
function getSkillIconKey(tags: string[]): string {
  if (tags.includes('code') || tags.includes('execution')) return 'code';
  if (tags.includes('web') || tags.includes('search')) return 'web';
  if (tags.includes('memory') || tags.includes('learning')) return 'memory';
  if (tags.includes('document') || tags.includes('pdf')) return 'document';
  if (tags.includes('image') || tags.includes('video')) return 'image';
  return 'default';
}

// Skill card component
function SkillCard({ skill, onInstall, onUninstall }: {
  skill: Skill;
  onInstall: (name: string) => void;
  onUninstall: (name: string) => void;
}) {
  const [isInstalling, setIsInstalling] = React.useState(false);
  const iconKey = getSkillIconKey(skill.tags);
  const IconComponent = skillIconMap[iconKey] || skillIconMap.default;

  const handleAction = async () => {
    setIsInstalling(true);
    if (skill.installed) {
      await onUninstall(skill.name);
    } else {
      await onInstall(skill.name);
    }
    setIsInstalling(false);
  };

  return (
    <Card className={cn(
      'bg-slate-800/50 border-slate-700 transition-all hover:border-slate-600',
      skill.installed && 'border-emerald-500/30'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn(
              'p-2 rounded-lg',
              skill.installed ? 'bg-emerald-600' : 'bg-slate-600'
            )}>
              <IconComponent className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-slate-200">{skill.name}</h4>
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                  v{skill.version}
                </Badge>
                {skill.installed && (
                  <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    Installed
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1 line-clamp-2">{skill.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                {skill.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span>{skill.rating}</span>
                  </div>
                )}
                {skill.downloads && (
                  <div className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    <span>{skill.downloads.toLocaleString()}</span>
                  </div>
                )}
                <span>by {skill.author}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {skill.tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs border-slate-600 text-slate-400">
                    {tag}
                  </Badge>
                ))}
                {skill.tags.length > 4 && (
                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                    +{skill.tags.length - 4}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant={skill.installed ? 'outline' : 'default'}
            size="sm"
            className={cn(
              'shrink-0',
              skill.installed 
                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                : 'bg-indigo-600 hover:bg-indigo-500'
            )}
            onClick={handleAction}
            disabled={isInstalling}
          >
            {isInstalling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : skill.installed ? (
              <>
                <X className="h-4 w-4 mr-1" />
                Uninstall
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1" />
                Install
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Main SkillPanel component
export function SkillPanel() {
  const [skills, setSkills] = React.useState<Skill[]>(defaultSkills);
  const [marketplace, setMarketplace] = React.useState<Skill[]>(marketplaceSkills);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'installed' | 'marketplace'>('installed');
  const [isLoading, setIsLoading] = React.useState(false);

  // Fetch skills from API
  const fetchSkills = React.useCallback(async () => {
    try {
      const response = await fetch('/api/nexus/status');
      if (response.ok) {
        const data = await response.json();
        if (data.skills && data.skills.length > 0) {
          // Merge API skills with default
          const apiSkillNames = data.skills.map((s: Skill) => s.name);
          const merged = [
            ...defaultSkills.map(s => ({
              ...s,
              installed: apiSkillNames.includes(s.name) || s.installed
            })),
            ...data.skills.filter((s: Skill) => !defaultSkills.find(d => d.name === s.name))
          ];
          setSkills(merged);
        }
      }
    } catch (error) {
      console.error('Failed to fetch skills:', error);
    }
  }, []);

  React.useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Filter skills by search
  const filteredSkills = (activeTab === 'installed' ? skills : marketplace).filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleInstall = async (name: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/nexus/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, action: 'install' })
      });
      
      if (response.ok) {
        // Move from marketplace to installed
        const skill = marketplace.find(s => s.name === name);
        if (skill) {
          setMarketplace(prev => prev.filter(s => s.name !== name));
          setSkills(prev => [...prev, { ...skill, installed: true }]);
        }
      }
    } catch (error) {
      console.error('Failed to install skill:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUninstall = async (name: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/nexus/skills', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      if (response.ok) {
        setSkills(prev => prev.filter(s => s.name !== name));
      }
    } catch (error) {
      console.error('Failed to uninstall skill:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-400" />
            Skills
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={activeTab === 'installed' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                activeTab === 'installed' 
                  ? 'bg-indigo-600 hover:bg-indigo-500'
                  : 'border-slate-600 text-slate-400'
              )}
              onClick={() => setActiveTab('installed')}
            >
              Installed ({skills.filter(s => s.installed).length})
            </Button>
            <Button
              variant={activeTab === 'marketplace' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                activeTab === 'marketplace' 
                  ? 'bg-indigo-600 hover:bg-indigo-500'
                  : 'border-slate-600 text-slate-400'
              )}
              onClick={() => setActiveTab('marketplace')}
            >
              Marketplace
            </Button>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            className="pl-9 bg-slate-800 border-slate-600 text-slate-200"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[450px] px-6 pb-6">
          <div className="space-y-3">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.name}
                skill={skill}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
              />
            ))}
            {filteredSkills.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No skills found</p>
                <p className="text-xs mt-1">
                  {activeTab === 'installed' 
                    ? 'Install skills from the marketplace'
                    : 'Try a different search term'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default SkillPanel;
