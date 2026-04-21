"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { SidebarWrapper } from "@/components/SidebarWrapper";
import {
    ChairpersonCard, AgentCard, DelibItem, VerdictCard,
} from "@/components/CouncilCards";
import { STATUS_LABEL, STATUS_STYLE, type Comment, type Proposal } from "@/lib/types";

export default function ProposalDetailPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const [supabase] = useState(() => createClient());
    const [user, setUser] = useState<User | null>(null);
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Editing
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editProjectType, setEditProjectType] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);

    // Comment
    const [body, setBody] = useState("");
    const [posting, setPosting] = useState(false);

    const load = useCallback(async () => {
        const { data, error } = await supabase.from("proposals").select("*").eq("id", id).single();
        if (error || !data) { setError("Proposal not found."); setLoading(false); return; }
        setProposal(data as Proposal);
        setEditTitle(data.title);
        setEditDescription(data.description);
        setEditProjectType(data.project_type ?? "");

        const { data: c } = await supabase
            .from("comments")
            .select("*, author:profiles!comments_author_id_fkey(full_name, email, avatar_url)")
            .eq("proposal_id", id)
            .order("created_at", { ascending: true });
        setComments((c ?? []) as Comment[]);
        setLoading(false);
    }, [supabase, id]);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.replace("/login"); return; }
            setUser(user);
            await load();
        })();
    }, [supabase, router, load]);

    const isOwner = !!(user && proposal && user.id === proposal.author_id);
    const canEdit = isOwner && !!proposal && proposal.status === "submitted";

    async function postComment() {
        if (!body.trim() || !user || !proposal) return;
        setPosting(true);
        await supabase.from("comments").insert({
            proposal_id: proposal.id,
            author_id: user.id,
            body: body.trim(),
        });
        if (user.id !== proposal.author_id) {
            await supabase.from("notifications").insert({
                user_id: proposal.author_id,
                kind: "comment_added",
                title: "New comment on your proposal",
                body: proposal.title,
                proposal_id: proposal.id,
            });
        }
        setBody("");
        await load();
        setPosting(false);
    }

    async function deleteComment(cid: string) {
        if (!confirm("Delete this comment?")) return;
        await supabase.from("comments").delete().eq("id", cid);
        setComments((prev) => prev.filter((c) => c.id !== cid));
    }

    async function saveEdit() {
        if (!proposal || !editTitle.trim() || !editDescription.trim()) return;
        setSavingEdit(true);
        await supabase.from("proposals").update({
            title: editTitle.trim(),
            description: editDescription.trim(),
            project_type: editProjectType.trim() || null,
        }).eq("id", proposal.id);
        setSavingEdit(false);
        setEditing(false);
        await load();
    }

    if (loading) {
        return (
            <SidebarWrapper>
                <div className="flex-1 grid place-items-center">
                    <p className="text-sm text-ink-mist">Loading…</p>
                </div>
            </SidebarWrapper>
        );
    }

    if (error || !proposal) {
        return (
            <SidebarWrapper>
                <div className="flex-1 grid place-items-center">
                    <p className="text-sm text-ink-mist">{error ?? "Proposal not found."}</p>
                </div>
            </SidebarWrapper>
        );
    }

    const review = proposal.ai_review;

    return (
        <SidebarWrapper>
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">

                    {/* ── Proposal header ─────────────────────────────────── */}
                    <section className="bg-paper-light border border-line rounded-2xl p-5 sm:p-6">
                        {editing ? (
                            <div className="space-y-3">
                                <input
                                    type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-base font-semibold text-ink focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10"
                                />
                                <input
                                    type="text" value={editProjectType} onChange={(e) => setEditProjectType(e.target.value)}
                                    placeholder="Project type (optional)"
                                    className="w-full bg-paper border border-line rounded-xl px-4 py-2 text-sm text-ink focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10"
                                />
                                <textarea
                                    value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                                    rows={6}
                                    className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink resize-none focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10"
                                />
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => { setEditing(false); setEditTitle(proposal.title); setEditDescription(proposal.description); setEditProjectType(proposal.project_type ?? ""); }}
                                        className="text-sm font-medium text-ink-soft hover:text-ink px-3 py-1.5 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveEdit}
                                        disabled={savingEdit || !editTitle.trim() || !editDescription.trim()}
                                        className="text-sm font-semibold bg-rust text-paper-light px-4 py-1.5 rounded-xl hover:bg-rust-deep disabled:opacity-40"
                                    >
                                        {savingEdit ? "Saving…" : "Save changes"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                                    <h1 className="text-xl sm:text-2xl font-bold text-ink leading-tight">{proposal.title}</h1>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`shrink-0 text-[10px] font-semibold tracking-wider uppercase rounded-full px-2.5 py-1 border ${STATUS_STYLE[proposal.status]}`}>
                                            {STATUS_LABEL[proposal.status]}
                                        </span>
                                        {canEdit && (
                                            <button
                                                onClick={() => setEditing(true)}
                                                className="text-xs font-medium text-ink-soft hover:text-ink px-2.5 py-1 rounded-lg border border-line hover:border-ink-mist transition-colors"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-ink-faint mb-4">
                                    Submitted {new Date(proposal.created_at).toLocaleString()}
                                    {proposal.project_type ? ` · ${proposal.project_type}` : ""}
                                    {proposal.updated_at !== proposal.created_at ? ` · edited ${new Date(proposal.updated_at).toLocaleDateString()}` : ""}
                                </p>
                                <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">{proposal.description}</p>
                            </>
                        )}
                    </section>

                    {/* ── AI Council Review ───────────────────────────────── */}
                    <section>
                        <h2 className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">
                            AI Council Review
                        </h2>

                        {!review ? (
                            <div className="bg-paper-light border border-line rounded-2xl p-6 text-center text-sm text-ink-mist">
                                No AI review yet.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {review.chairperson && (
                                    <div>
                                        <div className="flex justify-end mb-3">
                                            <div className="bg-rust/10 border border-rust/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-lg text-[14px] text-ink-soft leading-relaxed">
                                                {review.chairperson.intent}
                                            </div>
                                        </div>
                                        <ChairpersonCard a={review.chairperson} />
                                    </div>
                                )}

                                {review.opinions.length > 0 && (
                                    <div>
                                        <h3 className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">
                                            Council Positions
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {review.opinions.map((o) => <AgentCard key={o.agentId} o={o} />)}
                                        </div>
                                    </div>
                                )}

                                {review.deliberations.length > 0 && (
                                    <div>
                                        <h3 className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">
                                            Deliberation
                                        </h3>
                                        <div className="space-y-2">
                                            {review.deliberations.map((d) => <DelibItem key={d.fromAgentId} d={d} />)}
                                        </div>
                                    </div>
                                )}

                                {review.consensus && <VerdictCard c={review.consensus} />}
                            </div>
                        )}
                    </section>

                    {/* ── Discussion ──────────────────────────────────────── */}
                    <section>
                        <h2 className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">
                            Discussion ({comments.length})
                        </h2>

                        <div className="space-y-3 mb-4">
                            {comments.length === 0 && (
                                <p className="text-sm text-ink-mist text-center py-4">No comments yet. Start the discussion.</p>
                            )}
                            {comments.map((c) => (
                                <div key={c.id} className="bg-paper-light border border-line rounded-2xl p-4">
                                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-rust/20 grid place-items-center text-rust text-[11px] font-bold shrink-0">
                                                {(c.author?.full_name ?? c.author?.email ?? "?")[0]?.toUpperCase()}
                                            </div>
                                            <span className="text-sm font-semibold text-ink">
                                                {c.author?.full_name ?? c.author?.email ?? "Unknown"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-ink-faint">{new Date(c.created_at).toLocaleString()}</span>
                                            {user?.id === c.author_id && (
                                                <button onClick={() => deleteComment(c.id)} className="text-[10px] text-ink-mist hover:text-agent-security">
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed pl-8">{c.body}</p>
                                </div>
                            ))}
                        </div>

                        {user ? (
                            <div className="bg-paper-light border border-line rounded-2xl p-4 space-y-3">
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment(); }}
                                    placeholder="Add a comment…"
                                    rows={3}
                                    className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-mist resize-none focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10"
                                />
                                <div className="flex justify-end">
                                    <button
                                        onClick={postComment}
                                        disabled={posting || !body.trim()}
                                        className="text-sm font-semibold bg-rust text-paper-light px-4 py-1.5 rounded-xl hover:bg-rust-deep disabled:opacity-40"
                                    >
                                        {posting ? "Posting…" : "Post comment"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-ink-mist text-center">
                                <a href="/login" className="text-rust hover:underline">Sign in</a> to comment.
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </SidebarWrapper>
    );
}
