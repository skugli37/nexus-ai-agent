'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Bot,
  User,
  Send,
  Loader2,
  Terminal,
  Code,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';

// Types
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  reasoning?: string;
  isStreaming?: boolean;
}

// Code block component for rendering code with syntax highlighting
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-mono text-slate-400">{language || 'code'}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-slate-400 hover:text-slate-200"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="text-slate-300 font-mono">{code}</code>
      </pre>
    </div>
  );
}

// Tool call visualization component
function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = React.useState(false);

  const statusIcon = {
    pending: <Clock className="h-4 w-4 text-amber-400 animate-pulse" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    error: <XCircle className="h-4 w-4 text-red-400" />
  }[toolCall.status];

  return (
    <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
      <CardHeader className="p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-purple-400" />
            <CardTitle className="text-sm font-medium text-slate-200">{toolCall.name}</CardTitle>
            <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
              {toolCall.status}
            </Badge>
          </div>
          {statusIcon}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="p-3 pt-0 space-y-2">
          <div className="text-xs text-slate-400 font-medium">Arguments:</div>
          <pre className="text-xs bg-slate-900 p-2 rounded border border-slate-700 overflow-x-auto">
            <code className="text-slate-300">{JSON.stringify(toolCall.arguments, null, 2)}</code>
          </pre>
          {toolCall.result && (
            <>
              <div className="text-xs text-slate-400 font-medium">Result:</div>
              <pre className="text-xs bg-slate-900 p-2 rounded border border-slate-700 overflow-x-auto max-h-40">
                <code className="text-slate-300">{JSON.stringify(toolCall.result, null, 2)}</code>
              </pre>
            </>
          )}
          {toolCall.error && (
            <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-800">
              {toolCall.error}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Message component
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  // Parse code blocks from content
  const parseContent = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push(
          <span key={lastIndex} className="whitespace-pre-wrap">
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }
      // Add code block
      parts.push(
        <CodeBlock key={match.index} code={match[2]} language={match[1]} />
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key={lastIndex} className="whitespace-pre-wrap">
          {content.slice(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{content}</span>;
  };

  return (
    <div className={cn('flex gap-3 mb-4', isUser && 'flex-row-reverse')}>
      <Avatar className={cn(
        'h-8 w-8 shrink-0',
        isUser ? 'bg-indigo-600' : isTool ? 'bg-purple-600' : 'bg-slate-700'
      )}>
        <AvatarFallback className="bg-transparent">
          {isUser ? <User className="h-4 w-4" /> : 
           isTool ? <Terminal className="h-4 w-4" /> : 
           <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className={cn(
        'flex-1 max-w-[80%] space-y-2',
        isUser && 'flex flex-col items-end'
      )}>
        <div className={cn(
          'rounded-xl px-4 py-3',
          isUser ? 'bg-indigo-600 text-white' : 
          'bg-slate-800 border border-slate-700 text-slate-200'
        )}>
          {message.isStreaming ? (
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-pulse text-indigo-400" />
              <span className="text-slate-400">Thinking...</span>
            </div>
          ) : (
            <div className="text-sm leading-relaxed">
              {parseContent(message.content)}
            </div>
          )}
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2 w-full">
            {message.toolCalls.map((toolCall) => (
              <ToolCallCard key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}
        <div className="text-xs text-slate-500">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      <Avatar className="h-8 w-8 bg-slate-700">
        <AvatarFallback className="bg-transparent">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// Main AgentChat component
export function AgentChat() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add streaming message placeholder
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/nexus/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim() })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      // Update the assistant message with the response
      setMessages(prev => prev.map(m => 
        m.id === assistantMessage.id 
          ? { ...m, content: data.response, isStreaming: false }
          : m
      ));
    } catch (error) {
      // Update with error message
      setMessages(prev => prev.map(m => 
        m.id === assistantMessage.id 
          ? { ...m, content: 'Sorry, I encountered an error. Please try again.', isStreaming: false }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="flex flex-col h-full bg-slate-900/50 border-slate-700">
      <CardHeader className="border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-400" />
            NEXUS Chat
          </CardTitle>
          <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
            Online
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Bot className="h-12 w-12 text-indigo-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-200 mb-2">Welcome to NEXUS</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                I am your AI assistant with self-evolving capabilities. 
                Ask me anything or give me a task to complete.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && messages[messages.length - 1]?.isStreaming && <TypingIndicator />}
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-slate-700 p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message to NEXUS..."
              className="bg-slate-800 border-slate-600 text-slate-200 placeholder:text-slate-500"
              disabled={isLoading}
            />
            <Button 
              onClick={sendMessage} 
              disabled={!input.trim() || isLoading}
              className="bg-indigo-600 hover:bg-indigo-500"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AgentChat;
