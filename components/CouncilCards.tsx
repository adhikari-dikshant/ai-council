"use client";

import type {
    AgentOpinion, Deliberation, ChairpersonAnalysis, Consensus, AgentColor, PeerRankingEntry,
} from "@/lib/council/types";

export const COLOR_CLASSES: Record<AgentColor, { border: string; tint: string; badge: string; bar: string }> = {
    blue:   { border: "border-agent-architect/30", tint: "bg-agent-architect/[0.04]", badge: "bg-agent-architect/10 text-agent-architect", bar: "bg-agent-architect" },
    red:    { border: "border-agent-security/30",  tint: "bg-agent-security/[0.04]",  badge: "bg-agent-security/10 text-agent-security",  bar: "bg-agent-security"  },
    green:  { border: "border-agent-cost/30",      tint: "bg-agent-cost/[0.04]",      badge: "bg-agent-cost/10 text-agent-cost",          bar: "bg-agent-cost"      },
    purple: { border: "border-agent-devil/30",     tint: "bg-agent-devil/[0.04]",     badge: "bg-agent-devil/10 text-agent-devil",        bar: "bg-agent-devil"     },
};

export const AGREE_STYLE: Record<string, { dot: string; label: string }> = {
    agree:    { dot: "bg-agent-cost",     label: "text-agent-cost"     },
    partial:  { dot: "bg-honey",          label: "text-honey"          },
    disagree: { dot: "bg-agent-security", label: "text-agent-security" },
};

export const VOTE_STYLE: Record<"approve" | "reject" | "revise", { bg: string; label: string }> = {
    approve: { bg: "bg-agent-cost/10 text-agent-cost border-agent-cost/30",             label: "Approve" },
    reject:  { bg: "bg-agent-security/10 text-agent-security border-agent-security/30", label: "Reject"  },
    revise:  { bg: "bg-honey/10 text-honey border-honey/30",                            label: "Revise"  },
};

export const RISK_STYLE: Record<"low" | "medium" | "high", { bg: string; label: string }> = {
    low:    { bg: "bg-agent-cost/10 text-agent-cost border-agent-cost/30",             label: "Low risk"    },
    medium: { bg: "bg-honey/10 text-honey border-honey/30",                            label: "Medium risk" },
    high:   { bg: "bg-agent-security/10 text-agent-security border-agent-security/30", label: "High risk"   },
};

export const DECISION_STYLE: Record<"approved" | "rejected" | "revision_required", { bg: string; label: string }> = {
    approved:           { bg: "bg-agent-cost/10 text-agent-cost border-agent-cost/30",             label: "Approved"          },
    rejected:           { bg: "bg-agent-security/10 text-agent-security border-agent-security/30", label: "Rejected"          },
    revision_required:  { bg: "bg-honey/10 text-honey border-honey/30",                            label: "Revision required" },
};

export function MD({ text, className }: { text: string; className?: string }) {
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

export function ChairpersonCard({ a }: { a: ChairpersonAnalysis }) {
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

export function AgentCard({ o }: { o: AgentOpinion }) {
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

export function DelibItem({ d }: { d: Deliberation }) {
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

export function VerdictCard({ c }: { c: Consensus }) {
    return (
        <div className="animate-fade-in bg-paper-light border border-rust/30 rounded-2xl p-6 shadow-[0_8px_32px_-8px_rgba(204,120,92,0.18)]">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <span>🏛️</span>
                    <span className="font-bold text-rust tracking-[0.15em] text-xs uppercase">Council Verdict</span>
                </div>
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
                    {c.keyPoints.map((pt, i) => (
                        <div key={i} className="flex gap-2 text-[14px] text-ink-soft leading-relaxed">
                            <span className="text-rust shrink-0 font-semibold">→</span>
                            <span>{pt}</span>
                        </div>
                    ))}
                </div>
            )}
            {c.dissent && (
                <p className="text-xs text-ink-faint border-t border-line-soft pt-3 italic leading-relaxed">
                    Minority opinion: {c.dissent}
                </p>
            )}
            <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 bg-paper-beige rounded-full h-1.5">
                    <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-rust-deep to-rust transition-all duration-1000"
                        style={{ width: `${c.confidence}%` }}
                    />
                </div>
                <span className="text-xs text-ink-muted tabular-nums">Council confidence: {c.confidence}%</span>
            </div>
        </div>
    );
}

export function PeerRankingsSection({
    opinions,
    peerRankings,
}: {
    opinions: AgentOpinion[];
    peerRankings: PeerRankingEntry[];
}) {
    const agentScores = opinions.map((o) => {
        const received = peerRankings.flatMap((pr) => pr.rankings).filter((r) => r.targetAgentId === o.agentId);
        const avg = received.length > 0 ? received.reduce((sum, r) => sum + r.rank, 0) / received.length : null;
        return { agentId: o.agentId, agentName: o.agentName, emoji: o.emoji, color: o.color, avg };
    }).sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99));

    // maxRank is number of peers each agent is ranked against (opinions.length - 1)
    const maxRank = opinions.length - 1;
    const medals = ["🥇", "🥈", "🥉", "4️⃣"];

    return (
        <div className="animate-fade-in bg-paper-light border border-line rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span>🏅</span>
                <span className="font-semibold text-ink-faint text-[11px] tracking-[0.15em] uppercase">Peer Rankings</span>
                <span className="ml-auto text-[10px] text-ink-mist">Each agent anonymously ranked the others&apos; responses</span>
            </div>
            <div className="space-y-2.5">
                {agentScores.map((agent, i) => {
                    const pct = agent.avg !== null && maxRank > 1
                        ? Math.max(0, ((maxRank - agent.avg) / (maxRank - 1)) * 100)
                        : 50;
                    const c = COLOR_CLASSES[agent.color];
                    return (
                        <div key={agent.agentId} className="flex items-center gap-3">
                            <span className="w-5 text-center text-sm shrink-0">{medals[i] ?? "·"}</span>
                            <span className="text-base shrink-0">{agent.emoji}</span>
                            <span className="text-xs font-medium text-ink w-28 shrink-0 truncate">{agent.agentName}</span>
                            <div className="flex-1 bg-paper-beige rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-ink-muted tabular-nums w-14 text-right shrink-0">
                                {agent.avg !== null ? `${agent.avg.toFixed(1)} avg` : "—"}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function StatusDots({ message }: { message: string }) {
    return (
        <div className="flex items-center gap-2.5 text-sm text-ink-muted py-1">
            <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1 h-1 bg-rust rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
            </span>
            {message}
        </div>
    );
}
