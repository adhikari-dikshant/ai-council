"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useCallback, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import type {
  SessionState, AgentOpinion, Deliberation,
  ChairpersonAnalysis, Consensus, AgentColor,
} from "@/lib/council/types";
import type { ConversationSummary } from "@/components/Sidebar";

// ─── colour map ───────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<AgentColor, { border: string; tint: string; badge: string; bar: string }> = {
  blue:   { border: "border-agent-architect/30", tint: "bg-agent-architect/[0.04]", badge: "bg-agent-architect/10 text-agent-architect", bar: "bg-agent-architect" },
  red:    { border: "border-agent-security/30",  tint: "bg-agent-security/[0.04]",  badge: "bg-agent-security/10 text-agent-security",  bar: "bg-agent-security"  },
  green:  { border: "border-agent-cost/30",      tint: "bg-agent-cost/[0.04]",      badge: "bg-agent-cost/10 text-agent-cost",          bar: "bg-agent-cost"      },
  purple: { border: "border-agent-devil/30",     tint: "bg-agent-devil/[0.04]",     badge: "bg-agent-devil/10 text-agent-devil",        bar: "bg-agent-devil"     },
};

const AGREE_STYLE: Record<string, { dot: string; label: string }> = {
  agree:    { dot: "bg-agent-cost",     label: "text-agent-cost"     },
  partial:  { dot: "bg-honey",          label: "text-honey"          },
  disagree: { dot: "bg-agent-security", label: "text-agent-security" },
};

const VOTE_STYLE: Record<"approve" | "reject" | "revise", { bg: string; label: string }> = {
  approve: { bg: "bg-agent-cost/10 text-agent-cost border-agent-cost/30",         label: "Approve" },
  reject:  { bg: "bg-agent-security/10 text-agent-security border-agent-security/30", label: "Reject"  },
  revise:  { bg: "bg-honey/10 text-honey border-honey/30",                        label: "Revise"  },
};

const RISK_STYLE: Record<"low" | "medium" | "high", { bg: string; label: string }> = {
  low:    { bg: "bg-agent-cost/10 text-agent-cost border-agent-cost/30",         label: "Low risk"    },
  medium: { bg: "bg-honey/10 text-honey border-honey/30",                        label: "Medium risk" },
  high:   { bg: "bg-agent-security/10 text-agent-security border-agent-security/30", label: "High risk"   },
};

const DECISION_STYLE: Record<"approved" | "rejected" | "revision_required", { bg: string; label: string }> = {
  approved:           { bg: "bg-agent-cost/10 text-agent-cost border-agent-cost/30",         label: "Approved" },
  rejected:           { bg: "bg-agent-security/10 text-agent-security border-agent-security/30", label: "Rejected" },
  revision_required:  { bg: "bg-honey/10 text-honey border-honey/30",                        label: "Revision required" },
};

// ─── tiny markdown renderer ───────────────────────────────────────────────────

function MD({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {text.split("\n").map((line, i) => {
        const parts = line.split(/\*\*([^*]+)\*\*/g);
        const rendered = parts.map((p, j) =>
          j % 2 === 1 ? <strong key={j} className="text-ink font-semibold">{p}</strong> : p
        );
        if (line.startsWith("- ") || line.startsWith("• "))
          return <div key={i} className="flex gap-2 mt-0.5"><span className="text-ink-faint shrink-0">•</span><span>{rendered.map((p) => (typeof p === "string" ? p.replace(/^[-•]\s*/, "") : p))}</span></div>;
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <div key={i}>{rendered}</div>;
      })}
    </div>
  );
}

// ─── council cards ────────────────────────────────────────────────────────────

function ChairpersonCard({ a }: { a: ChairpersonAnalysis }) {
  return (
    <div className="animate-fade-in bg-paper-light border border-honey/25 rounded-2xl p-5 shadow-[0_1px_3px_rgba(45,31,22,0.05)]">
      <div className="flex items-center gap-2 mb-3">
        <span>⚖️</span>
        <span className="font-semibold text-honey text-xs tracking-[0.15em] uppercase">Chairperson Analysis</span>
      </div>
      <p className="text-ink text-[15px] font-medium mb-3 leading-snug">{a.intent}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {a.dimensions.map((d) => <span key={d} className="text-xs bg-honey/10 text-honey rounded-full px-2.5 py-0.5 font-medium">{d}</span>)}
      </div>
      <p className="text-xs text-ink-muted leading-relaxed">{a.context}</p>
    </div>
  );
}

function AgentCard({ o }: { o: AgentOpinion }) {
  const c = COLOR_CLASSES[o.color];
  return (
    <div className={`animate-fade-in ${c.tint} border ${c.border} rounded-2xl p-5 flex flex-col shadow-[0_1px_2px_rgba(45,31,22,0.04)]`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{o.emoji}</span>
          <div>
            <div className="font-semibold text-sm text-ink">{o.agentName}</div>
            <div className="text-xs text-ink-faint">{o.role}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
          {o.vote && (
            <span className={`text-[10px] font-semibold tracking-wider uppercase rounded-full px-2 py-0.5 border ${VOTE_STYLE[o.vote].bg}`}>
              {VOTE_STYLE[o.vote].label}
            </span>
          )}
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${c.badge}`}>{o.confidence}%</span>
          <span className="text-[10px] text-ink-mist font-mono bg-paper-beige px-1.5 py-0.5 rounded">{o.modelLabel}</span>
        </div>
      </div>
      {o.assessment && <p className="text-[13px] text-ink-soft italic border-l-2 border-line pl-3 mb-3 leading-relaxed">{o.assessment}</p>}
      <MD text={o.content} className="text-[13px] text-ink-muted leading-relaxed space-y-0.5 flex-1" />
      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 bg-paper-beige rounded-full h-1">
          <div className={`h-1 rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${o.confidence}%` }} />
        </div>
        <span className="text-xs text-ink-muted tabular-nums">{o.confidence}%</span>
      </div>
    </div>
  );
}

function DelibItem({ d }: { d: Deliberation }) {
  const s = AGREE_STYLE[d.agreement] ?? AGREE_STYLE.partial;
  return (
    <div className="animate-fade-in flex gap-3 bg-paper-light border border-line-soft rounded-xl p-3.5">
      <span className="text-base shrink-0 mt-0.5">{d.emoji}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-xs text-ink">{d.fromAgentName}</span>
          <span className={`flex items-center gap-1 text-[10px] font-bold tracking-wider ${s.label}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} inline-block`} />
            {d.agreement.toUpperCase()}
          </span>
        </div>
        <p className="text-[13px] text-ink-muted leading-relaxed">{d.critique}</p>
      </div>
    </div>
  );
}

function VerdictCard({ c }: { c: Consensus }) {
  return (
    <div className="animate-fade-in bg-paper-light border border-rust/30 rounded-2xl p-6 shadow-[0_8px_32px_-8px_rgba(204,120,92,0.18)]">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2"><span>🏛️</span><span className="font-bold text-rust tracking-[0.15em] text-xs uppercase">Council Verdict</span></div>
        <div className="flex items-center gap-2 flex-wrap">
          {c.decision && (
            <span className={`text-[11px] font-semibold tracking-wider uppercase rounded-full px-3 py-1 border ${DECISION_STYLE[c.decision].bg}`}>
              {DECISION_STYLE[c.decision].label}
            </span>
          )}
          {c.riskLevel && (
            <span className={`text-[11px] font-semibold tracking-wider uppercase rounded-full px-3 py-1 border ${RISK_STYLE[c.riskLevel].bg}`}>
              {RISK_STYLE[c.riskLevel].label}
            </span>
          )}
        </div>
      </div>
      <p className="text-ink font-semibold text-lg leading-snug mb-3">{c.recommendation}</p>
      <p className="text-ink-soft text-[14px] mb-4 leading-relaxed">{c.reasoning}</p>
      {c.keyPoints?.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {c.keyPoints.map((pt, i) => <div key={i} className="flex gap-2 text-[14px] text-ink-soft leading-relaxed"><span className="text-rust shrink-0 font-semibold">→</span><span>{pt}</span></div>)}
        </div>
      )}
      {c.dissent && <p className="text-xs text-ink-faint border-t border-line-soft pt-3 italic leading-relaxed">Minority opinion: {c.dissent}</p>}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 bg-paper-beige rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-gradient-to-r from-rust-deep to-rust transition-all duration-1000" style={{ width: `${c.confidence}%` }} />
        </div>
        <span className="text-xs text-ink-muted tabular-nums">Council confidence: {c.confidence}%</span>
      </div>
    </div>
  );
}

function StatusDots({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-ink-muted py-1">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => <span key={i} className="w-1 h-1 bg-rust rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </span>
      {message}
    </div>
  );
}

const PROJECT_TYPES = [
  "New AI feature",
  "Third-party AI integration",
  "Data / ML pipeline",
  "Internal AI tool",
  "Customer-facing AI",
  "Other",
];

function ProposalForm({
  title, setTitle, description, setDescription, projectType, setProjectType, onSubmit, running,
}: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  projectType: string; setProjectType: (v: string) => void;
  onSubmit: () => void; running: boolean;
}) {
  const canSubmit = title.trim() && description.trim();
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-ink-soft mb-1.5">Proposal title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Add GPT-4 summarization to our document review flow"
          disabled={running}
          className="w-full bg-paper-light border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-mist focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 disabled:opacity-50 transition-all shadow-[0_1px_2px_rgba(45,31,22,0.03)]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-soft mb-1.5">Project type <span className="text-ink-mist font-normal">(optional)</span></label>
        <select
          value={projectType}
          onChange={(e) => setProjectType(e.target.value)}
          disabled={running}
          className="w-full bg-paper-light border border-line rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 disabled:opacity-50 transition-all shadow-[0_1px_2px_rgba(45,31,22,0.03)]"
        >
          <option value="">Select type…</option>
          {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-soft mb-1.5">Description &amp; context</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(); }}
          placeholder="What does this project do? What data does it use? What decisions will it drive? Known risks, constraints, or unknowns…"
          rows={5}
          disabled={running}
          className="w-full bg-paper-light border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-mist resize-none focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 disabled:opacity-50 transition-all shadow-[0_1px_2px_rgba(45,31,22,0.03)]"
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={running || !canSubmit}
        className="w-full bg-rust text-paper-light text-sm font-semibold px-4 py-3 rounded-xl hover:bg-rust-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {running ? "Convening council…" : "Submit for council review →"}
      </button>
      <p className="text-center text-xs text-ink-mist">⌘ + Enter to submit</p>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

const IDLE: SessionState = { phase: "idle", statusMessage: "", opinions: [], deliberations: [] };

export default function Home() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("");
  const [session, setSession] = useState<SessionState>(IDLE);
  const [running, setRunning] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isActive = session.phase !== "idle";

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Load conversation list from Supabase (only when logged in)
  const fetchConversations = useCallback(async () => {
    setLoadingConvos(true);
    const { data } = await supabase
      .from("conversations")
      .select("id, title, created_at")
      .order("created_at", { ascending: false });
    setConversations((data ?? []) as ConversationSummary[]);
    setLoadingConvos(false);
  }, [supabase]);

  useEffect(() => { if (user) fetchConversations(); else setLoadingConvos(false); }, [user, fetchConversations]);

  // Auto-scroll
  useEffect(() => {
    if (isActive) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isActive, session.chairperson, session.opinions.length, session.deliberations.length, session.consensus, session.statusMessage]);

  const loadConversation = useCallback(async (id: string) => {
    const { data } = await supabase.from("conversations").select("*").eq("id", id).single();
    if (!data) return;
    setSession({ ...(data.data as SessionState), phase: "done", statusMessage: "" });
    setCurrentId(id);
    setTitle(""); setDescription(""); setProjectType("");
  }, [supabase]);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    if (currentId === id) { setSession(IDLE); setCurrentId(null); }
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, [supabase, currentId]);

  const newSession = useCallback(() => {
    abortRef.current?.abort();
    setSession(IDLE); setCurrentId(null); setRunning(false);
    setTitle(""); setDescription(""); setProjectType("");
  }, []);

  const saveSession = useCallback(async (titleText: string, promptText: string, data: SessionState) => {
    if (!user) return;
    const saveTitle = titleText.length > 60 ? titleText.slice(0, 60) + "…" : titleText;
    const { data: row } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: saveTitle, prompt: promptText, data })
      .select("id, title, created_at")
      .single();
    if (row) {
      setCurrentId(row.id);
      setConversations((prev) => [row as ConversationSummary, ...prev]);
    }
  }, [supabase, user]);

  const convene = useCallback(async () => {
    if (!title.trim() || !description.trim() || running) return;
    const proposalTitle = title.trim();
    const promptText = [
      projectType ? `Project type: ${projectType}` : "",
      `Proposal: ${proposalTitle}`,
      "",
      description.trim(),
    ].filter(Boolean).join("\n");
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setRunning(true); setCurrentId(null);

    let live: SessionState = { phase: "analyzing", statusMessage: "Starting…", opinions: [], deliberations: [] };
    const update = (fn: (s: SessionState) => SessionState) => { live = fn(live); setSession({ ...live }); };
    update(() => ({ phase: "analyzing", statusMessage: "Starting council session…", opinions: [], deliberations: [] }));

    try {
      const res = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { currentEvent = line.slice(7).trim(); continue; }
          if (!line.startsWith("data: ") || !currentEvent) continue;
          try {
            const data = JSON.parse(line.slice(6));
            const ev = currentEvent; currentEvent = "";
            switch (ev) {
              case "status":        update((s) => ({ ...s, phase: data.phase, statusMessage: data.message })); break;
              case "chairperson":   update((s) => ({ ...s, chairperson: data as ChairpersonAnalysis })); break;
              case "agent_opinion": update((s) => ({ ...s, opinions: [...s.opinions, data as AgentOpinion] })); break;
              case "deliberation":  update((s) => ({ ...s, deliberations: [...s.deliberations, data as Deliberation] })); break;
              case "consensus":     update((s) => ({ ...s, consensus: data as Consensus })); break;
              case "done":          update((s) => ({ ...s, phase: "done", statusMessage: "" })); if (user) await saveSession(proposalTitle, promptText, live); break;
              case "error":         update((s) => ({ ...s, phase: "error", statusMessage: "", error: data.message })); break;
            }
          } catch { currentEvent = ""; }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError")
        update((s) => ({ ...s, phase: "error", statusMessage: "", error: err instanceof Error ? err.message : String(err) }));
    } finally { setRunning(false); }
  }, [title, description, projectType, running, saveSession, user]);

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {user && (
        <Sidebar
          conversations={conversations} currentId={currentId ?? undefined}
          onNew={newSession} onSelect={loadConversation} onDelete={deleteConversation}
          user={{ name: user.user_metadata?.full_name ?? user.email ?? null, email: user.email ?? null, image: user.user_metadata?.avatar_url ?? null }}
          loading={loadingConvos}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden shrink-0 flex items-center justify-between px-4 py-3 border-b border-line-soft bg-paper-warm">
          {user ? (
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-ink-soft hover:text-ink hover:bg-paper-beige transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : <div className="w-8" />}
          <span className="text-sm font-bold text-ink">🏛️ AI Council</span>
          {!user ? (
            <a href="/login" className="text-sm font-semibold text-rust hover:text-rust-deep transition-colors">Sign in</a>
          ) : <div className="w-8" />}
        </header>

        {!isActive ? (
          <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 overflow-y-auto relative">
            {!user && (
              <div className="hidden md:flex absolute top-4 right-4 items-center gap-3">
                <a href="/login" className="text-sm font-medium text-ink-soft hover:text-ink transition-colors">Sign in</a>
                <a href="/login" className="text-sm font-semibold bg-rust text-paper-light px-4 py-1.5 rounded-xl hover:bg-rust-deep transition-colors shadow-sm">Sign up</a>
              </div>
            )}
            <div className="w-full max-w-2xl py-6 sm:py-10">
              <div className="text-center mb-6 sm:mb-8">
                <h2 className="text-3xl sm:text-5xl font-bold text-ink mb-3 sm:mb-4 tracking-tight">Submit an AI Proposal</h2>
                <p className="text-ink-muted text-sm sm:text-lg leading-relaxed">
                  Four specialised agents review your proposal in parallel, deliberate,<br className="hidden sm:block" /> and return a decision with a risk assessment.
                </p>
              </div>
              <ProposalForm
                title={title} setTitle={setTitle}
                description={description} setDescription={setDescription}
                projectType={projectType} setProjectType={setProjectType}
                onSubmit={convene} running={running}
              />
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[["🏗️","Architect · GPT-4o mini"],["🔐","Security · Claude 3 Haiku"],["💸","Cost · Gemini 1.5 Flash"],["😈","Devil's Advocate · Llama 3.1 8B"]].map(([e,l]) => (
                  <span key={l} className="text-xs text-ink-faint bg-paper-light border border-line rounded-full px-3 py-1">{e} {l}</span>
                ))}
              </div>
              {!user && (
                <p className="text-center text-xs text-ink-mist mt-6">
                  <a href="/login" className="text-rust hover:text-rust-deep underline underline-offset-2">Sign in</a> to save your decision history.
                </p>
              )}
            </div>
          </main>
        ) : (
          <>
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-6 space-y-4 sm:space-y-6">
                {session.statusMessage && <StatusDots message={session.statusMessage} />}
                {session.error && <div className="bg-agent-security/10 border border-agent-security/30 rounded-xl p-4 text-sm text-agent-security">{session.error}</div>}

                {session.chairperson && (
                  <div className="flex justify-end">
                    <div className="bg-rust/10 border border-rust/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-lg text-[14px] text-ink-soft leading-relaxed">
                      {session.chairperson.intent}
                    </div>
                  </div>
                )}

                {session.chairperson && <ChairpersonCard a={session.chairperson} />}

                {session.opinions.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">Council Positions</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {session.opinions.map((o) => <AgentCard key={o.agentId} o={o} />)}
                    </div>
                  </div>
                )}

                {session.deliberations.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">Deliberation</h3>
                    <div className="space-y-2">
                      {session.deliberations.map((d) => <DelibItem key={d.fromAgentId} d={d} />)}
                    </div>
                  </div>
                )}

                {session.consensus && <VerdictCard c={session.consensus} />}
                <div ref={bottomRef} />
              </div>
            </main>

            <div className="shrink-0 border-t border-line-soft bg-paper/90 backdrop-blur-md px-4 sm:px-6 py-3">
              <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
                <p className="text-xs text-ink-mist">
                  {running ? "Council is deliberating…" : session.phase === "done" ? "Decision recorded." : ""}
                </p>
                <button
                  onClick={newSession}
                  disabled={running}
                  className="bg-rust text-paper-light text-sm font-semibold px-4 py-2 rounded-xl hover:bg-rust-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Start new proposal →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
