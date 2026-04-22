"use client";

import { useState, useEffect } from "react";
import type { SessionState, CouncilPhase } from "@/lib/council/types";
import {
    ChairpersonCard, AgentCard, DelibItem, VerdictCard, PeerRankingsSection,
} from "./CouncilCards";

// ── helpers ───────────────────────────────────────────────────────────────────

const PHASE_ORDER: CouncilPhase[] = [
    "idle", "analyzing", "thinking", "deliberating", "ranking", "synthesizing", "done", "error",
];
function phaseGte(a: CouncilPhase, b: CouncilPhase) {
    return PHASE_ORDER.indexOf(a) >= PHASE_ORDER.indexOf(b);
}

// ── step definitions ──────────────────────────────────────────────────────────

interface StepDef {
    id: string;
    title: string;
    subtitle: (s: SessionState) => string;
    isDone: (s: SessionState) => boolean;
    hasContent: (s: SessionState) => boolean;
    render: (s: SessionState) => React.ReactNode;
}

const STEPS: StepDef[] = [
    {
        id: "chairperson",
        title: "Chairperson Analysis",
        subtitle: (s) => s.chairperson?.scope ?? "",
        isDone: (s) => phaseGte(s.phase, "thinking") && !!s.chairperson,
        hasContent: (s) => !!s.chairperson,
        render: (s) => s.chairperson ? <ChairpersonCard a={s.chairperson} /> : null,
    },
    {
        id: "positions",
        title: "Council Positions",
        subtitle: (s) => s.opinions.length > 0 ? `${s.opinions.length} agent${s.opinions.length !== 1 ? "s" : ""}` : "",
        isDone: (s) => phaseGte(s.phase, "deliberating") && s.opinions.length > 0,
        hasContent: (s) => s.opinions.length > 0,
        render: (s) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {s.opinions.map((o) => <AgentCard key={o.agentId} o={o} />)}
            </div>
        ),
    },
    {
        id: "deliberation",
        title: "Deliberation",
        subtitle: (s) => {
            if (!s.deliberations.length) return "";
            const a = s.deliberations.filter((d) => d.agreement === "agree").length;
            const d = s.deliberations.filter((d) => d.agreement === "disagree").length;
            return `${a} agree · ${d} disagree`;
        },
        isDone: (s) => phaseGte(s.phase, "ranking") && s.deliberations.length > 0,
        hasContent: (s) => s.deliberations.length > 0,
        render: (s) => (
            <div className="space-y-2">
                {s.deliberations.map((d) => <DelibItem key={d.fromAgentId} d={d} />)}
            </div>
        ),
    },
    {
        id: "rankings",
        title: "Peer Rankings",
        subtitle: (s) => s.peerRankings?.length ? "Anonymized evaluation" : "",
        isDone: (s) => phaseGte(s.phase, "synthesizing") && !!(s.peerRankings?.length),
        hasContent: (s) => !!(s.peerRankings?.length && s.opinions.length > 0),
        render: (s) =>
            s.peerRankings?.length && s.opinions.length > 0
                ? <PeerRankingsSection opinions={s.opinions} peerRankings={s.peerRankings} />
                : null,
    },
    {
        id: "verdict",
        title: "Council Verdict",
        subtitle: (s) => {
            if (!s.consensus?.decision) return "";
            return { approved: "Approved", rejected: "Rejected", revision_required: "Revision required" }[s.consensus.decision] ?? "";
        },
        isDone: (s) => !!s.consensus,
        hasContent: (s) => !!s.consensus,
        render: (s) => s.consensus ? <VerdictCard c={s.consensus} /> : null,
    },
];

// ── icons ─────────────────────────────────────────────────────────────────────

function CheckIcon() {
    return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    );
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            className={`w-3.5 h-3.5 shrink-0 text-ink-mist transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
    );
}

function BounceDots() {
    return (
        <span className="flex gap-0.5 ml-1">
            {[0, 1, 2].map((i) => (
                <span key={i} className="w-1 h-1 rounded-full bg-rust animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
        </span>
    );
}

// ── main component ────────────────────────────────────────────────────────────

export function CouncilStepper({ session }: { session: SessionState }) {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    // Auto-expand whichever step just became active or was just completed
    useEffect(() => {
        const activeIdx = STEPS.findIndex((s) => s.hasContent(session) && !s.isDone(session));
        const lastDoneIdx = STEPS.map((s) => s.isDone(session)).lastIndexOf(true);
        const target = activeIdx !== -1 ? activeIdx : lastDoneIdx;
        if (target >= 0) {
            setExpanded((prev) => {
                if (prev.has(target)) return prev;
                const next = new Set(prev);
                next.add(target);
                return next;
            });
        }
    }, [
        session.phase,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        !!session.chairperson,
        session.opinions.length,
        session.deliberations.length,
        session.peerRankings?.length,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        !!session.consensus,
    ]);

    const toggle = (i: number) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });
    };

    return (
        <div className="bg-paper-light border border-line rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(45,31,22,0.05)]">
            {STEPS.map((step, i) => {
                const done = step.isDone(session);
                const hasContent = step.hasContent(session);
                const isActive = hasContent && !done;
                const isPending = !hasContent && !done;
                const isExpanded = expanded.has(i) && hasContent;
                const isLast = i === STEPS.length - 1;
                const subtitle = step.subtitle(session);

                return (
                    <div key={step.id}>
                        {/* ── step row ── */}
                        <button
                            onClick={() => hasContent && toggle(i)}
                            disabled={!hasContent}
                            className={`
                                w-full flex items-center gap-4 px-5 py-4 text-left transition-colors
                                ${hasContent ? "cursor-pointer" : "cursor-default"}
                                ${isExpanded ? "bg-paper-warm/60" : "hover:bg-paper-beige/40"}
                                ${i !== 0 ? "border-t border-line-soft" : ""}
                            `}
                        >
                            {/* Circle */}
                            <div className={`
                                relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                                text-xs font-bold transition-all duration-300
                                ${done
                                    ? "bg-agent-cost text-white shadow-[0_0_0_3px_rgba(74,163,101,0.12)]"
                                    : isActive
                                        ? "bg-rust text-white shadow-[0_0_0_3px_rgba(204,120,92,0.15)]"
                                        : "bg-paper-beige text-ink-mist border border-line"
                                }
                            `}>
                                {done ? <CheckIcon /> : <span>{i + 1}</span>}
                                {/* Connector line below (positioned absolute to overlap the border between rows) */}
                                {!isLast && (
                                    <span className={`
                                        absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-4 mt-0
                                        ${done ? "bg-agent-cost/30" : isActive ? "bg-rust/20" : "bg-line"}
                                    `} />
                                )}
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-semibold text-sm leading-tight ${isPending ? "text-ink-mist" : "text-ink"}`}>
                                        {step.title}
                                    </span>
                                    {subtitle && (
                                        <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
                                            done
                                                ? "bg-agent-cost/10 text-agent-cost"
                                                : isActive
                                                    ? "bg-rust/10 text-rust"
                                                    : "text-ink-mist"
                                        }`}>
                                            {subtitle}
                                        </span>
                                    )}
                                    {isActive && <BounceDots />}
                                </div>
                            </div>

                            {/* Chevron */}
                            {hasContent && <ChevronIcon open={isExpanded} />}
                        </button>

                        {/* ── expanded content ── */}
                        {isExpanded && (
                            <div className="px-5 pb-5 border-t border-line-soft bg-paper-warm/30">
                                <div className="pt-4">
                                    {step.render(session)}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
