"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "./Sidebar";
import type { ConversationSummary } from "./Sidebar";

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [supabase] = useState(() => createClient());
    const [user, setUser] = useState<User | null>(null);
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loadingConvos, setLoadingConvos] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const fetchConversations = useCallback(async () => {
        const { data } = await supabase
            .from("conversations")
            .select("id, title, created_at")
            .order("created_at", { ascending: false });
        setConversations((data ?? []) as ConversationSummary[]);
        setLoadingConvos(false);
    }, [supabase]);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) fetchConversations();
            else setLoadingConvos(false);
        })();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
            setUser(s?.user ?? null);
            if (s?.user) fetchConversations();
            else { setConversations([]); setLoadingConvos(false); }
        });
        return () => subscription.unsubscribe();
    }, [supabase, fetchConversations]);

    return (
        <div className="flex h-screen overflow-hidden bg-paper">
            {user && (
                <Sidebar
                    conversations={conversations}
                    currentId={undefined}
                    onNew={() => { setSidebarOpen(false); router.push("/"); }}
                    onSelect={(id) => { setSidebarOpen(false); window.location.href = `/?cid=${id}`; }}
                    onDelete={async (id) => {
                        await supabase.from("conversations").delete().eq("id", id);
                        setConversations((prev) => prev.filter((c) => c.id !== id));
                    }}
                    user={{
                        id: user.id,
                        name: user.user_metadata?.full_name ?? user.email ?? null,
                        email: user.email ?? null,
                        image: user.user_metadata?.avatar_url ?? null,
                    }}
                    loading={loadingConvos}
                    open={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                />
            )}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile header */}
                <header className="md:hidden shrink-0 flex items-center justify-between px-4 py-3 border-b border-line-soft bg-paper-warm">
                    {user ? (
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-1.5 rounded-lg text-ink-soft hover:text-ink hover:bg-paper-beige transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    ) : <div className="w-8" />}
                    <span className="text-sm font-bold text-ink">🏛️ AI Council</span>
                    {!user ? (
                        <a href="/login" className="text-sm font-semibold text-rust hover:text-rust-deep">Sign in</a>
                    ) : <div className="w-8" />}
                </header>
                {children}
            </div>
        </div>
    );
}
