'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';

type Citation = {
  title: string;
  url: string;
  excerpt: string;
  sourceType: string;
};

type AssistantPayload = {
  answer: string;
  citations: Citation[];
  confidence: number;
  handoffSuggested: boolean;
  sessionId: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  handoffSuggested?: boolean;
};

const STORAGE_KEYS = {
  open: 'resacolo.chatbot.open',
  sessionId: 'resacolo.chatbot.sessionId'
} as const;

const INITIAL_SUGGESTIONS = [
  'Quel séjour recommandez-vous pour 10-12 ans cet été ?',
  'Quels séjours linguistiques sont disponibles cet été ?',
  'Quels séjours artistiques sont proposés au printemps ?'
];

function nowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildConversationExcerpt(messages: Message[]) {
  return messages
    .slice(-10)
    .map((message) => `${message.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${message.content}`)
    .join('\n');
}

async function postJson<TResponse>(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = (await response.json().catch(() => ({}))) as TResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }
  return data;
}

async function trackEvent(
  eventType: 'chat_opened' | 'message_sent' | 'answer_rendered' | 'citation_clicked' | 'handoff_triggered',
  input?: { sessionId?: string | null; payload?: Record<string, unknown> }
) {
  try {
    const data = await postJson<{ sessionId?: string }>('/api/chatbot/event', {
      sessionId: input?.sessionId ?? undefined,
      eventType,
      payload: input?.payload ?? {}
    });
    return data.sessionId ?? null;
  } catch {
    return null;
  }
}

export function PublicChatbotWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastPathname, setLastPathname] = useState<string | null>(null);

  const hasMessages = messages.length > 0;
  const canSend = question.trim().length >= 2 && !loading;

  useEffect(() => {
    const savedOpen = window.localStorage.getItem(STORAGE_KEYS.open);
    const savedSessionId = window.localStorage.getItem(STORAGE_KEYS.sessionId);
    if (savedOpen === '1') setOpen(true);
    if (savedSessionId) setSessionId(savedSessionId);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.open, open ? '1' : '0');
  }, [open]);

  useEffect(() => {
    if (!sessionId) return;
    window.localStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!open) return;
    trackEvent('chat_opened', { sessionId }).then((createdSessionId) => {
      if (createdSessionId && !sessionId) {
        setSessionId(createdSessionId);
      }
    });
  }, [open, sessionId]);

  useEffect(() => {
    if (lastPathname === null) {
      setLastPathname(pathname);
      return;
    }
    if (lastPathname !== pathname) {
      setOpen(false);
      setLastPathname(pathname);
    }
  }, [lastPathname, pathname]);

  const lastAssistantMessage = useMemo(() => {
    const reversed = [...messages].reverse();
    return reversed.find((message) => message.role === 'assistant') ?? null;
  }, [messages]);

  async function ask(rawQuestion: string) {
    const normalized = rawQuestion.trim();
    if (normalized.length < 2 || loading) return;
    setError(null);

    const userMessage: Message = {
      id: nowId(),
      role: 'user',
      content: normalized
    };
    setMessages((previous) => [...previous, userMessage]);
    setQuestion('');
    setLoading(true);

    try {
      const data = await postJson<AssistantPayload>('/api/chatbot/query', {
        question: normalized,
        sessionId: sessionId ?? undefined
      });

      setSessionId(data.sessionId);
      setMessages((previous) => [
        ...previous,
        {
          id: nowId(),
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          handoffSuggested: data.handoffSuggested
        }
      ]);
    } catch (queryError) {
      setError(
        queryError instanceof Error
          ? queryError.message
          : 'Impossible de traiter la question pour le moment.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function triggerHandoff() {
    if (handoffLoading) return;
    setHandoffLoading(true);
    setError(null);
    try {
      const lastUserQuestion = [...messages].reverse().find((message) => message.role === 'user')?.content;
      const data = await postJson<{ inquiryId: string }>('/api/chatbot/handoff', {
        sessionId: sessionId ?? undefined,
        question: lastUserQuestion,
        conversationExcerpt: buildConversationExcerpt(messages)
      });

      await trackEvent('handoff_triggered', {
        sessionId,
        payload: { inquiry_id: data.inquiryId }
      });

      setMessages((previous) => [
        ...previous,
        {
          id: nowId(),
          role: 'assistant',
          content:
            "Votre demande a été transmise à l'équipe Resacolo. Un conseiller reviendra vers vous rapidement.",
          citations: []
        }
      ]);
    } catch (handoffError) {
      setError(
        handoffError instanceof Error ? handoffError.message : 'Transfert impossible pour le moment.'
      );
    } finally {
      setHandoffLoading(false);
    }
  }

  if (process.env.NEXT_PUBLIC_CHATBOT_ENABLED !== '1') {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="cta-orange-sweep fixed bottom-5 right-5 z-[70] inline-flex items-center gap-2 rounded-full border border-orange-300 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_-20px_rgba(250,133,0,0.95)]"
        aria-expanded={open}
        aria-label="Ouvrir l'assistant Resacolo"
      >
        {open ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        Assistant
      </button>

      {open ? (
        <section className="fixed bottom-20 right-4 z-[70] flex h-[70vh] w-[calc(100vw-2rem)] max-w-[25rem] flex-col overflow-hidden rounded-[1.45rem] border border-slate-200/90 bg-white shadow-[0_26px_50px_-26px_rgba(15,23,42,0.58)] sm:right-5">
          <header className="border-b border-slate-200/85 bg-[linear-gradient(120deg,#fff7eb_0%,#ebf8ff_58%,#ffffff_100%)] px-4 py-4">
            <div>
              <h2
                className="font-display text-[1.7rem] font-bold leading-[1.05] text-[#505050] sm:text-[1.95rem]"
                style={{
                  fontFamily: 'var(--font-primary, var(--font-display, var(--font-sans)))',
                  textAlign: 'left',
                  margin: 0
                }}
              >
                Assistant <span style={{ color: '#6dc7fe' }}>Resacolo</span>
              </h2>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fcff] px-3 py-3">
            {!hasMessages ? (
              <div className="space-y-2 rounded-2xl border border-sky-100 bg-white/95 p-3 shadow-[0_10px_20px_-18px_rgba(55,181,245,0.9)]">
                <p className="text-sm font-medium text-slate-700">
                  Posez votre question uniquement sur les séjours.
                </p>
                <div className="space-y-2">
                  {INITIAL_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => ask(suggestion)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:border-sky-300 hover:text-sky-700"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-2xl px-3 py-2.5 text-sm shadow-[0_8px_18px_-16px_rgba(15,23,42,0.55)] ${
                  message.role === 'user'
                    ? 'ml-7 border border-orange-400/80 bg-orange-500 text-white'
                    : 'mr-7 border border-sky-100 bg-white text-slate-800'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.role === 'assistant' && message.citations && message.citations.length > 0 ? (
                  <div className="mt-2 space-y-2 border-t border-slate-200/80 pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Liens des séjours
                    </p>
                    <ul className="space-y-1.5">
                      {message.citations.map((citation, index) => (
                        <li key={`${citation.url}-${index}`}>
                          <a
                            href={citation.url}
                            target={citation.url.startsWith('/assistant/sources/') ? '_self' : '_blank'}
                            rel="noreferrer"
                            onClick={() => {
                              trackEvent('citation_clicked', {
                                sessionId,
                                payload: {
                                  url: citation.url,
                                  source_type: citation.sourceType
                                }
                              });
                            }}
                            className="block truncate rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:bg-sky-100 hover:text-sky-800"
                          >
                            {citation.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}

            {loading ? (
              <div className="mr-7 inline-flex items-center gap-2 rounded-2xl border border-sky-100 bg-white px-3 py-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recherche en cours...
              </div>
            ) : null}
          </div>

          <footer className="border-t border-slate-200 bg-white p-3">
            {error ? (
              <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-600">
                {error}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Votre question..."
                className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canSend) {
                    event.preventDefault();
                    ask(question);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => ask(question)}
                disabled={!canSend}
                className="cta-orange-sweep inline-flex h-10 w-10 items-center justify-center rounded-xl text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {lastAssistantMessage?.handoffSuggested ? (
              <button
                type="button"
                onClick={triggerHandoff}
                disabled={handoffLoading}
                className="mt-2 w-full rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:border-sky-400 hover:bg-sky-50 disabled:opacity-50"
              >
                {handoffLoading ? 'Transfert en cours...' : "Transférer ma demande à l'équipe"}
              </button>
            ) : null}
          </footer>
        </section>
      ) : null}
    </>
  );
}
