'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppShell } from '@/components/AppShell';
import { ChatConversation, ChatMessage } from '@/types';
import { getSupabaseClient } from '@/lib/db/supabaseClient';
import {
  Sparkles,
  Plus,
  Trash2,
  Send,
  MessageSquare,
  Bot,
  User as UserIcon,
  AlertTriangle,
  Clock,
  ArrowRight,
  Database,
  ChevronLeft,
  X,
} from 'lucide-react';

let tempIdCounter = 0;
function createOptimisticId(): string {
  tempIdCounter += 1;
  return `temp-${tempIdCounter}`;
}

export default function AssistantPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputContent, setInputContent] = useState<string>('');
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<string>('LOCAL');
  const [isDurable, setIsDurable] = useState<boolean>(false);

  // Delete modal state
  const [conversationToDelete, setConversationToDelete] = useState<ChatConversation | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Mobile conversation drawer state
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to attach authorization header if Supabase session is active
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }
    } catch {}
    return headers;
  }, []);

  // 1. Fetch conversations list on mount
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/assistant/conversations', { headers });
        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.success) {
          const list: ChatConversation[] = data.conversations || [];
          setConversations(list);
          if (data.authMode === 'supabase') {
            setStorageMode('SUPABASE');
            setIsDurable(true);
          } else {
            setStorageMode('STANDALONE');
            setIsDurable(Boolean(data.isDurable));
          }

          if (list.length > 0) {
            setActiveConvId((curr) => curr ?? list[0].id);
          }
        } else {
          setErrorMessage(data.error || 'Failed to load conversation history.');
        }
      } catch {
        if (isMounted) setErrorMessage('Could not connect to conversation service.');
      } finally {
        if (isMounted) setLoadingList(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [getAuthHeaders]);

  // 2. Fetch messages for active conversation
  useEffect(() => {
    if (!activeConvId) {
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/assistant/conversations/${activeConvId}/messages`, { headers });
        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.success) {
          setMessages(data.messages || []);
        } else {
          setErrorMessage(data.error || 'Failed to load messages.');
        }
      } catch {
        if (isMounted) setErrorMessage('Failed to connect to messages endpoint.');
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [activeConvId, getAuthHeaders]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // 3. Create a new conversation
  const handleNewChat = async (initialTitle?: string) => {
    setSending(true);
    setErrorMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/assistant/conversations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: initialTitle || 'New Investigation' }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setMessages([]);
        setMobileHistoryOpen(false);
      } else {
        setErrorMessage(data.error || 'Failed to create new conversation.');
      }
    } catch {
      setErrorMessage('Network error while starting new chat.');
    } finally {
      setSending(false);
    }
  };

  // 4. Send message
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputContent).trim();
    if (!textToSend || sending) return;

    let targetConvId = activeConvId;

    // If no active conversation, create one first
    if (!targetConvId) {
      setSending(true);
      try {
        const headers = await getAuthHeaders();
        const titleSnippet = textToSend.slice(0, 32) + (textToSend.length > 32 ? '...' : '');
        const res = await fetch('/api/assistant/conversations', {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: titleSnippet }),
        });
        const data = await res.json();
        if (data.success && data.conversation) {
          targetConvId = data.conversation.id;
          setActiveConvId(targetConvId);
          setConversations((prev) => [data.conversation, ...prev]);
        } else {
          setErrorMessage('Could not initialize conversation.');
          setSending(false);
          return;
        }
      } catch {
        setErrorMessage('Failed to start conversation.');
        setSending(false);
        return;
      }
    }

    if (!targetConvId) {
      setSending(false);
      return;
    }

    // Optimistically show user message
    const optimisticUserMsg: ChatMessage = {
      id: createOptimisticId(),
      conversation_id: targetConvId,
      user_id: 'current-user',
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInputContent('');
    setSending(true);
    setErrorMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/assistant/conversations/${targetConvId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: textToSend }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Replace with persisted user & assistant messages
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== optimisticUserMsg.id);
          const next = [...filtered, data.userMessage];
          if (data.assistantMessage) {
            next.push(data.assistantMessage);
          }
          return next;
        });
      } else {
        // If user message was recorded before provider failure, keep it in view
        if (data.userMessage) {
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== optimisticUserMsg.id);
            return [...filtered, data.userMessage];
          });
        }
        setErrorMessage(data.error || 'Failed to submit message.');
      }
    } catch {
      setErrorMessage('Communication error while sending message.');
    } finally {
      setSending(false);
    }
  };

  // 5. Delete conversation
  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) return;
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/assistant/conversations/${conversationToDelete.id}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationToDelete.id));
        if (activeConvId === conversationToDelete.id) {
          const remaining = conversations.filter((c) => c.id !== conversationToDelete.id);
          setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
        }
        setConversationToDelete(null);
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'Could not delete conversation.');
      }
    } catch {
      setErrorMessage('Network error during deletion.');
    } finally {
      setDeleting(false);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  const starterPrompts = [
    {
      title: 'Analyze Zero-Sales Streaks',
      prompt: 'Which products in Downtown Supercenter have consecutive zero sales despite high recorded stock?',
    },
    {
      title: 'Explain SKU-104 Anomaly',
      prompt: 'Explain the root-cause reasoning and Poisson anomaly for Electrolyte Citrus Rush 16oz (SKU-104).',
    },
    {
      title: 'Morning Walk Checklist',
      prompt: 'Generate an actionable morning shelf-walk verification checklist for store associates.',
    },
    {
      title: 'Promotion Lift Discrepancies',
      prompt: 'Identify any fast-moving SKUs on active promotion that failed to register any sales yesterday.',
    },
  ];

  return (
    <AppShell
      title="AI Inventory Assistant"
      subtitle="Operational root-cause reasoning, stock discrepancy analysis, and morning shelf walk guidance"
      badge={
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-600/30 flex items-center space-x-1">
          <Sparkles className="w-3 h-3 text-emerald-600" />
          <span>Intelligence Engine</span>
        </span>
      }
    >
      <div className="max-w-7xl mx-auto h-[calc(100vh-8.5rem)] flex flex-col min-h-[500px]">
        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between shadow-xs shrink-0">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-amber-700 hover:text-amber-900 font-bold p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Master Chat Split Panel */}
        <div className="flex-1 flex overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          {/* Left Panel: Conversation History */}
          <aside
            className={`
              w-72 sm:w-80 border-r border-slate-100 flex flex-col bg-slate-50/60 shrink-0 transition-all duration-200
              ${mobileHistoryOpen ? 'fixed inset-0 z-30 bg-white w-full' : 'hidden md:flex'}
            `}
          >
            {/* Header: New Chat & Mobile Close */}
            <div className="p-3.5 border-b border-slate-200/70 flex items-center justify-between gap-2 bg-white">
              <button
                onClick={() => handleNewChat()}
                className="flex-1 flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-emerald-900 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Chat</span>
              </button>

              {mobileHistoryOpen && (
                <button
                  onClick={() => setMobileHistoryOpen(false)}
                  className="md:hidden p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                  aria-label="Close conversation list"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Storage Layer Status Banner */}
            <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-100/50 flex items-center justify-between text-[11px] text-slate-600">
              <span className="flex items-center space-x-1.5 font-medium">
                <Database className="w-3 h-3 text-emerald-700" />
                <span>Storage Layer:</span>
              </span>
              <span
                className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                  storageMode === 'SUPABASE'
                    ? 'bg-emerald-100/80 text-emerald-800'
                    : 'bg-amber-100/80 text-amber-800'
                }`}
              >
                {storageMode === 'SUPABASE' ? 'Supabase DB' : 'Local Session'}
              </span>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingList ? (
                <div className="p-4 text-center text-xs text-slate-400 space-y-2">
                  <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading conversation history...</p>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-medium text-slate-600">No previous sessions</p>
                  <p className="text-[11px] text-slate-400">
                    Click &quot;New Chat&quot; or ask a question to start an investigation.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  const dateStr = new Date(conv.updated_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setActiveConvId(conv.id);
                        setMobileHistoryOpen(false);
                      }}
                      className={`
                        group relative flex items-center justify-between p-2.5 rounded-xl text-xs transition-all cursor-pointer border
                        ${
                          isActive
                            ? 'bg-emerald-50/90 text-emerald-950 border-emerald-600/30 font-semibold shadow-2xs'
                            : 'text-slate-700 hover:bg-white hover:text-slate-900 border-transparent hover:border-slate-200/80'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium leading-tight">{conv.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{dateStr}</p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConversationToDelete(conv);
                        }}
                        title="Delete conversation"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Persistence Note Footer */}
            {!isDurable && (
              <div className="p-2.5 border-t border-slate-200/60 bg-amber-50/60 text-[10px] text-amber-800 flex items-start space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>Local development session active. Connect Supabase for multi-instance persistence.</span>
              </div>
            )}
          </aside>

          {/* Right Panel: Chat Area */}
          <main className="flex-1 flex flex-col h-full min-w-0 bg-white">
            {/* Chat Header Bar */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center space-x-2.5 min-w-0">
                <button
                  onClick={() => setMobileHistoryOpen(true)}
                  className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="View conversation list"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="w-8 h-8 rounded-lg bg-[#064e3b] p-1 flex items-center justify-center shrink-0 shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/stocksentinel-logo.png"
                    alt="StockSentinel AI"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {activeConversation ? activeConversation.title : 'New Investigation'}
                  </h2>
                  <p className="text-[10px] text-slate-400">Inventory Anomaly Reasoning Engine</p>
                </div>
              </div>

              {activeConversation && (
                <button
                  onClick={() => setConversationToDelete(activeConversation)}
                  title="Delete current conversation"
                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors text-xs flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs">Delete Chat</span>
                </button>
              )}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-slate-50/40 via-white to-white">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                /* Empty Chat Starter Screen */
                <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center space-y-6 py-8">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200/80 p-3 flex items-center justify-center shadow-xs">
                    <Sparkles className="w-8 h-8 text-[#064e3b]" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      StockSentinel Inventory Assistant
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                      Ask questions regarding flagged phantom stock-outs, consecutive zero-sales streaks, backroom pallets, and shelf verification walk lists.
                    </p>
                  </div>

                  {/* Starter prompt cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left pt-2">
                    {starterPrompts.map((starter, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(starter.prompt)}
                        className="p-3 rounded-xl border border-slate-200/90 hover:border-emerald-600/40 bg-white hover:bg-emerald-50/40 transition-all text-left shadow-2xs group cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900 group-hover:text-emerald-950">
                            {starter.title}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {starter.prompt}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Message Stream */
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const timeStr = new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                          isUser
                            ? 'bg-slate-800 text-white'
                            : 'bg-[#064e3b] text-white border border-emerald-700/40'
                        }`}
                      >
                        {isUser ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-emerald-200" />}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[85%] sm:max-w-2xl rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-2xs ${
                          isUser
                            ? 'bg-emerald-900 text-white font-medium rounded-tr-xs'
                            : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-xs'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        <div
                          className={`mt-1.5 text-[10px] text-right ${
                            isUser ? 'text-emerald-200/75' : 'text-slate-400'
                          }`}
                        >
                          {timeStr}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Sending status bubble */}
              {sending && (
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-[#064e3b] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Bot className="w-3.5 h-3.5 text-emerald-200" />
                  </div>
                  <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-slate-500 flex items-center space-x-2 shadow-xs">
                    <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing inventory state...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Composer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-white shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center space-x-2"
              >
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputContent}
                    onChange={(e) => setInputContent(e.target.value)}
                    placeholder="Ask about suspicious SKUs, zero-sales streaks, or store anomalies..."
                    disabled={sending}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!inputContent.trim() || sending}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors flex items-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

              <p className="text-[10px] text-center text-slate-400 mt-2">
                StockSentinel AI provides explainable retail diagnostics. Confirm physical shelf counts before updating inventory systems.
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {conversationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 bg-white max-w-sm w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Delete Conversation?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete &quot;{conversationToDelete.title}&quot;? All messages in this session will be permanently removed.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConversationToDelete(null)}
                disabled={deleting}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteConversation}
                disabled={deleting}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                {deleting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
