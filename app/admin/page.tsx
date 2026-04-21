"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL, type Profile, type UserRole } from "@/lib/types";

const ALL_ROLES: UserRole[] = ["admin", "council_member", "reviewer", "proposer"];

export default function AdminPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    setProfiles((data ?? []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUser(user);
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (prof?.role !== "admin") { router.replace("/"); return; }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeRole(profileId: string, newRole: UserRole) {
    setSaving(profileId);
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", profileId);
    if (error) { alert(error.message); setSaving(null); return; }
    // notify the user
    await supabase.from("notifications").insert({
      user_id: profileId,
      kind: "role_changed",
      title: `Your role has been updated to ${ROLE_LABEL[newRole]}`,
      body: null,
      proposal_id: null,
    });
    setProfiles((prev) => prev.map((p) => p.id === profileId ? { ...p, role: newRole } : p));
    setSaving(null);
  }

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.full_name ?? "").toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line-soft bg-paper-warm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl">🏛️</Link>
            <div>
              <h1 className="text-lg font-bold text-ink">Admin</h1>
              <p className="text-xs text-ink-faint">{profiles.length} users</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/proposals" className="text-sm font-medium text-ink-soft hover:text-ink">Proposals</Link>
            <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">Home</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 bg-paper-light border border-line rounded-xl px-4 py-2 text-sm text-ink placeholder-ink-mist focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10"
          />
        </div>

        {loading && <p className="text-sm text-ink-mist py-8 text-center">Loading…</p>}

        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-paper-light border border-line rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-rust/20 grid place-items-center text-rust text-sm font-bold shrink-0">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    (p.full_name ?? p.email ?? "?")[0]?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {p.full_name ?? "—"}
                    {p.id === user?.id && <span className="ml-1.5 text-[10px] font-normal text-ink-mist">(you)</span>}
                  </p>
                  <p className="text-xs text-ink-faint truncate">{p.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {saving === p.id ? (
                  <span className="text-xs text-ink-mist px-2">Saving…</span>
                ) : (
                  <div className="flex gap-1.5 flex-wrap">
                    {ALL_ROLES.map((r) => (
                      <button
                        key={r}
                        onClick={() => p.role !== r && changeRole(p.id, r)}
                        disabled={p.role === r || p.id === user?.id}
                        className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors disabled:cursor-not-allowed ${
                          p.role === r
                            ? "bg-rust text-paper-light border-rust"
                            : "bg-paper text-ink-soft border-line hover:border-rust/40 disabled:opacity-40"
                        }`}
                      >
                        {ROLE_LABEL[r]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-ink-mist text-center py-8">No users found.</p>
        )}

        <div className="mt-8 bg-paper-light border border-line rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-3">Role permissions</h2>
          <div className="space-y-2 text-[13px]">
            {[
              { role: "admin",          perms: "Full access: manage roles, change proposal status, review, comment" },
              { role: "council_member", perms: "Review proposals, change status (including final decisions), comment with vote" },
              { role: "reviewer",       perms: "Review proposals, comment with vote, change status (not approve/reject)" },
              { role: "proposer",       perms: "Submit proposals and comment on their own" },
            ].map(({ role, perms }) => (
              <div key={role} className="flex gap-3">
                <span className="shrink-0 text-xs font-semibold uppercase text-ink-muted bg-paper-beige px-2 py-0.5 rounded w-28 text-center">
                  {ROLE_LABEL[role as UserRole]}
                </span>
                <span className="text-ink-soft">{perms}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
