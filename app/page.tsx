"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useCallback, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { StatusDots } from "@/components/CouncilCards";
import { CouncilStepper } from "@/components/CouncilStepper";
import type {
    SessionState, AgentOpinion, Deliberation, ChairpersonAnalysis, Consensus, PeerRankingEntry,
} from "@/lib/council/types";
import type { ConversationSummary } from "@/components/Sidebar";
import type { DecisionOutcome } from "@/lib/types";

const PROJECT_TYPES = [
    "New AI feature",
    "Third-party AI integration",
    "Data / ML pipeline",
    "Internal AI tool",
    "Customer-facing AI",
    "Other",
];

function PromptBox({ value, onChange, onSubmit, running, compact = false }: {
    value: string; onChange: (v: string) => void; onSubmit: () => void; running: boolean; compact?: boolean;
}) {
    return (
        <div className="relative">
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(); }}
                placeholder="Ask the council anything…"
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
            {!compact && <p className="text-xs text-ink-mist mt-2 pl-1">⌘ + Enter to convene</p>}
        </div>
    );
}

function ProposalForm({ title, setTitle, description, setDescription, projectType, setProjectType, onSubmit, running }: {
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
                    type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Add GPT-4 summarization to our document review flow"
                    disabled={running}
                    className="w-full bg-paper-light border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-mist focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 disabled:opacity-50 transition-all shadow-[0_1px_2px_rgba(45,31,22,0.03)]"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Project type <span className="text-ink-mist font-normal">(optional)</span></label>
                <select
                    value={projectType} onChange={(e) => setProjectType(e.target.value)} disabled={running}
                    className="w-full bg-paper-light border border-line rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 disabled:opacity-50 transition-all shadow-[0_1px_2px_rgba(45,31,22,0.03)]"
                >
                    <option value="">Select type…</option>
                    {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Description &amp; context</label>
                <textarea
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(); }}
                    placeholder="What does this project do? What data does it use? What decisions will it drive? Known risks, constraints, or unknowns…"
                    rows={5} disabled={running}
                    className="w-full bg-paper-light border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-mist resize-none focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 disabled:opacity-50 transition-all shadow-[0_1px_2px_rgba(45,31,22,0.03)]"
                />
            </div>
            <button
                onClick={onSubmit} disabled={running || !canSubmit}
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
    const [mode, setMode] = useState<"chat" | "proposal">("chat");
    const [prompt, setPrompt] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [projectType, setProjectType] = useState("");
    const [session, setSession] = useState<SessionState>(IDLE);
    const [running, setRunning] = useState(false);
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [loadingConvos, setLoadingConvos] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [initialCid, setInitialCid] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const isActive = session.phase !== "idle";

    // Read ?cid param on mount (from sidebar navigation on proposals pages)
    useEffect(() => {
        const cid = new URLSearchParams(window.location.search).get("cid");
        if (cid) { setInitialCid(cid); window.history.replaceState({}, "", "/"); }

        // Read ?mode=proposal param (from "New proposal" button on proposals page)
        const m = new URLSearchParams(window.location.search).get("mode");
        if (m === "proposal") { setMode("proposal"); window.history.replaceState({}, "", "/"); }
    }, []);

    // Auth
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));
        return () => subscription.unsubscribe();
    }, [supabase]);

    const fetchConversations = useCallback(async () => {
        setLoadingConvos(true);
        const { data } = await supabase.from("conversations").select("id, title, created_at").order("created_at", { ascending: false });
        setConversations((data ?? []) as ConversationSummary[]);
        setLoadingConvos(false);
    }, [supabase]);

    useEffect(() => { if (user) fetchConversations(); else setLoadingConvos(false); }, [user, fetchConversations]);

    const loadConversation = useCallback(async (id: string) => {
        const { data } = await supabase.from("conversations").select("*").eq("id", id).single();
        if (!data) return;
        setSession({ ...(data.data as SessionState), phase: "done", statusMessage: "" });
        setCurrentId(id);
        setPrompt(""); setTitle(""); setDescription(""); setProjectType("");
    }, [supabase]);

    // Load initial conversation from ?cid once user + conversations are ready
    useEffect(() => {
        if (user && initialCid) { loadConversation(initialCid); setInitialCid(null); }
    }, [user, initialCid, loadConversation]);

    useEffect(() => {
        if (isActive) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [isActive, session.chairperson, session.opinions.length, session.deliberations.length, session.consensus, session.statusMessage]);

    const deleteConversation = useCallback(async (id: string) => {
        if (!confirm("Delete this session? This cannot be undone.")) return;
        await supabase.from("conversations").delete().eq("id", id);
        if (currentId === id) { setSession(IDLE); setCurrentId(null); }
        setConversations((prev) => prev.filter((c) => c.id !== id));
    }, [supabase, currentId]);

    const newSession = useCallback(() => {
        abortRef.current?.abort();
        setSession(IDLE); setCurrentId(null); setRunning(false);
        setPrompt(""); setTitle(""); setDescription(""); setProjectType("");
    }, []);

    const saveSession = useCallback(async (
        titleText: string, promptText: string, data: SessionState,
        proposalMeta?: { title: string; description: string; projectType: string },
    ) => {
        if (!user) return;
        const saveTitle = titleText.length > 60 ? titleText.slice(0, 60) + "…" : titleText;

        const { data: row } = await supabase
            .from("conversations")
            .insert({ user_id: user.id, title: saveTitle, prompt: promptText, data })
            .select("id, title, created_at").single();
        if (row) { setCurrentId(row.id); setConversations((prev) => [row as ConversationSummary, ...prev]); }

        if (proposalMeta) {
            const aiDecision = data.consensus?.decision as DecisionOutcome | undefined;
            await supabase.from("proposals").insert({
                author_id: user.id,
                title: proposalMeta.title.length > 200 ? proposalMeta.title.slice(0, 200) + "…" : proposalMeta.title,
                project_type: proposalMeta.projectType || null,
                description: proposalMeta.description,
                status: aiDecision ?? "submitted",
                ai_review: data,
                ai_decision: aiDecision ?? null,
                risk_level: data.consensus?.riskLevel ?? null,
            });
        }
    }, [supabase, user]);

    const convene = useCallback(async () => {
        if (running) return;
        let promptText: string, saveTitle: string;
        if (mode === "chat") {
            if (!prompt.trim()) return;
            promptText = prompt.trim(); saveTitle = promptText;
        } else {
            if (!title.trim() || !description.trim()) return;
            saveTitle = title.trim();
            promptText = [projectType ? `Project type: ${projectType}` : "", `Proposal: ${saveTitle}`, "", description.trim()].filter(Boolean).join("\n");
        }

        abortRef.current?.abort();
        const abort = new AbortController();
        abortRef.current = abort;
        setRunning(true); setCurrentId(null);
        if (mode === "chat") setPrompt("");

        let live: SessionState = { phase: "analyzing", statusMessage: "Starting…", opinions: [], deliberations: [] };
        const update = (fn: (s: SessionState) => SessionState) => { live = fn(live); setSession({ ...live }); };
        update(() => ({ phase: "analyzing", statusMessage: "Starting council session…", opinions: [], deliberations: [] }));

        try {
            const res = await fetch("/api/council", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: promptText, mode }), signal: abort.signal,
            });
            if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "", currentEvent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
                for (const line of lines) {
                    if (line.startsWith("event: ")) { currentEvent = line.slice(7).trim(); continue; }
                    if (!line.startsWith("data: ") || !currentEvent) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        const ev = currentEvent; currentEvent = "";
                        switch (ev) {
                            case "status": update((s) => ({ ...s, phase: data.phase, statusMessage: data.message })); break;
                            case "chairperson": update((s) => ({ ...s, chairperson: data as ChairpersonAnalysis })); break;
                            case "agent_opinion": update((s) => ({ ...s, opinions: [...s.opinions, data as AgentOpinion] })); break;
                            case "deliberation": update((s) => ({ ...s, deliberations: [...s.deliberations, data as Deliberation] })); break;
                            case "peer_ranking": update((s) => ({ ...s, peerRankings: [...(s.peerRankings ?? []), data as PeerRankingEntry] })); break;
                            case "consensus": update((s) => ({ ...s, consensus: data as Consensus })); break;
                            case "done": update((s) => ({ ...s, phase: "done", statusMessage: "" })); if (user) await saveSession(saveTitle, promptText, live, mode === "proposal" ? { title, description, projectType } : undefined); break;
                            case "error": update((s) => ({ ...s, phase: "error", statusMessage: "", error: data.message })); break;
                        }
                    } catch { currentEvent = ""; }
                }
            }
        } catch (err) {
            if ((err as Error).name !== "AbortError")
                update((s) => ({ ...s, phase: "error", statusMessage: "", error: err instanceof Error ? err.message : String(err) }));
        } finally { setRunning(false); }
    }, [mode, prompt, title, description, projectType, running, saveSession, user]);

    return (
        <div className="flex h-screen overflow-hidden bg-paper">
            {user && (
                <Sidebar
                    conversations={conversations} currentId={currentId ?? undefined}
                    onNew={newSession} onSelect={loadConversation} onDelete={deleteConversation}
                    user={{ id: user.id, name: user.user_metadata?.full_name ?? user.email ?? null, email: user.email ?? null, image: user.user_metadata?.avatar_url ?? null }}
                    loading={loadingConvos} open={sidebarOpen} onClose={() => setSidebarOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
                            <div className="flex justify-center mb-6 sm:mb-8">
                                <div className="inline-flex bg-paper-light border border-line rounded-full p-1 shadow-[0_1px_2px_rgba(45,31,22,0.03)]">
                                    <button onClick={() => setMode("chat")} className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${mode === "chat" ? "bg-rust text-paper-light shadow-sm" : "text-ink-soft hover:text-ink"}`}>
                                        💬 Chat
                                    </button>
                                    <button onClick={() => setMode("proposal")} className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${mode === "proposal" ? "bg-rust text-paper-light shadow-sm" : "text-ink-soft hover:text-ink"}`}>
                                        📋 Proposal
                                    </button>
                                </div>
                            </div>

                            <div className="text-center mb-6 sm:mb-8">
                                <h2 className="text-3xl sm:text-5xl font-bold text-ink mb-3 sm:mb-4 tracking-tight">
                                    {mode === "chat" ? "Convene the Council" : "Submit an AI Proposal"}
                                </h2>
                                <p className="text-ink-muted text-sm sm:text-lg leading-relaxed">
                                    {mode === "chat" ? <>Present any decision. Four AI models deliberate in parallel,<br className="hidden sm:block" /> critique each other, then reach consensus.</> : <>Four specialised agents review your proposal in parallel, deliberate,<br className="hidden sm:block" /> and return a decision with a risk assessment.</>}
                                </p>
                            </div>

                            {mode === "chat" ? (
                                <PromptBox value={prompt} onChange={setPrompt} onSubmit={convene} running={running} />
                            ) : (
                                <ProposalForm title={title} setTitle={setTitle} description={description} setDescription={setDescription} projectType={projectType} setProjectType={setProjectType} onSubmit={convene} running={running} />
                            )}

                            <div className="mt-6 flex flex-wrap justify-center gap-2">
                                {mode === "chat" ? (
                                    <span className="text-xs text-ink-faint bg-paper-light border border-line rounded-full px-4 py-1.5 italic">
                                        🪄 Council assembled for your question
                                    </span>
                                ) : (
                                    [["🏗️", "Architect · GPT-4o mini"], ["🔐", "Security · Claude 3 Haiku"], ["💸", "Cost · Gemini 1.5 Flash"], ["😈", "Devil's Advocate · Llama 3.1 8B"]].map(([e, l]) => (
                                        <span key={l} className="text-xs text-ink-faint bg-paper-light border border-line rounded-full px-3 py-1">{e} {l}</span>
                                    ))
                                )}
                            </div>
                            {!user && (
                                <p className="text-center text-xs text-ink-mist mt-6">
                                    <a href="/login" className="text-rust hover:text-rust-deep underline underline-offset-2">Sign in</a> to save your {mode === "chat" ? "conversations" : "decision history"}.
                                </p>
                            )}
                        </div>
                    </main>
                ) : (
                    <>
                        <main className="flex-1 overflow-y-auto">
                            <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6 pb-6 space-y-4">
                                {/* User prompt bubble */}
                                {session.chairperson && (
                                    <div className="flex justify-end">
                                        <div className="bg-rust/10 border border-rust/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-lg text-[14px] text-ink-soft leading-relaxed">
                                            {session.chairperson.intent}
                                        </div>
                                    </div>
                                )}

                                {/* Initial loading (before first event arrives) */}
                                {session.statusMessage && !session.chairperson && (
                                    <StatusDots message={session.statusMessage} />
                                )}

                                {session.error && (
                                    <div className="bg-agent-security/10 border border-agent-security/30 rounded-xl p-4 text-sm text-agent-security">
                                        {session.error}
                                    </div>
                                )}

                                {/* Connected stepper — all phases as clickable steps */}
                                {session.chairperson && <CouncilStepper session={session} />}

                                <div ref={bottomRef} />
                            </div>
                        </main>

                        <div className="shrink-0 border-t border-line-soft bg-paper/90 backdrop-blur-md px-4 sm:px-6 py-3">
                            <div className="max-w-3xl mx-auto">
                                {mode === "chat" ? (
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <PromptBox value={prompt} onChange={setPrompt} onSubmit={convene} running={running} compact />
                                        </div>
                                        {currentId && !running && (
                                            <button
                                                onClick={() => deleteConversation(currentId)}
                                                title="Delete this session"
                                                className="shrink-0 mb-[3px] p-2 rounded-xl text-ink-mist hover:text-rust hover:bg-rust/10 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            {currentId && !running && (
                                                <button
                                                    onClick={() => deleteConversation(currentId)}
                                                    title="Delete this session"
                                                    className="p-1.5 rounded-lg text-ink-mist hover:text-rust hover:bg-rust/10 transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                            <p className="text-xs text-ink-mist">{running ? "Council is deliberating…" : session.phase === "done" ? "Saved to proposals →" : ""}</p>
                                        </div>
                                        <button onClick={newSession} disabled={running} className="bg-rust text-paper-light text-sm font-semibold px-4 py-2 rounded-xl hover:bg-rust-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                                            Start new proposal →
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
