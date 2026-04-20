"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type {
  SessionState,
  AgentOpinion,
  Deliberation,
  ChairpersonAnalysis,
  Consensus,
  AgentColor,
} from "@/lib/council/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<
  AgentColor,
  { border: string; tint: string; badge: string; bar: string }
> = {
  blue: {
    border: "border-agent-architect/30",
    tint: "bg-agent-architect/[0.04]",
    badge: "bg-agent-architect/10 text-agent-architect",
    bar: "bg-agent-architect",
  },
  red: {
    border: "border-agent-security/30",
    tint: "bg-agent-security/[0.04]",
    badge: "bg-agent-security/10 text-agent-security",
    bar: "bg-agent-security",
  },
  green: {
    border: "border-agent-cost/30",
    tint: "bg-agent-cost/[0.04]",
    badge: "bg-agent-cost/10 text-agent-cost",
    bar: "bg-agent-cost",
  },
  purple: {
    border: "border-agent-devil/30",
    tint: "bg-agent-devil/[0.04]",
    badge: "bg-agent-devil/10 text-agent-devil",
    bar: "bg-agent-devil",
  },
};

const AGREEMENT_STYLE: Record<string, { dot: string; label: string }> = {
  agree: { dot: "bg-agent-cost", label: "text-agent-cost" },
  partial: { dot: "bg-honey", label: "text-honey" },
  disagree: { dot: "bg-agent-security", label: "text-agent-security" },
};

function SimpleMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) => {
        const parts = line.split(/\*\*([^*]+)\*\*/g);
        const rendered = parts.map((part, j) =>
          j % 2 === 1 ? (
            <strong key={j} className="text-ink font-semibold">
              {part}
            </strong>
          ) : (
            part
          )
        );
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 mt-0.5">
              <span className="text-ink-faint shrink-0 mt-0.5">•</span>
              <span>
                {rendered.map((p) => (typeof p === "string" ? p.replace(/^[-•]\s*/, "") : p))}
              </span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <div key={i}>{rendered}</div>;
      })}
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ChairpersonCard({ analysis }: { analysis: ChairpersonAnalysis }) {
  return (
    <div className="animate-fade-in bg-paper-light border border-honey/25 rounded-2xl p-5 shadow-[0_1px_3px_rgba(45,31,22,0.05)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚖️</span>
        <span className="font-semibold text-honey text-xs tracking-[0.15em] uppercase">
          Chairperson Analysis
        </span>
      </div>
      <p className="text-ink text-[15px] font-medium mb-3 leading-snug">{analysis.intent}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {analysis.dimensions.map((d) => (
          <span key={d} className="text-xs bg-honey/10 text-honey rounded-full px-2.5 py-0.5 font-medium">
            {d}
          </span>
        ))}
      </div>
      <p className="text-xs text-ink-muted leading-relaxed">{analysis.context}</p>
    </div>
  );
}

function AgentCard({ opinion }: { opinion: AgentOpinion }) {
  const c = COLOR_CLASSES[opinion.color];
  return (
    <div className={`animate-fade-in ${c.tint} border ${c.border} rounded-2xl p-5 flex flex-col shadow-[0_1px_2px_rgba(45,31,22,0.04)]`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{opinion.emoji}</span>
          <div>
            <div className="font-semibold text-sm text-ink">{opinion.agentName}</div>
            <div className="text-xs text-ink-faint">{opinion.role}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${c.badge}`}>
            {opinion.confidence}%
          </span>
          <span className="text-[10px] text-ink-mist font-mono bg-paper-beige px-1.5 py-0.5 rounded">
            {opinion.modelLabel}
          </span>
        </div>
      </div>

      {opinion.assessment && (
        <p className="text-[13px] text-ink-soft italic border-l-2 border-line pl-3 mb-3 leading-relaxed">
          {opinion.assessment}
        </p>
      )}

      <SimpleMarkdown
        text={opinion.content}
        className="text-[13px] text-ink-muted leading-relaxed space-y-0.5 flex-1"
      />

      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 bg-paper-beige rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all duration-700 ${c.bar}`}
            style={{ width: `${opinion.confidence}%` }}
          />
        </div>
        <span className="text-xs text-ink-muted tabular-nums">{opinion.confidence}%</span>
      </div>
    </div>
  );
}

function DeliberationItem({ d }: { d: Deliberation }) {
  const style = AGREEMENT_STYLE[d.agreement] ?? AGREEMENT_STYLE.partial;
  return (
    <div className="animate-fade-in flex gap-3 bg-paper-light border border-line-soft rounded-xl p-3.5">
      <span className="text-base shrink-0 mt-0.5">{d.emoji}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-xs text-ink">{d.fromAgentName}</span>
          <span className={`flex items-center gap-1 text-[10px] font-bold tracking-wider ${style.label}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot} inline-block`} />
            {d.agreement.toUpperCase()}
          </span>
        </div>
        <p className="text-[13px] text-ink-muted leading-relaxed">{d.critique}</p>
      </div>
    </div>
  );
}

function ConsensusPanel({ consensus }: { consensus: Consensus }) {
  return (
    <div className="animate-fade-in bg-paper-light border border-rust/30 rounded-2xl p-6 shadow-[0_8px_32px_-8px_rgba(204,120,92,0.18),0_2px_4px_rgba(45,31,22,0.06)]">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🏛️</span>
        <span className="font-bold text-rust tracking-[0.15em] text-xs uppercase">
          Council Verdict
        </span>
      </div>
      <p className="text-ink font-semibold text-lg leading-snug mb-3">
        {consensus.recommendation}
      </p>
      <p className="text-ink-soft text-[14px] mb-4 leading-relaxed">{consensus.reasoning}</p>
      {consensus.keyPoints?.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {consensus.keyPoints.map((pt, i) => (
            <div key={i} className="flex gap-2 text-[14px] text-ink-soft leading-relaxed">
              <span className="text-rust shrink-0 font-semibold">→</span>
              <span>{pt}</span>
            </div>
          ))}
        </div>
      )}
      {consensus.dissent && (
        <p className="text-xs text-ink-faint border-t border-line-soft pt-3 italic leading-relaxed">
          Minority opinion: {consensus.dissent}
        </p>
      )}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 bg-paper-beige rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-rust-deep to-rust transition-all duration-1000"
            style={{ width: `${consensus.confidence}%` }}
          />
        </div>
        <span className="text-xs text-ink-muted tabular-nums">
          Council confidence: {consensus.confidence}%
        </span>
      </div>
    </div>
  );
}

function StatusBar({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-ink-muted py-1">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 bg-rust rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      {message}
    </div>
  );
}

// ─── prompt input (shared, used in both hero and fixed-bottom) ────────────────

function PromptInput({
  value,
  onChange,
  onSubmit,
  running,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  running: boolean;
  compact?: boolean;
}) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
        }}
        placeholder="e.g. Design a scalable SaaS architecture for a startup with 1,000 daily active users…"
        rows={compact ? 2 : 4}
        disabled={running}
        className="w-full bg-paper-light border border-line rounded-2xl p-4 pr-36 text-[15px] text-ink placeholder-ink-mist resize-none focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 disabled:opacity-50 transition-all shadow-[0_1px_2px_rgba(45,31,22,0.03)]"
      />
      <button
        onClick={onSubmit}
        disabled={running || !value.trim()}
        className="absolute right-3 bottom-3 bg-rust text-paper-light text-sm font-semibold px-4 py-2 rounded-xl hover:bg-rust-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {running ? "Convening…" : "Convene →"}
      </button>
      {!compact && (
        <p className="text-xs text-ink-mist mt-2 pl-1">⌘ + Enter to convene</p>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

const INITIAL_SESSION: SessionState = {
  phase: "idle",
  statusMessage: "",
  opinions: [],
  deliberations: [],
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [session, setSession] = useState<SessionState>(INITIAL_SESSION);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isActive = session.phase !== "idle";

  // Auto-scroll to bottom whenever new content arrives
  useEffect(() => {
    if (isActive) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [
    isActive,
    session.chairperson,
    session.opinions.length,
    session.deliberations.length,
    session.consensus,
    session.statusMessage,
  ]);

  const convene = useCallback(async () => {
    if (!prompt.trim() || running) return;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setRunning(true);
    setPrompt("");
    setSession({
      phase: "analyzing",
      statusMessage: "Starting council session…",
      opinions: [],
      deliberations: [],
    });

    try {
      const response = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              const ev = currentEvent;
              currentEvent = "";

              setSession((prev) => {
                switch (ev) {
                  case "status":
                    return { ...prev, phase: data.phase, statusMessage: data.message };
                  case "chairperson":
                    return { ...prev, chairperson: data as ChairpersonAnalysis };
                  case "agent_opinion":
                    return { ...prev, opinions: [...prev.opinions, data as AgentOpinion] };
                  case "deliberation":
                    return { ...prev, deliberations: [...prev.deliberations, data as Deliberation] };
                  case "consensus":
                    return { ...prev, consensus: data as Consensus };
                  case "done":
                    return { ...prev, phase: "done", statusMessage: "" };
                  case "error":
                    return { ...prev, phase: "error", statusMessage: "", error: data.message };
                  default:
                    return prev;
                }
              });
            } catch {
              currentEvent = "";
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setSession((prev) => ({
          ...prev,
          phase: "error",
          statusMessage: "",
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    } finally {
      setRunning(false);
    }
  }, [prompt, running]);

  const reset = () => {
    abortRef.current?.abort();
    setSession(INITIAL_SESSION);
    setRunning(false);
    setPrompt("");
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* Sticky header */}
      <header className="border-b border-line-soft px-6 py-4 flex items-center justify-between bg-paper/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🏛️</span>
          <div>
            <h1 className="text-base font-bold text-ink leading-none tracking-tight">AI Council</h1>
            <p className="text-[11px] text-ink-faint mt-0.5">Round-table intelligence</p>
          </div>
        </div>
        {isActive && (
          <button
            onClick={reset}
            className="text-xs text-ink-muted hover:text-ink transition-colors font-medium"
          >
            ← New session
          </button>
        )}
      </header>

      {/* ── IDLE: centered hero layout ── */}
      {!isActive && (
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-10">
              <h2 className="text-5xl font-bold text-ink mb-4 tracking-tight">
                Convene the Council
              </h2>
              <p className="text-ink-muted text-lg leading-relaxed">
                Present a decision. Four AI models deliberate in parallel, critique each other,
                then reach consensus.
              </p>
            </div>
            <PromptInput
              value={prompt}
              onChange={setPrompt}
              onSubmit={convene}
              running={running}
              compact={false}
            />
            {/* model roster hint */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                { emoji: "🏗️", label: "GPT-4o mini" },
                { emoji: "🔐", label: "Claude 3 Haiku" },
                { emoji: "💸", label: "Gemini 1.5 Flash" },
                { emoji: "😈", label: "Llama 3.1 8B" },
              ].map(({ emoji, label }) => (
                <span
                  key={label}
                  className="text-xs text-ink-faint bg-paper-light border border-line rounded-full px-3 py-1"
                >
                  {emoji} {label}
                </span>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ── ACTIVE: scrollable session + fixed bottom input ── */}
      {isActive && (
        <>
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 pt-6 pb-8 space-y-6">
              {session.statusMessage && <StatusBar message={session.statusMessage} />}

              {session.error && (
                <div className="bg-agent-security/10 border border-agent-security/30 rounded-xl p-4 text-sm text-agent-security">
                  {session.error}
                </div>
              )}

              {session.chairperson && <ChairpersonCard analysis={session.chairperson} />}

              {session.opinions.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">
                    Council Positions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {session.opinions.map((o) => (
                      <AgentCard key={o.agentId} opinion={o} />
                    ))}
                  </div>
                </div>
              )}

              {session.deliberations.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">
                    Deliberation
                  </h3>
                  <div className="space-y-2">
                    {session.deliberations.map((d) => (
                      <DeliberationItem key={d.fromAgentId} d={d} />
                    ))}
                  </div>
                </div>
              )}

              {session.consensus && <ConsensusPanel consensus={session.consensus} />}

              {/* invisible anchor for auto-scroll */}
              <div ref={bottomRef} />
            </div>
          </main>

          {/* Fixed bottom input bar */}
          <div className="sticky bottom-0 z-20 border-t border-line-soft bg-paper/90 backdrop-blur-md px-4 py-3">
            <div className="max-w-4xl mx-auto">
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onSubmit={convene}
                running={running}
                compact={true}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
