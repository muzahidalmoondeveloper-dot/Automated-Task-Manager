import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { chatApi } from "../../api/chatApi";
import { useAuth } from "../../context/AuthContext";

// ─── Accepted file types ──────────────────────────────────────────────────────
const ACCEPTED_TYPES = ".pdf,.docx,.txt,.md,.csv,.json";
const MAX_FILE_MB = 20;

// ─── Simple markdown renderer ─────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  lines.forEach((line, i) => {
    const isBullet = /^[•\-\*]\s+/.test(line);
    let content = isBullet ? line.replace(/^[•\-\*]\s+/, "") : line;
    content = content
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, '<code class="bg-slate-700 px-1 rounded text-xs">$1</code>');
    if (isBullet) {
      elements.push(<li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: content }} />);
    } else if (content.trim() === "") {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: content }} />);
    }
  });
  return elements;
}

// ─── File attachment badge (inside message bubble) ────────────────────────────
function FileBadge({ filename }) {
  const ext = filename.split(".").pop().toUpperCase();
  const colorMap = {
    PDF: "bg-red-500/20 text-red-300 border-red-500/30",
    DOCX: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    TXT: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    MD: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    CSV: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    JSON: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium ${colorMap[ext] || "bg-slate-600/20 text-slate-300 border-slate-500/30"}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      {filename}
    </span>
  );
}

// ─── Action pill ──────────────────────────────────────────────────────────────
function ActionPill({ action, onNavigate }) {
  const handleClick = () => {
    if (action.type === "navigate" && action.payload?.path) onNavigate(action.payload.path);
  };
  const colorMap = {
    task_created: "bg-emerald-600/20 text-emerald-300 border-emerald-600/40",
    task_updated: "bg-blue-600/20 text-blue-300 border-blue-600/40",
    task_deleted: "bg-red-600/20 text-red-300 border-red-600/40",
    navigate: "bg-indigo-600/20 text-indigo-300 border-indigo-600/40 cursor-pointer hover:bg-indigo-600/40",
  };
  return (
    <span onClick={handleClick} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${colorMap[action.type] || "bg-slate-700 text-slate-300 border-slate-600"}`}>
      {action.type === "task_created" && "✓ "}
      {action.type === "task_updated" && "✎ "}
      {action.type === "task_deleted" && "✕ "}
      {action.type === "navigate" && "→ "}
      {action.label}
    </span>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, actions, onNavigate }) {
  const isUser = msg.role === "user";

  // Detect file badge: message starts with [📎 ...]
  const fileMatch = msg.content.match(/^\[📎\s+(.+?)\]/);
  const filename = fileMatch ? fileMatch[1] : null;
  const textAfterBadge = filename
    ? msg.content.slice(fileMatch[0].length).trim()
    : msg.content;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white mr-2 flex-shrink-0 mt-1">AI</div>
      )}
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-slate-700 text-slate-100 rounded-tl-sm"}`}>
          {isUser ? (
            <div className="space-y-2">
              {filename && <FileBadge filename={filename} />}
              {textAfterBadge && <p>{textAfterBadge}</p>}
            </div>
          ) : (
            <div>{renderMarkdown(msg.content)}</div>
          )}
        </div>
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5 px-1">
            {actions.map((a, idx) => <ActionPill key={idx} action={a} onNavigate={onNavigate} />)}
          </div>
        )}
        <span className="text-xs text-slate-500 mt-1 px-1">
          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white ml-2 flex-shrink-0 mt-1">Me</div>
      )}
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">AI</div>
      <div className="bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Selected file chip (above the input) ────────────────────────────────────
function SelectedFileChip({ file, onRemove }) {
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  return (
    <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 mb-2">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-200 font-medium truncate">{file.name}</p>
        <p className="text-xs text-slate-500">{sizeMB} MB</p>
      </div>
      <button onClick={onRemove} className="text-slate-400 hover:text-red-400 transition-colors ml-1 flex-shrink-0" title="Remove file">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Session sidebar ──────────────────────────────────────────────────────────
function SessionSidebar({ sessions, currentSessionId, onSelect, onNew, onDelete }) {
  return (
    <div className="w-48 border-r border-slate-700 flex flex-col bg-slate-900 rounded-l-2xl overflow-hidden">
      <div className="p-3 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">History</span>
        <button onClick={onNew} className="text-indigo-400 hover:text-indigo-300 text-lg leading-none" title="New chat">+</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && <p className="text-xs text-slate-500 p-3">No previous chats</p>}
        {sessions.map((s) => (
          <div key={s.id} onClick={() => onSelect(s.id)} className={`group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-800 transition-colors ${s.id === currentSessionId ? "bg-slate-800 border-l-2 border-indigo-500" : ""}`}>
            <span className="text-xs text-slate-300 truncate flex-1">{s.title || "New chat"}</span>
            <button onClick={(e) => { e.stopPropagation(); onDelete(s.id); }} className="hidden group-hover:block text-slate-500 hover:text-red-400 ml-1 text-xs" title="Delete">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quick suggestions ────────────────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  "Show my tasks",
  "Create a task for today",
  "What's overdue?",
  "Summarise my week",
];

// ─── Voice recording indicator ───────────────────────────────────────────────
function VoiceListeningChip({ onStop }) {
  return (
    <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 rounded-xl px-3 py-2 mb-2">
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <p className="text-xs text-red-300 font-medium flex-1">Listening… speak now</p>
      <button
        onClick={onStop}
        className="text-red-400 hover:text-red-300 transition-colors text-xs font-medium"
        type="button"
      >
        Stop
      </button>
    </div>
  );
}

// ─── Voice support detection ──────────────────────────────────────────────────
const voiceSupported =
  typeof window !== "undefined" &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// ─── Main ChatWidget ──────────────────────────────────────────────────────────
export default function ChatWidget() {
  const { user } = useAuth();
  const isTeamMember = user?.role === "team_member";
  const visibleSuggestions = QUICK_SUGGESTIONS.filter(
    (s) => !(isTeamMember && s === "Create a task for today")
  );

  const [isOpen, setIsOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState({});
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);
  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 100); }, [isOpen]);
  useEffect(() => { if (showSidebar) chatApi.listSessions().then(setSessions).catch(() => {}); }, [showSidebar]);

  // Stop recognition when widget closes
  useEffect(() => {
    if (!isOpen && isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  }, [isOpen, isListening]);

  const loadSession = useCallback(async (sessionId) => {
    try {
      const session = await chatApi.getSession(sessionId);
      setCurrentSessionId(session.id);
      setMessages(session.messages.map((m) => ({ ...m, actions: [] })));
    } catch { toast.error("Could not load session."); }
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${MAX_FILE_MB} MB.`);
      return;
    }
    setSelectedFile(file);
    // Reset the input so the same file can be re-selected later
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = useCallback(
    async (text) => {
      const trimmed = (text || input).trim();
      if ((!trimmed && !selectedFile) || isLoading) return;

      const fileToSend = selectedFile;
      setInput("");
      setSelectedFile(null);

      const tempId = Date.now();
      const displayContent = fileToSend
        ? `[📎 ${fileToSend.name}]${trimmed ? `\n\n${trimmed}` : ""}`
        : trimmed;

      const optimisticUser = {
        id: tempId,
        session_id: currentSessionId,
        role: "user",
        content: displayContent,
        created_at: new Date().toISOString(),
        actions: [],
      };
      setMessages((prev) => [...prev, optimisticUser]);
      setIsLoading(true);

      try {
        let response;
        if (fileToSend) {
          response = await chatApi.uploadFile(fileToSend, trimmed, currentSessionId);
        } else {
          response = await chatApi.sendMessage(trimmed, currentSessionId);
        }

        setCurrentSessionId(response.session_id);
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== tempId);
          return [
            ...without,
            { ...response.user_message, actions: [] },
            { ...response.assistant_message, actions: response.actions || [] },
          ];
        });

        if (response.actions?.length) {
          setPendingActions((prev) => ({ ...prev, [response.assistant_message.id]: response.actions }));
        }

        chatApi.listSessions().then(setSessions).catch(() => {});
      } catch (err) {
        toast.error(err.message || "Failed to send.");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } finally {
        setIsLoading(false);
      }
    },
    [input, selectedFile, currentSessionId, isLoading]
  );

  // Keep a stable ref so voice callbacks always call the latest handleSend
  const handleSendRef = useRef(handleSend);
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!voiceSupported || isListening || isLoading) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      setIsListening(false);
      recognitionRef.current = null;
      if (transcript) {
        handleSendRef.current(transcript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        toast.error("Voice recognition failed. Please try again or check microphone permissions.");
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, isLoading]);

  const toggleVoice = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const startNewChat = () => { setCurrentSessionId(null); setMessages([]); setSelectedFile(null); setShowSidebar(false); };

  const handleDeleteSession = async (sessionId) => {
    try {
      await chatApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (sessionId === currentSessionId) startNewChat();
    } catch { toast.error("Could not delete session."); }
  };

  const handleNavigate = (path) => { navigate(path); setIsOpen(false); };

  const canSend = (input.trim() || selectedFile) && !isLoading;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        aria-label="Open AI assistant"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex shadow-2xl rounded-2xl overflow-hidden"
          style={{
            width: showSidebar ? 640 : 400,
            maxWidth: "calc(100vw - 24px)",
            height: 580,
            maxHeight: "calc(100vh - 120px)",
          }}
        >
          {showSidebar && (
            <SessionSidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelect={(id) => { loadSession(id); setShowSidebar(false); }}
              onNew={startNewChat}
              onDelete={handleDeleteSession}
            />
          )}

          <div className="flex flex-col flex-1 bg-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowSidebar((v) => !v)} className="text-slate-400 hover:text-white transition-colors" title="Chat history">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div>
                  <h3 className="text-sm font-semibold text-white">AI Task Assistant</h3>
                  <p className="text-xs text-slate-400">Chat · Voice · Upload files{isTeamMember ? "" : " · Create tasks"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={startNewChat} className="text-slate-400 hover:text-white transition-colors text-lg leading-none" title="New chat">+</button>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-300 font-medium">How can I help you?</p>
                    <p className="text-slate-500 text-xs mt-1">Chat, speak a voice message, upload a file, or paste a transcript</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center mt-1">
                    {visibleSuggestions.map((s) => (
                      <button key={s} onClick={() => handleSend(s)} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-full transition-colors border border-slate-600">
                        {s}
                      </button>
                    ))}
                  </div>
                  {/* File upload hint */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 px-4 py-2 rounded-full transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Upload a file to analyse
                  </button>
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  actions={msg.actions || pendingActions[msg.id] || []}
                  onNavigate={handleNavigate}
                />
              ))}

              {isLoading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="px-4 py-3 bg-slate-900 border-t border-slate-700">
              {/* Voice listening chip */}
              {isListening && <VoiceListeningChip onStop={stopListening} />}

              {/* Selected file chip */}
              {selectedFile && (
                <SelectedFileChip file={selectedFile} onRemove={() => setSelectedFile(null)} />
              )}

              {/* Text + controls */}
              <div className={`flex items-end gap-2 bg-slate-800 rounded-xl border transition-colors px-3 py-2 ${isListening ? "border-red-500/60" : "border-slate-700 focus-within:border-indigo-500"}`}>
                {/* Paperclip button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 text-slate-400 hover:text-indigo-400 transition-colors mb-0.5"
                  title="Attach file (PDF, DOCX, TXT, MD, CSV, JSON)"
                  type="button"
                  disabled={isListening}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isListening
                      ? "Listening… speak your message"
                      : selectedFile
                      ? "Add a message or just send the file…"
                      : "Message AI assistant… (Enter to send)"
                  }
                  disabled={isListening}
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none max-h-32 disabled:cursor-not-allowed"
                  rows={1}
                  style={{ minHeight: "1.5rem" }}
                />

                {/* Mic button */}
                {voiceSupported && (
                  <button
                    onClick={toggleVoice}
                    disabled={isLoading}
                    className={`flex-shrink-0 mb-0.5 transition-all ${
                      isListening
                        ? "text-red-400 hover:text-red-300 animate-pulse"
                        : "text-slate-400 hover:text-indigo-400"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={isListening ? "Stop recording" : "Send a voice message"}
                    type="button"
                  >
                    {isListening ? (
                      // Stop icon when recording
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                      </svg>
                    ) : (
                      // Mic icon when idle
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Send button */}
                <button
                  onClick={() => handleSend()}
                  disabled={!canSend || isListening}
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>

              <p className="text-xs text-slate-600 mt-1.5 text-center">
                PDF · DOCX · TXT · MD · CSV · JSON — max {MAX_FILE_MB} MB
                {voiceSupported && " · 🎙 Voice"}
              </p>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
