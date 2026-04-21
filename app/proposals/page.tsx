"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SidebarWrapper } from "@/components/SidebarWrapper";
import { STATUS_LABEL, STATUS_STYLE, type ProposalStatus, type ProposalWithAuthor } from "@/lib/types";

const STATUS_FILTERS: (ProposalStatus | "all")[] = [
    "all", "submitted", "approved", "rejected", "revision_required",
];

export default function ProposalsPage() {
    const router = useRouter();
    const [supabase] = useState(() => createClient());
    const [loading, setLoading] = useState(true);
    const [proposals, setProposals] = useState<ProposalWithAuthor[]>([]);
    const [filter, setFilter] = useState<ProposalStatus | "all">("all");
    const [search, setSearch] = useState("");

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.replace("/login"); return; }

            const { data } = await supabase
                .from("proposals")
                .select("*, author:profiles!proposals_author_id_fkey(full_name, email, avatar_url)")
                .order("created_at", { ascending: false });
            setProposals((data ?? []) as ProposalWithAuthor[]);
            setLoading(false);
        })();
    }, [supabase, router]);

    const filtered = useMemo(() => proposals.filter((p) => {
        if (filter !== "all" && p.status !== filter) return false;
        if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    }), [proposals, filter, search]);

    return (
        <SidebarWrapper>
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
                    {/* Page header */}
                    <div className="flex items-center justify-between gap-3 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-ink">Proposals</h1>
                            <p className="text-xs text-ink-faint mt-0.5">
                                {filtered.length} of {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
                            </p>
                        </div>
                        <Link
                            href="/?mode=proposal"
                            className="text-sm font-semibold bg-rust text-paper-light px-4 py-2 rounded-xl hover:bg-rust-deep transition-colors shadow-sm"
                        >
                            + New proposal
                        </Link>
                    </div>

                    {/* Search + filters */}
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
                                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${filter === s
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
                            <p className="text-sm text-ink-mist mb-3">
                                {proposals.length === 0 ? "No proposals yet." : "Nothing matches your filter."}
                            </p>
                            {proposals.length === 0 && (
                                <Link href="/?mode=proposal" className="text-sm font-semibold text-rust hover:text-rust-deep">
                                    Submit the first one →
                                </Link>
                            )}
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
                                {p.risk_level && (
                                    <div className="mt-3">
                                        <span className="text-[10px] font-semibold uppercase text-ink-muted bg-paper-beige px-2 py-0.5 rounded">
                                            Risk: {p.risk_level}
                                        </span>
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </SidebarWrapper>
    );
}
