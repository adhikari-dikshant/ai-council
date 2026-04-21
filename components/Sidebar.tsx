"use client";

import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "./NotificationBell";

export interface ConversationSummary {
    id: string;
    title: string;
    created_at: string;
}

interface SidebarProps {
    conversations: ConversationSummary[];
    currentId?: string;
    onNew: () => void;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
    loading: boolean;
    open: boolean;
    onClose: () => void;
}

function groupByDate(conversations: ConversationSummary[]) {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterdayStr = new Date(now.getTime() - 86_400_000).toDateString();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const order = ["Today", "Yesterday", "Last 7 days", "Older"];
    const groups: Record<string, ConversationSummary[]> = {};
    for (const c of conversations) {
        const d = new Date(c.created_at);
        let group: string;
        if (d.toDateString() === todayStr) group = "Today";
        else if (d.toDateString() === yesterdayStr) group = "Yesterday";
        else if (d > weekAgo) group = "Last 7 days";
        else group = "Older";
        (groups[group] ??= []).push(c);
    }
    return order.filter((g) => groups[g]).map((g) => ({ label: g, items: groups[g] }));
}

export function Sidebar({
    conversations, currentId, onNew, onSelect, onDelete, user, loading, open, onClose,
}: SidebarProps) {
    const grouped = groupByDate(conversations);

    return (
        <>
            {open && (
                <div className="fixed inset-0 z-40 bg-ink/30 md:hidden" onClick={onClose} />
            )}

            <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 shrink-0 flex flex-col bg-paper-warm border-r border-line-soft
        transition-transform duration-200 ease-in-out
        md:relative md:z-auto md:translate-x-0
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
                {/* Logo + mobile close */}
                <div className="px-4 py-4 flex items-center justify-between border-b border-line-soft">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl">🏛️</span>
                        <div>
                            <div className="font-bold text-sm text-ink leading-none">AI Council</div>
                            <div className="text-[10px] text-ink-faint mt-0.5">Round-table intelligence</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="md:hidden p-1.5 rounded-lg text-ink-mist hover:text-ink hover:bg-paper-beige transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Nav */}
                <div className="px-3 pt-2 pb-1 space-y-0.5">
                    <button
                        onClick={() => { onNew(); onClose(); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-ink-soft hover:bg-paper-beige hover:text-ink transition-colors font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        New proposal
                    </button>
                    <Link
                        href="/proposals"
                        onClick={onClose}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-ink-soft hover:bg-paper-beige hover:text-ink transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Proposals
                    </Link>
                </div>

                {/* Conversation list */}
                <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-4 mt-1">
                    {loading && (
                        <div className="px-3 py-4 text-xs text-ink-mist text-center">Loading…</div>
                    )}
                    {!loading && conversations.length === 0 && (
                        <div className="px-3 py-8 text-xs text-ink-mist text-center leading-relaxed">
                            No chats yet.<br />Submit your first proposal.
                        </div>
                    )}
                    {grouped.map(({ label, items }) => (
                        <div key={label}>
                            <div className="px-3 py-1 text-[10px] font-semibold text-ink-mist uppercase tracking-widest">
                                {label}
                            </div>
                            {items.map((c) => (
                                <div key={c.id} className="group relative">
                                    <button
                                        onClick={() => { onSelect(c.id); onClose(); }}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-[13px] truncate transition-colors pr-8 ${currentId === c.id
                                            ? "bg-paper-beige text-ink font-medium"
                                            : "text-ink-soft hover:bg-paper-beige/60 hover:text-ink"
                                        }`}
                                    >
                                        {c.title}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-ink-mist opacity-0 group-hover:opacity-100 hover:text-rust hover:bg-rust/10 transition-all"
                                        title="Delete"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* User footer */}
                <div className="border-t border-line-soft px-3 py-3">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl">
                        {user.image ? (
                            <Image src={user.image} alt={user.name ?? "avatar"} width={28} height={28} className="rounded-full shrink-0" />
                        ) : (
                            <div className="w-7 h-7 rounded-full bg-rust/20 flex items-center justify-center text-rust text-xs font-bold shrink-0">
                                {user.name?.[0] ?? user.email?.[0] ?? "?"}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-ink truncate">{user.name ?? "You"}</div>
                            <div className="text-[10px] text-ink-faint truncate">{user.email}</div>
                        </div>
                        <NotificationBell userId={user.id} />
                        <button
                            onClick={async () => { await createClient().auth.signOut(); window.location.href = "/login"; }}
                            title="Sign out"
                            className="text-ink-mist hover:text-rust transition-colors p-1 rounded-lg hover:bg-rust/10"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
