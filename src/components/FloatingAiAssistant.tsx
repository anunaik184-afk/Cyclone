import React, {useEffect, useRef, useState} from 'react';
import {AlertTriangle, Send, Sparkles, X} from 'lucide-react';
import {type GpsLocationState} from '../lib/location';

interface FloatingAiAssistantProps {
  gps: GpsLocationState;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const QUICK_PROMPTS = [
  'Cyclone evacuation checklist',
  'What to do during flood water rise',
  'Emergency 72-hour go-bag items',
  'How to verify IMD cyclone alerts',
];

export function FloatingAiAssistant({gps}: FloatingAiAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello, I am CycloneSafe AI Assistant. Ask me about cyclone preparedness, flood safety, emergency kits, or India emergency helplines (112 / 108 / 1078).',
    },
  ]);

  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      listEndRef.current?.scrollIntoView({behavior: 'smooth'});
    }
  }, [messages, open]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextHistory = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({role: m.role, text: m.text}));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setErrorMsg(null);
    setSending(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory,
          location:
            gps.status === 'ready' && gps.lat !== null && gps.lng !== null
              ? {
                  lat: gps.lat,
                  lng: gps.lng,
                  insideIndia: gps.insideIndia,
                }
              : undefined,
        }),
      });

      const payload = (await res.json()) as {reply?: string; error?: string};
      if (!res.ok || !payload.reply) {
        throw new Error(
          payload.error || 'Assistant could not process your request right now.',
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: payload.reply!,
        },
      ]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to reach AI Assistant.',
      );
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {open && (
        <section
          aria-label="CycloneSafe AI Assistant"
          className="fixed bottom-20 lg:bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 max-h-[75vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          <header className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold truncate">
                  CycloneSafe AI Assistant
                </h2>
                <p className="text-[11px] text-slate-300 truncate">
                  Disaster preparedness &amp; India safety guidance
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close CycloneSafe AI Assistant"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={sending}
                onClick={() => sendMessage(q)}
                className="px-2.5 py-1 text-[11px] font-medium bg-white border border-slate-200 hover:border-sky-400 text-slate-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-[240px]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-bl-sm px-3.5 py-2 text-xs">
                  Thinking...
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div ref={listEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about safety, shelters, or first aid..."
              className="flex-1 h-9 px-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="h-9 px-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg flex items-center justify-center cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close AI Assistant' : 'Open CycloneSafe AI Assistant'}
        title="CycloneSafe AI Assistant"
        className="fixed bottom-16 lg:bottom-6 right-4 sm:right-6 z-50 w-13 h-13 rounded-full bg-sky-600 hover:bg-sky-700 text-white shadow-lg flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-sky-600/20"
      >
        {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>
    </>
  );
}
