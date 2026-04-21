"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";

interface Props {
    userId: string;
}

export function NotificationBell({ userId }: Props) {
    const [supabase] = useState(() => createClient());
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const panelRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        const { data } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(30);
        setNotifications((data ?? []) as Notification[]);
    }, [supabase, userId]);

    useEffect(() => { load(); }, [load]);

    // Real-time: listen for new notifications
    useEffect(() => {
        const channel = supabase
            .channel(`notifs-${userId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
                () => load()
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [supabase, userId, load]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handle(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [open]);

    const unread = notifications.filter((n) => !n.read).length;

    async function markAllRead() {
        const ids = notifications.filter((n) => !n.read).map((n) => n.id);
        if (!ids.length) return;
        await supabase.from("notifications").update({ read: true }).in("id", ids);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }

    async function markRead(id: string) {
        await supabase.from("notifications").update({ read: true }).eq("id", id);
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    }

    async function clearAll() {
        await supabase.from("notifications").delete().eq("user_id", userId);
        setNotifications([]);
    }

    const KIND_ICON: Record<string, string> = {
        status_changed: "📋",
        comment_added: "💬",
        role_changed: "🔑",
        assigned: "📌",
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                onClick={() => { setOpen((o) => !o); if (!open) load(); }}
                className="relative p-1.5 rounded-lg text-ink-mist hover:text-ink hover:bg-paper-beige transition-colors"
                title="Notifications"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-rust text-paper-light text-[9px] font-bold rounded-full grid place-items-center px-0.5">
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute left-0 bottom-10 w-72 bg-paper-light border border-line shadow-[0_8px_32px_-4px_rgba(45,31,22,0.15)] rounded-2xl overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft">
                        <span className="text-xs font-semibold text-ink">Notifications</span>
                        <div className="flex gap-2">
                            {unread > 0 && (
                                <button onClick={markAllRead} className="text-[10px] text-ink-mist hover:text-ink">Mark all read</button>
                            )}
                            {notifications.length > 0 && (
                                <button onClick={clearAll} className="text-[10px] text-ink-mist hover:text-agent-security">Clear all</button>
                            )}
                        </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                        {notifications.length === 0 && (
                            <p className="text-xs text-ink-mist text-center py-6">No notifications yet.</p>
                        )}
                        {notifications.map((n) => (
                            <div
                                key={n.id}
                                onClick={() => markRead(n.id)}
                                className={`flex gap-2.5 px-4 py-3 border-b border-line-soft last:border-0 cursor-default ${n.read ? "opacity-60" : "bg-honey/5"}`}
                            >
                                <span className="shrink-0 text-sm">{KIND_ICON[n.kind] ?? "🔔"}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-ink leading-snug">{n.title}</p>
                                    {n.body && <p className="text-[11px] text-ink-muted truncate mt-0.5">{n.body}</p>}
                                    <div className="flex items-center justify-between mt-1 gap-2">
                                        <span className="text-[10px] text-ink-faint">{new Date(n.created_at).toLocaleString()}</span>
                                        {n.proposal_id && (
                                            <Link
                                                href={`/proposals/${n.proposal_id}`}
                                                onClick={() => setOpen(false)}
                                                className="text-[10px] text-rust hover:text-rust-deep font-medium"
                                            >
                                                View →
                                            </Link>
                                        )}
                                    </div>
                                </div>
                                {!n.read && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-rust mt-1" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
