"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  STATUS_LABEL, STATUS_STYLE, ROLE_LABEL,
  canReview, canChangeStatus,
  type Comment, type CommentVote, type Proposal, type ProposalStatus,
  type UserRole, type DecisionOutcome,
} from "@/lib/types";

const STATUS_OPTIONS: ProposalStatus[] = [
  "submitted", "under_review", "approved", "rejected", "revision_required",
];

const VOTE_LABEL: Record<CommentVote, { label: string; cls: string }> = {
  approve: { label: "Approve", cls: "bg-agent-cost/10 text-agent-cost border-agent-cost/30" },
  reject:  { label: "Reject",  cls: "bg-agent-security/10 text-agent-security border-agent-security/30" },
  revise:  { label: "Revise",  cls: "bg-honey/10 text-honey border-honey/30" },
};

function AIReviewSummary({ proposal }: { proposal: Proposal }) {
  const ai = proposal.ai_review;
  if (!ai) {
    return (
      <div className="bg-paper-light border border-line rounded-2xl p-5 text-sm text-ink-mist text-center">
        AI council has not reviewed this proposal yet.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {ai.consensus && (
        <div className="bg-paper-light border border-rust/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <span className="font-bold text-rust tracking-[0.15em] text-xs uppercase">🏛️ AI Council Verdict</span>
            <div className="flex items-center gap-2 flex-wrap">
              {proposal.ai_decision && (
                <span className="text-[10px] font-semibold uppercase text-ink-muted bg-paper-beige px-2 py-0.5 rounded">
                  Decision: {proposal.ai_decision.replace("_", " ")}
                </span>
              )}
              {proposal.risk_level && (
                <span className="text-[10px] font-semibold uppercase text-ink-muted bg-paper-beige px-2 py-0.5 rounded">
                  Risk: {proposal.risk_level}
                </span>
              )}
            </div>
          </div>
          <p className="text-ink font-semibold mb-2">{ai.consensus.recommendation}</p>
          <p className="text-sm text-ink-soft leading-relaxed">{ai.consensus.reasoning}</p>
          {ai.consensus.keyPoints?.length > 0 && (
            <ul className="mt-3 space-y-1">
              {ai.consensus.keyPoints.map((pt, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink-soft"><span className="text-rust">→</span>{pt}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {ai.opinions.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {ai.opinions.map((o) => (
            <div key={o.agentId} className="bg-paper-light border border-line rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-ink">{o.emoji} {o.agentName}</span>
                {o.vote && (
                  <span className={`text-[10px] font-semibold uppercase rounded-full px-2 py-0.5 border ${VOTE_LABEL[o.vote].cls}`}>
                    {VOTE_LABEL[o.vote].label}
                  </span>
                )}
              </div>
              {o.assessment && <p className="text-xs text-ink-muted italic leading-relaxed">{o.assessment}</p>}
              <p className="text-[11px] text-ink-faint mt-1">{o.modelLabel} · {o.confidence}%</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProposalDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer
  const [body, setBody] = useState("");
  const [vote, setVote] = useState<CommentVote | "">("");
  const [posting, setPosting] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProjectType, setEditProjectType] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("proposals").select("*").eq("id", id).single();
    if (error || !data) { setError("Proposal not found or inaccessible."); setLoading(false); return; }
    setProposal(data as Proposal);
    setEditTitle(data.title);
    setEditDescription(data.description);
    setEditProjectType(data.project_type ?? "");

    const { data: c } = await supabase
      .from("comments")
      .select("*, author:profiles!comments_author_id_fkey(full_name, email, avatar_url, role)")
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
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole((prof?.role as UserRole) ?? "proposer");
      await load();
    })();
  }, [supabase, router, load]);

  const isOwner = !!(user && proposal && user.id === proposal.author_id);
  const canEdit = isOwner && proposal && ["draft", "submitted", "revision_required"].includes(proposal.status);
  const canComment = !!user && !!proposal && (isOwner || canReview(role));

  async function postComment() {
    if (!body.trim() || !user || !proposal) return;
    setPosting(true);
    const { error } = await supabase.from("comments").insert({
      proposal_id: proposal.id,
      author_id: user.id,
      body: body.trim(),
      vote: vote || null,
    });
    if (!error) {
      // notify the proposal author (unless commenter is the author)
      if (user.id !== proposal.author_id) {
        await supabase.from("notifications").insert({
          user_id: proposal.author_id,
          kind: "comment_added",
          title: "New comment on your proposal",
          body: proposal.title,
          proposal_id: proposal.id,
        });
      }
      setBody(""); setVote("");
      await load();
    }
    setPosting(false);
  }

  async function changeStatus(next: ProposalStatus) {
    if (!user || !proposal) return;
    const isDecision = ["approved", "rejected", "revision_required"].includes(next);
    const patch: Partial<Proposal> = { status: next };
    if (isDecision) {
      patch.final_decision = next as DecisionOutcome;
      patch.decided_by = user.id;
      patch.decided_at = new Date().toISOString();
    }
    const { error } = await supabase.from("proposals").update(patch).eq("id", proposal.id);
    if (error) { alert(error.message); return; }
    if (user.id !== proposal.author_id) {
      await supabase.from("notifications").insert({
        user_id: proposal.author_id,
        kind: "status_changed",
        title: `Your proposal is now ${STATUS_LABEL[next]}`,
        body: proposal.title,
        proposal_id: proposal.id,
      });
    }
    await load();
  }

  async function saveEdit() {
    if (!proposal) return;
    if (!editTitle.trim() || !editDescription.trim()) return;
    setSavingEdit(true);
    const { error } = await supabase.from("proposals").update({
      title: editTitle.trim(),
      description: editDescription.trim(),
      project_type: editProjectType.trim() || null,
    }).eq("id", proposal.id);
    setSavingEdit(false);
    if (error) { alert(error.message); return; }
    setEditing(false);
    await load();
  }

  async function deleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    await supabase.from("comments").delete().eq("id", commentId);
    await load();
  }

  if (loading) return <main className="min-h-screen bg-paper grid place-items-center"><p className="text-sm text-ink-mist">Loading…</p></main>;
  if (error || !proposal) {
    return (
      <main className="min-h-screen bg-paper grid place-items-center">
        <div className="text-center">
          <p className="text-sm text-ink-mist mb-3">{error ?? "Proposal not found."}</p>
          <Link href="/proposals" className="text-sm font-semibold text-rust hover:text-rust-deep">← Back to proposals</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line-soft bg-paper-warm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/proposals" className="text-sm font-medium text-ink-soft hover:text-ink">← Proposals</Link>
          <div className="flex items-center gap-2">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="text-sm font-medium text-ink-soft hover:text-ink px-3 py-1.5 rounded-lg hover:bg-paper-beige">
                Edit
              </button>
            )}
            <Link href="/" className="text-sm font-semibold bg-rust text-paper-light px-3 py-1.5 rounded-xl hover:bg-rust-deep">Home</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header card */}
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
                <button onClick={() => { setEditing(false); setEditTitle(proposal.title); setEditDescription(proposal.description); setEditProjectType(proposal.project_type ?? ""); }} className="text-sm font-medium text-ink-soft hover:text-ink px-3 py-1.5 rounded-lg">Cancel</button>
                <button onClick={saveEdit} disabled={savingEdit || !editTitle.trim() || !editDescription.trim()} className="text-sm font-semibold bg-rust text-paper-light px-4 py-1.5 rounded-xl hover:bg-rust-deep disabled:opacity-40">
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-ink leading-tight">{proposal.title}</h1>
                <span className={`shrink-0 text-[10px] font-semibold tracking-wider uppercase rounded-full px-2.5 py-1 border ${STATUS_STYLE[proposal.status]}`}>
                  {STATUS_LABEL[proposal.status]}
                </span>
              </div>
              <p className="text-xs text-ink-faint mb-4">
                Submitted {new Date(proposal.created_at).toLocaleString()}
                {proposal.project_type ? ` · ${proposal.project_type}` : ""}
                {proposal.updated_at !== proposal.created_at ? ` · edited ${new Date(proposal.updated_at).toLocaleDateString()}` : ""}
              </p>
              <div className="prose-compact text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">
                {proposal.description}
              </div>
            </>
          )}
        </section>

        {/* Status controls for reviewers */}
        {canChangeStatus(role) && !editing && (
          <section className="bg-paper-light border border-line rounded-2xl p-5">
            <p className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">Change status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={s === proposal.status}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    s === proposal.status
                      ? "bg-rust text-paper-light border-rust"
                      : "bg-paper text-ink-soft border-line hover:border-rust/40"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* AI review */}
        <section>
          <h2 className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">AI Review</h2>
          <AIReviewSummary proposal={proposal} />
        </section>

        {/* Comments */}
        <section>
          <h2 className="text-[11px] font-semibold text-ink-faint tracking-[0.15em] uppercase mb-3">
            Discussion ({comments.length})
          </h2>

          <div className="space-y-3 mb-4">
            {comments.map((c) => (
              <div key={c.id} className="bg-paper-light border border-line rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-rust/20 grid place-items-center text-rust text-[11px] font-bold">
                      {(c.author?.full_name ?? c.author?.email ?? "?")[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-ink">
                      {c.author?.full_name ?? c.author?.email ?? "Unknown"}
                    </span>
                    {c.author?.role && (
                      <span className="text-[10px] font-semibold uppercase text-ink-muted bg-paper-beige px-1.5 py-0.5 rounded">
                        {ROLE_LABEL[c.author.role]}
                      </span>
                    )}
                    {c.vote && (
                      <span className={`text-[10px] font-semibold uppercase rounded-full px-2 py-0.5 border ${VOTE_LABEL[c.vote].cls}`}>
                        {VOTE_LABEL[c.vote].label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-ink-faint">{new Date(c.created_at).toLocaleString()}</span>
                    {(user?.id === c.author_id || role === "admin") && (
                      <button onClick={() => deleteComment(c.id)} className="text-[10px] text-ink-mist hover:text-agent-security">Delete</button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed pl-8">{c.body}</p>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-sm text-ink-mist text-center py-4">No comments yet.</p>
            )}
          </div>

          {canComment ? (
            <div className="bg-paper-light border border-line rounded-2xl p-4 space-y-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={canReview(role) ? "Add a review comment…" : "Add a comment…"}
                rows={3}
                className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-mist resize-none focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10"
              />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {canReview(role) ? (
                  <div className="flex gap-1.5">
                    {(["approve", "revise", "reject"] as CommentVote[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setVote(vote === v ? "" : v)}
                        className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                          vote === v ? VOTE_LABEL[v].cls : "bg-paper text-ink-soft border-line hover:border-ink-mist"
                        }`}
                      >
                        {VOTE_LABEL[v].label}
                      </button>
                    ))}
                  </div>
                ) : <div />}
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
            <p className="text-xs text-ink-mist text-center">Sign in with a reviewer role to comment.</p>
          )}
        </section>
      </main>
    </div>
  );
}
