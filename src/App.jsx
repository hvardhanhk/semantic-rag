import { useState, useRef, useEffect, useCallback } from "react";

// ── Sample document ──────────────────────────────────────────────────────────
const SAMPLE_DOC = `Micro-Frontend Architecture: Patterns and Trade-offs

The micro-frontend pattern extends the principles of microservices to the frontend layer, allowing independent teams to own, deploy, and iterate on separate vertical slices of a user interface. While this approach solves genuine organizational scaling problems, it introduces a distinct class of technical challenges that engineers must navigate carefully.

Module Federation, introduced in Webpack 5, is currently the dominant mechanism for runtime integration of micro-frontends. It enables a host application to dynamically load remote modules at runtime without bundling them at build time. This creates a shared dependency graph across independently deployed applications, dramatically reducing bundle duplication while enabling true independent deployability.

The most significant trade-off in Module Federation is version skew. When a remote exposes a component using React 18.2, and the host is running 18.0, the runtime behavior can be unpredictable. Teams must enforce strict shared dependency contracts through singleton configuration, ensuring only one instance of critical libraries is instantiated across the entire federated graph.

Performance is a core concern in micro-frontend architectures. Each remote module represents an additional network round-trip during the initial page load. Lazy loading and prefetching strategies, combined with aggressive caching headers on remote entry points, are essential to keep Time-to-Interactive competitive with monolithic counterparts.

Communication between micro-frontends should avoid tight coupling. Custom DOM events, a shared event bus via a singleton service, or URL-driven state are preferred over direct imports between remotes. The goal is to preserve the deployment independence that justifies the architecture in the first place.

Testing micro-frontends requires a layered strategy. Unit tests operate within each remote in isolation. Contract tests verify the interface boundaries between host and remotes. End-to-end tests validate the composed application. Skipping any of these layers creates dangerous blind spots at integration boundaries.

Monorepo tooling — particularly Turborepo and Nx — has become nearly essential for managing micro-frontend codebases. Affected-change detection, remote caching, and task pipeline orchestration dramatically improve CI/CD performance when dozens of packages share a single repository.

The decision to adopt micro-frontends should be driven by organizational structure, not technical novelty. Conway's Law suggests that teams naturally produce architectures that mirror their communication patterns. If your organization is not structured around independent vertical teams, the coordination overhead of micro-frontends will outweigh their benefits.`;

// ── Chunk document into paragraphs ───────────────────────────────────────────
function chunkDocument(text) {
  return text.split("\n\n").filter(p => p.trim().length > 40).map((text, i) => ({
    id: i + 1,
    text: text.trim(),
    isTitle: i === 0,
  }));
}

// ── Parse citation markers [1], [2] from AI response ─────────────────────────
function parseCitations(text) {
  const cited = new Set();
  const matches = text.matchAll(/\[(\d+)\]/g);
  for (const m of matches) cited.add(parseInt(m[1], 10));
  return cited;
}

function renderWithCitations(text) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m) return (
      <sup key={i} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, background: "#92400E", color: "#FDE68A", fontSize: 9, fontWeight: 700, borderRadius: "50%", marginLeft: 2, marginRight: 1, fontFamily: "IBM Plex Mono, monospace", verticalAlign: "super", lineHeight: 1, flexShrink: 0 }}>{m[1]}</sup>
    );
    return <span key={i}>{part}</span>;
  });
}

// ── Suggested questions ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  "What is Module Federation and what problem does it solve?",
  "What are the main performance concerns?",
  "How should micro-frontends communicate with each other?",
  "When should I NOT adopt micro-frontends?",
];

const SKILLS = ["RAG Pipeline", "Chunking Strategy", "Citation Parsing", "Semantic Retrieval", "Streaming LLM", "Document UI"];

export default function App() {
  const [chunks]        = useState(() => chunkDocument(SAMPLE_DOC));
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [citedChunks, setCitedChunks]  = useState(new Set());
  const [hoveredChunk, setHoveredChunk] = useState(null);
  const chatEndRef   = useRef(null);
  const abortRef     = useRef(null);
  const docPanelRef  = useRef(null);
  const chunkRefs    = useRef({});

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Scroll doc panel to first cited chunk
  useEffect(() => {
    if (citedChunks.size === 0) return;
    const firstId = Math.min(...citedChunks);
    const el = chunkRefs.current[firstId];
    if (el && docPanelRef.current) {
      docPanelRef.current.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
    }
  }, [citedChunks]);

  const ask = useCallback(async (q) => {
    const query = q || question;
    if (!query.trim() || isLoading) return;

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const newMessages = [...messages, { role: "user", content: query }];
    setMessages(newMessages);
    setQuestion("");
    setIsLoading(true);
    setCitedChunks(new Set());

    const context = chunks.map(c => `[${c.id}] ${c.text}`).join("\n\n");

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, 
          "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          stream: true,
          system: `You are a precise technical assistant with access to a document split into numbered chunks.
Answer the user's question using ONLY the provided chunks.
ALWAYS cite your sources inline using [N] notation exactly where you use information from chunk N.
Use multiple citations like [2][5] when combining sources.
Be concise and direct. If the answer isn't in the chunks, say so clearly.`,
          messages: [
            ...newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: `Document chunks:\n${context}\n\nQuestion: ${query}` }
          ],
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let full = "";

      setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              full += parsed.delta.text;
              const cited = parseCitations(full);
              setCitedChunks(cited);
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: full, streaming: true };
                return updated;
              });
            }
          } catch { /* skip */ }
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: full, streaming: false };
        return updated;
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}`, error: true }]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [question, messages, chunks, isLoading]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D6CCBB; border-radius: 2px; }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .chunk-block { transition: background 0.2s ease, border-color 0.2s ease; }
        .suggest-btn { transition: all 0.15s ease; }
        .suggest-btn:hover { background: #FEF3C7 !important; border-color: #D97706 !important; color: #92400E !important; }
        .send-btn { transition: all 0.15s ease; }
        .send-btn:hover:not(:disabled) { background: #B45309 !important; }
        .send-btn:disabled { opacity: .45; cursor: not-allowed; }
        .qa-input:focus { outline: none; border-color: #D97706 !important; box-shadow: 0 0 0 3px #FDE68A55; }
      `}</style>

      <div style={{ fontFamily: "IBM Plex Sans, sans-serif", background: "#FAF8F4", minHeight: "100vh", color: "#1C1917", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <header style={{ background: "#FFFCF7", borderBottom: "1px solid #E8E0D0", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "linear-gradient(135deg, #D97706 0%, #92400E 100%)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◈</div>
            <div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Semantic<span style={{ color: "#D97706" }}>.</span></div>
              <div style={{ fontSize: 10, color: "#A8966E", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>RAG Document Intelligence</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 20, padding: "3px 12px", fontSize: 10, color: "#92400E", fontFamily: "IBM Plex Mono, monospace", fontWeight: 600 }}>{chunks.length} chunks indexed</div>
            {citedChunks.size > 0 && (
              <div style={{ background: "#D97706", borderRadius: 20, padding: "3px 12px", fontSize: 10, color: "#FFF", fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, animation: "fadeUp .2s ease" }}>
                {citedChunks.size} source{citedChunks.size > 1 ? "s" : ""} cited
              </div>
            )}
          </div>
        </header>

        {/* Main panels */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

          {/* ── Left: Document viewer ── */}
          <div ref={docPanelRef} style={{ width: "44%", borderRight: "1px solid #E8E0D0", overflow: "auto", background: "#FFFCF7", padding: "28px 24px" }}>
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #EDE8DE" }}>
              <div style={{ fontSize: 10, color: "#A8966E", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Source Document</div>
              <div style={{ fontSize: 11, color: "#C4B49A" }}>Hover a chunk to preview · cited sources highlight automatically</div>
            </div>

            {chunks.map(chunk => {
              const isCited   = citedChunks.has(chunk.id);
              const isHovered = hoveredChunk === chunk.id;
              return (
                <div key={chunk.id} ref={el => chunkRefs.current[chunk.id] = el}
                  className="chunk-block"
                  onMouseEnter={() => setHoveredChunk(chunk.id)}
                  onMouseLeave={() => setHoveredChunk(null)}
                  style={{
                    position: "relative", marginBottom: 14, padding: "14px 16px 14px 20px",
                    borderRadius: 6, border: `1px solid ${isCited ? "#D97706" : isHovered ? "#E8D8C0" : "#EDE8DE"}`,
                    background: isCited ? "#FFFBEB" : isHovered ? "#FAFAF7" : "transparent",
                    borderLeft: `3px solid ${isCited ? "#D97706" : isHovered ? "#E8D0A0" : "#EDE8DE"}`,
                    cursor: "default",
                  }}>
                  {isCited && (
                    <div style={{ position: "absolute", top: -1, right: -1, background: "#D97706", color: "#fff", fontSize: 8, fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, padding: "2px 7px", borderRadius: "0 5px 0 5px", letterSpacing: "0.08em" }}>CITED</div>
                  )}
                  <div style={{ position: "absolute", top: 14, left: -10, width: 20, height: 20, background: isCited ? "#D97706" : "#E8E0D0", color: isCited ? "#fff" : "#8A7A68", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, transition: "all .2s" }}>{chunk.id}</div>
                  <p style={{ fontFamily: chunk.isTitle ? "Lora, serif" : "IBM Plex Sans, sans-serif", fontSize: chunk.isTitle ? 15 : 12.5, fontWeight: chunk.isTitle ? 600 : 400, color: isCited ? "#78350F" : "#44403C", lineHeight: 1.7, fontStyle: chunk.isTitle ? "normal" : "normal" }}>{chunk.text}</p>
                </div>
              );
            })}
          </div>

          {/* ── Right: Q&A chat ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#FAF8F4" }}>
            {/* Suggestions */}
            {messages.length === 0 && (
              <div style={{ padding: "28px 24px 0", animation: "fadeUp .4s ease" }}>
                <div style={{ fontSize: 10, color: "#A8966E", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Suggested questions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} className="suggest-btn"
                      onClick={() => ask(s)}
                      style={{ textAlign: "left", padding: "10px 14px", background: "#FFFCF7", border: "1px solid #E8E0D0", borderRadius: 6, fontSize: 12.5, color: "#57534E", cursor: "pointer", fontFamily: "IBM Plex Sans, sans-serif", lineHeight: 1.4 }}>
                      <span style={{ color: "#D97706", marginRight: 8, fontWeight: 600 }}>→</span>{s}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 20, padding: "14px 16px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "#92400E", fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>HOW IT WORKS</div>
                  <div style={{ fontSize: 11.5, color: "#78350F", lineHeight: 1.6 }}>The document is split into <strong>{chunks.length} indexed chunks</strong>. Your question is sent alongside all chunks. The AI retrieves and cites the relevant ones — highlighted in the document panel.</div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 20, animation: "fadeUp .25s ease", display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ fontSize: 9, color: "#A8966E", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>
                    {m.role === "user" ? "You" : "Semantic AI"}
                  </div>
                  <div style={{
                    maxWidth: "90%", padding: "12px 16px", borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                    background: m.role === "user" ? "#D97706" : "#FFFCF7",
                    color: m.role === "user" ? "#FFF" : m.error ? "#B91C1C" : "#1C1917",
                    border: m.role === "user" ? "none" : `1px solid ${m.error ? "#FCA5A5" : "#E8E0D0"}`,
                    fontSize: 13, lineHeight: "1.7", fontFamily: "IBM Plex Sans, sans-serif",
                  }}>
                    {m.role === "assistant" ? renderWithCitations(m.content) : m.content}
                    {m.streaming && <span style={{ display: "inline-block", width: 7, height: 13, background: "#D97706", marginLeft: 3, verticalAlign: "text-bottom", animation: "blink .7s step-end infinite" }} />}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #E8E0D0", background: "#FFFCF7", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea className="qa-input"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask anything about this document…"
                  rows={2}
                  style={{ flex: 1, padding: "10px 14px", background: "#FAF8F4", border: "1.5px solid #E8E0D0", borderRadius: 8, fontSize: 13, fontFamily: "IBM Plex Sans, sans-serif", color: "#1C1917", resize: "none", lineHeight: 1.5, transition: "border-color .15s, box-shadow .15s" }}
                />
                <button className="send-btn"
                  onClick={() => ask()}
                  disabled={isLoading || !question.trim()}
                  style={{ padding: "10px 20px", background: "#D97706", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.05em", whiteSpace: "nowrap", height: 42 }}>
                  {isLoading ? "…" : "ASK →"}
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#C4B49A" }}>Enter to send · Shift+Enter for new line</div>
            </div>
          </div>
        </div>

        {/* Skills strip */}
        <div style={{ borderTop: "1px solid #E8E0D0", padding: "8px 24px", background: "#FFFCF7", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, overflowX: "auto" }}>
          <span style={{ fontSize: 9, color: "#C4B49A", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", marginRight: 4 }}>Skills demonstrated</span>
          {SKILLS.map(s => (
            <span key={s} style={{ fontSize: 10, color: "#A8966E", border: "1px solid #E8D8C0", borderRadius: 3, padding: "2px 8px", whiteSpace: "nowrap", fontFamily: "IBM Plex Mono, monospace", background: "#FEF9EE" }}>{s}</span>
          ))}
        </div>
      </div>
    </>
  );
}
