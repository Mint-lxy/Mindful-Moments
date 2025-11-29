
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Headphones } from 'lucide-react';
import { createChatSession, MultiProviderChat } from '../services/geminiService';
import { ChatMessage, DiaryEntry, AIConfig } from '../types';

interface ChatAssistantProps {
  entries: DiaryEntry[];
  onStartLiveSession: () => void;
  aiConfig: AIConfig;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ entries, onStartLiveSession, aiConfig }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'init', role: 'model', text: '你好！我是你的心情助手。想聊聊最近发生的事情，或者需要一些建议吗？', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<MultiProviderChat | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize chat session with context - Re-init if config changes
  useEffect(() => {
    const context = entries.slice(0, 5).map(e => `[${new Date(e.date).toLocaleDateString('zh-CN')}]: 心情 ${e.moodScore}/10. 内容: ${e.content}`).join('\n');
    chatSessionRef.current = createChatSession(context, aiConfig);
  }, [entries, aiConfig]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      if (!chatSessionRef.current) {
         // Fallback init
         chatSessionRef.current = createChatSession("用户暂无近期日记。", aiConfig);
      }

      // Using the unified sendMessage method from MultiProviderChat
      const responseText = await chatSessionRef.current.sendMessage(userMsg.text);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText || "我在听...",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      console.error(e);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "连接好像出了点问题，请稍后再试。",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Internal Spacer to match App.tsx's SafeTopSpacer (h-12)
  const HeaderSpacer = () => <div className="w-full h-12 flex-shrink-0" />;

  return (
    <div className="flex flex-col h-full bg-white md:rounded-3xl shadow-sm md:border border-slate-100 overflow-hidden relative">
      
      {/* Header Container */}
      <div className="relative z-10 bg-white/95 backdrop-blur-md border-b border-slate-50 flex-shrink-0">
        {/* Status Bar Safe Area */}
        <div className="safe-area-top"></div>
        {/* Alignment Spacer matching Home Page */}
        <HeaderSpacer />
        
        {/* Actual Header Content */}
        <div className="px-4 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Bot size={22} />
                </div>
                {/* Text style matches App.tsx Home Page Header (text-2xl font-bold) */}
                <h3 className="text-2xl font-bold text-slate-800 tracking-tight">心情助手</h3>
            </div>
            
            <button 
                onClick={onStartLiveSession}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary to-secondary text-white rounded-full text-xs font-bold shadow-md shadow-primary/20 hover:scale-105 transition-transform"
            >
                <Headphones size={14} />
                <span>通话</span>
            </button>
        </div>
      </div>
      
      {/* Messages Area - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-primary text-white rounded-2xl rounded-tr-none' 
                : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-2xl rounded-tl-none'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-slate-50 rounded-2xl rounded-tl-none p-4 flex gap-1 border border-slate-100">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-150"></span>
                </div>
            </div>
        )}
        {/* Extra spacer at bottom of messages to prevent hidden content behind input */}
        <div className="h-6"></div>
      </div>

      {/* Input Area - Seamless Connection */}
      {/* pb-16 to sit on top of nav bar (h-16) + bottom safe area */}
      <div className="p-3 md:p-4 bg-white z-10 pb-16 md:pb-4 border-t border-slate-50 md:border-t-0 flex-shrink-0">
        <div className="flex gap-2 items-end bg-slate-50 p-1.5 rounded-3xl border border-slate-100 focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary/30 transition-all">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder={aiConfig.provider === 'DeepSeek' ? "通过 DeepSeek 思考中..." : "聊聊你的想法..."}
                className="flex-1 px-4 py-2.5 max-h-32 min-h-[44px] bg-transparent text-sm resize-none focus:outline-none placeholder-slate-400"
                rows={1}
            />
            <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="p-2.5 bg-primary text-white rounded-full hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20 mb-0.5 mr-0.5"
            >
                <Send size={18} />
            </button>
        </div>
      </div>
    </div>
  );
};
