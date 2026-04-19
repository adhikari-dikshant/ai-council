"use client";

import { useState, useRef, useCallback } from "react";
import type {
  SessionState,
  AgentOpinion,
  Deliberation,
  ChairpersonAnalysis,
  Consensus,
  AgentColor,
} from "@/lib/council/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<AgentColor, { border: string; bg: string; badge: string; bar: string }> = {
  blue: {
    border: "border-blue-500",
    bg: "bg-blue-500/5",
    badge: "bg-blue-500/20 text-blue-300",
    bar: "bg-blue-500",
  },
  red: {
    border: "border-red-500",
    bg: "bg-red-500/5",
    badge: "bg-red-500/20 text-red-300",
    bar: "bg-red-500",
  },
  green: {
    border: "border-green-500",
    bg: "bg-green-500/5",
    badge: "bg-green-500/20 text-green-300",
    bar: "bg-green-500",
  },
  purple: {
    border: "border-purple-500",
    bg: "bg-purple-500/5",
    badge: "bg-purple-500/20 text-purple-300",
    bar: "bg-purple-500",
  },
};

const AGREEMENT_STYLE: Record<string, { dot: string; label: string }> = {
  agree: { dot: "bg-green-400", label: "text-green-400" },
  partial: { dot: "bg-yellow-400", label: "text-yellow-400" },
  disagree: { dot: "bg-red-400", label: "text-red-400" },
};

function SimpleMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) => {
        const parts = line.split(/\*\*([^*]+)\*\*/g);
        const rendered = parts.map((part, j) =>
          j % 2 === 1 ? (
            <strong key={j} className="text-white font-semibold">
              {part}
            </strong>
          ) : (
            part
          )
        );

        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 mt-0.5">
              <span className="text-gray-600 shrink-0 mt-0.5">•</span>
              <span>{rendered.map((p, j) => (typeof p === "string" ? p.replace(/^[-•]\s*/, "") : p))}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <div key={i}>{rendered}</div>;
      })}
    </div>
  );
}

function ConfidenceBar({ value, colorClass }: { value: number; colorClass: string }) {
  return (
    <div className="flex items-center gap-2 mt-3">
      <div className="flex-1 bg-gray-800 rounded-full h-1">
        <div
          className={`h-1 rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 tabular-nums">{value}%</span>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ChairpersonCard({ analysis }: { analysis: ChairpersonAnalysis }) {
  return (
    <div className="animate-fade-in bg-gray-900 border border-amber-500/40 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚖️</span>
        <span className="font-semibold text-amber-400 text-sm tracking-wide">CHAIRPERSON ANALYSIS</span>
      </div>
      <p className="text-white text-sm font-medium mb-3">{analysis.intent}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {analysis.dimensions.map((d) => (
          <span key={d} className="text-xs bg-amber-500/15 text-amber-300 rounded-full px-2.5 py-0.5">
            {d}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500">{analysis.context}</p>
    </div>
  );
}

function AgentCard({ opinion }: { opinion: AgentOpinion }) {
  const c = COLOR_CLASSES[opinion.color];
  return (
    <div
      className={`animate-fade-in ${c.bg} border-l-4 ${c.border} border border-gray-800 rounded-2xl p-5 flex flex-col`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{opinion.emoji}</span>
          <div>
            <div className="font-semibold text-sm text-white">{opinion.agentName}</div>
            <div className="text-xs text-gray-500">{opinion.role}</div>
          </div>
        </div>
        <span className={`text-xs rounded-full px-2 py-0.5 ${c.badge}`}>
          {opinion.confidence}% confident
        </span>
      </div>

      {opinion.assessment && (
        <p className="text-xs text-gray-300 italic border-l-2 border-gray-700 pl-3 mb-3">
          {opinion.assessment}
        </p>
      )}

      <SimpleMarkdown
        text={opinion.content}
        className="text-xs text-gray-400 leading-relaxed space-y-0.5 flex-1"
      />

      <ConfidenceBar value={opinion.confidence} colorClass={c.bar} />
    </div>
  );
}

function DeliberationItem({ d }: { d: Deliberation }) {
  const style = AGREEMENT_STYLE[d.agreement] ?? AGREEMENT_STYLE.partial;
  return (
    <div className="animate-fade-in flex gap-3 bg-gray-900/60 border border-gray-800 rounded-xl p-3.5">
      <span className="text-base shrink-0 mt-0.5">{d.emoji}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-xs text-white">{d.fromAgentName}</span>
          <span className={`flex items-center gap-1 text-xs font-bold ${style.label}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot} inline-block`} />
            {d.agreement.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{d.critique}</p>
      </div>
    </div>
  );
}

function ConsensusPanel({ consensus }: { consensus: Consensus }) {
  return (
    <div className="animate-fade-in bg-gray-900 border border-cyan-500/30 rounded-2xl p-6 shadow-lg shadow-cyan-950/50">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🏛️</span>
        <span className="font-bold text-cyan-400 tracking-wide text-sm">COUNCIL VERDICT</span>
      </div>

      <p className="text-white font-semibold text-base leading-snug mb-3">
        {consensus.recommendation}
      </p>

      <p className="text-gray-400 text-sm mb-4 leading-relaxed">{consensus.reasoning}</p>

      {consensus.keyPoints?.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {consensus.keyPoints.map((pt, i) => (
            <div key={i} className="flex gap-2 text-sm text-gray-300">
              <span className="text-cyan-500 shrink-0">→</span>
              <span>{pt}</span>
            </div>
          ))}
        </div>
      )}

      {consensus.dissent && (
        <p className="text-xs text-gray-600 border-t border-gray-800 pt-3 italic">
          Minority opinion: {consensus.dissent}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 bg-gray-800 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000"
            style={{ width: `${consensus.confidence}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 tabular-nums">
          Council confidence: {consensus.confidence}%
        </span>
      </div>
    </div>
  );
}

function StatusBar({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      {message}
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

  const convene = useCallback(async () => {
    if (!prompt.trim() || running) return;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setRunning(true);
    setSession({ phase: "analyzing", statusMessage: "Starting council session…", opinions: [], deliberations: [] });

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
  };

  const isActive = session.phase !== "idle";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏛️</span>
          <div>
            <h1 className="text-base font-bold text-white leading-none">AI Council</h1>
            <p className="text-xs text-gray-600 mt-0.5">Round-table intelligence</p>
          </div>
        </div>
        {isActive && (
          <button
            onClick={reset}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← New session
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-16">
        {/* Hero + prompt input */}
        {!isActive && (
          <div className="pt-20 pb-10 text-center">
            <h2 className="text-4xl font-bold text-white mb-3">Convene the Council</h2>
            <p className="text-gray-500 mb-10 max-w-lg mx-auto">
              Present a decision. Four specialized AI agents deliberate in parallel, critique each
              other, then reach consensus.
            </p>
          </div>
        )}

        {/* Input form */}
        <div className={isActive ? "pt-8 pb-6" : "pb-6"}>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) convene();
              }}
              placeholder="e.g. Design a scalable SaaS architecture for a startup with 1,000 daily active users…"
              rows={isActive ? 2 : 4}
              disabled={running}
              className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-4 pr-36 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-gray-500 disabled:opacity-50 transition-all"
            />
            <button
              onClick={convene}
              disabled={running || !prompt.trim()}
              className="absolute right-3 bottom-3 bg-white text-black text-xs font-semibold px-4 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {running ? "Convening…" : "Convene →"}
            </button>
          </div>
          <p className="text-xs text-gray-700 mt-1.5 pl-1">⌘ + Enter to convene</p>
        </div>

        {/* Session output */}
        {isActive && (
          <div className="space-y-6">
            {/* Status */}
            {session.statusMessage && <StatusBar message={session.statusMessage} />}

            {/* Error */}
            {session.error && (
              <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-sm text-red-300">
                {session.error}
              </div>
            )}

            {/* Chairperson */}
            {session.chairperson && <ChairpersonCard analysis={session.chairperson} />}

            {/* Council opinions */}
            {session.opinions.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3">
                  Council Positions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {session.opinions.map((o) => (
                    <AgentCard key={o.agentId} opinion={o} />
                  ))}
                </div>
              </div>
            )}

            {/* Deliberation */}
            {session.deliberations.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3">
                  Deliberation
                </h3>
                <div className="space-y-2">
                  {session.deliberations.map((d) => (
                    <DeliberationItem key={d.fromAgentId} d={d} />
                  ))}
                </div>
              </div>
            )}

            {/* Consensus */}
            {session.consensus && <ConsensusPanel consensus={session.consensus} />}
          </div>
        )}
      </main>
    </div>
  );
}
