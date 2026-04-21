"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  STATUS_LABEL, STATUS_STYLE, ROLE_LABEL, canReview,
  type ProposalStatus, type ProposalWithAuthor, type UserRole,
} from "@/lib/types";

const STATUS_FILTERS: (ProposalStatus | "all")[] = [
  "all", "submitted", "under_review", "approved", "rejected", "revision_required", "draft",
];

export default function ProposalsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<ProposalWithAuthor[]>([]);
  const [filter, setFilter] = useState<ProposalStatus | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUser(user);

      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole((prof?.role as UserRole) ?? "proposer");

      const { data } = await supabase
        .from("proposals")
        .select("*, author:profiles!proposals_author_id_fkey(full_name, email, avatar_url)")
        .order("created_at", { ascending: false });
      setProposals((data ?? []) as ProposalWithAuthor[]);
      setLoading(false);
    })();
  }, [supabase, router]);

  const filtered = useMemo(() => {
    return proposals.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [proposals, filter, search]);

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line-soft bg-paper-warm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl">🏛️</Link>
            <div>
              <h1 className="text-lg font-bold text-ink">Proposals</h1>
              <p className="text-xs text-ink-faint">
                {role ? ROLE_LABEL[role] : "—"} · {filtered.length} of {proposals.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">Home</Link>
            {role === "admin" && (
              <Link href="/admin" className="text-sm font-medium text-ink-soft hover:text-ink">Admin</Link>
            )}
            <Link href="/" className="text-sm font-semibold bg-rust text-paper-light px-4 py-1.5 rounded-xl hover:bg-rust-deep">
              New proposal
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <input
            type="text"
            placeholder="Search proposals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-paper-light border border-line rounded-xl px-4 py-2 text-sm text-ink placeholder-ink-mist focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10"
          />
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  filter === s
                    ? "bg-rust text-paper-light border-rust"
                    : "bg-paper-light text-ink-soft border-line hover:border-ink-mist"
                }`}
              >
                {s === "all" ? "All" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="text-center text-sm text-ink-mist py-12">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-ink-mist mb-3">No proposals yet.</p>
            <Link href="/" className="text-sm font-semibold text-rust hover:text-rust-deep">Submit the first one →</Link>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/proposals/${p.id}`}
              className="block bg-paper-light border border-line rounded-2xl p-4 hover:border-rust/40 hover:shadow-[0_1px_3px_rgba(45,31,22,0.05)] transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink text-sm sm:text-base truncate">{p.title}</h3>
                  <p className="text-xs text-ink-faint mt-0.5">
                    {p.author?.full_name ?? p.author?.email ?? "Unknown"} ·{" "}
                    {new Date(p.created_at).toLocaleDateString()}
                    {p.project_type ? ` · ${p.project_type}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold tracking-wider uppercase rounded-full px-2.5 py-1 border ${STATUS_STYLE[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              <p className="text-[13px] text-ink-muted line-clamp-2">{p.description}</p>
              {(p.risk_level || p.final_decision || p.ai_decision) && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {p.risk_level && (
                    <span className="text-[10px] font-semibold uppercase text-ink-muted bg-paper-beige px-2 py-0.5 rounded">
                      Risk: {p.risk_level}
                    </span>
                  )}
                  {p.ai_decision && !p.final_decision && (
                    <span className="text-[10px] font-semibold uppercase text-ink-muted bg-paper-beige px-2 py-0.5 rounded">
                      AI: {p.ai_decision.replace("_", " ")}
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>

        {!loading && !canReview(role) && proposals.length === 0 && (
          <p className="text-xs text-ink-mist text-center mt-8">
            You see only your own proposals. Ask an admin to upgrade your role to see others.
          </p>
        )}
      </main>
    </div>
  );
}
