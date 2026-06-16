import { useState, useRef, useEffect } from 'react';
import type { Subject } from '../../types';
import type { DailyStats } from '../../types/progress';
import { saveDailyStats, getLisbonToday } from '../../utils/progress';
import UpsellPopup from '../UpsellPopup';

interface TutorIAProps {
  subject: Subject;
  isPaid: boolean;
  dailyStats: DailyStats;
  onDailyStatsUpdate: (updated: DailyStats) => void;
}

const MAX_FREE_MESSAGES = 20;

const SUGGESTED_PROMPTS = [
  'Explica este capítulo do zero',
  'Faz-me perguntas de exame',
  'Resume isto em 5 pontos',
  'Mostra-me onde costumo errar',
  'Explica como o professor pode avaliar isto',
];

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

export default function TutorIA({ subject, isPaid, dailyStats, onDailyStatsUpdate }: TutorIAProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: `Olá! Sou o teu tutor de **${subject.name}**.\n\nPodes pedir-me para explicar qualquer tema, fazer perguntas de exame, ou resumir capítulos. O que precisas?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [cadeiraId, setCadeiraId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  const msgCount    = dailyStats.messageCount;
  const limitReached = !isPaid && msgCount >= MAX_FREE_MESSAGES;

  // Try to find a matching cadeira in the backend so we use real knowledge
  useEffect(() => {
    fetch(`/api/cadeiras/lookup?nome=${encodeURIComponent(subject.name)}&curso=${encodeURIComponent(subject.course)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.id) setCadeiraId(data.id) })
      .catch(() => {});
  }, [subject.name, subject.course]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function sendMessage(text: string) {
    if (!text.trim() || isTyping) return;
    if (limitReached) { setShowUpsell(true); return; }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(m => [...m, userMsg]);
    setInput('');

    const newStats: DailyStats = {
      ...dailyStats,
      date: getLisbonToday(),
      messageCount: dailyStats.messageCount + 1,
    };
    saveDailyStats(newStats);
    onDailyStatsUpdate(newStats);

    if (cadeiraId) {
      sendToBackend(text, cadeiraId);
    } else {
      sendDemo(text);
    }
  }

  // Real backend chat using the SSE streaming endpoint
  async function sendToBackend(question: string, cadId: string) {
    setIsTyping(true);
    const aiMsgId = (Date.now() + 1).toString();
    setMessages(m => [...m, { id: aiMsgId, role: 'ai', content: '' }]);

    abortRef.current = new AbortController();

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cadeira_id: cadId, history, question }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) throw new Error('Erro na ligação ao servidor.');

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const { text, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (text) {
              accumulated += text;
              const snap = accumulated;
              setMessages(m => m.map(msg => msg.id === aiMsgId ? { ...msg, content: snap } : msg));
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages(m => m.map(msg =>
        msg.id === aiMsgId
          ? { ...msg, content: 'Erro ao ligar ao servidor. Tenta novamente.' }
          : msg
      ));
    } finally {
      setIsTyping(false);
    }
  }

  // Fallback demo mode when no cadeira is found in the backend
  function sendDemo(text: string) {
    setIsTyping(true);
    setTimeout(() => {
      const greetings = [
        `Boa pergunta sobre ${subject.name}. Vou explicar de forma clara e adaptada ao que costuma sair nos exames desta cadeira.`,
        `Em ${subject.name} este tema é frequentemente avaliado. Deixa-me estruturar a resposta por pontos.`,
        `Ótimo — este é um dos temas centrais de ${subject.name}. Aqui está uma explicação directa:`,
      ];
      const greeting = greetings[text.length % greetings.length];
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `${greeting}\n\n1. **Conceito principal** — O tema está ligado a princípios fundamentais da cadeira que aparecem regularmente nos exames.\n\n2. **Como costuma ser avaliado** — Normalmente surgem questões que combinam teoria com aplicação a casos práticos.\n\n3. **Dica de estudo** — Foca nos exemplos numéricos e nos exercícios das últimas frequências.\n\n*Nota: ainda não há material carregado para esta cadeira. O admin pode adicioná-lo no painel de Conhecimento.*`,
      };
      setMessages(m => [...m, aiMsg]);
      setIsTyping(false);
    }, 600);
  }

  function formatContent(text: string) {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
          )}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <div className="flex flex-col h-[70vh] max-h-[600px]">
      {/* Connection indicator + message counter */}
      <div className="flex items-center justify-between px-1 py-2 text-xs mb-2">
        <span className={limitReached ? 'text-red-500' : 'text-gray-400'}>
          {limitReached
            ? 'Limite diário atingido. Faz upgrade para continuar.'
            : !isPaid ? `Mensagens hoje: ${msgCount}/${MAX_FREE_MESSAGES}` : null}
        </span>
        <span className={`text-xs ${cadeiraId ? 'text-green-500' : 'text-gray-300'}`}>
          {cadeiraId ? '● conectado' : '○ demo'}
        </span>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-500 to-violet-500 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              {msg.content ? formatContent(msg.content) : (
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && messages[messages.length - 1]?.role !== 'ai' && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length <= 2 && (
        <div className="py-3 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              disabled={limitReached}
              className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="pt-3 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            disabled={limitReached}
            placeholder={limitReached ? 'Limite diário atingido' : `Pergunta sobre ${subject.name}...`}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || limitReached || isTyping}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.05] transition-all flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {showUpsell && <UpsellPopup onClose={() => setShowUpsell(false)} />}
    </div>
  );
}
