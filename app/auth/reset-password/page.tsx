"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); }
    else setDone(true);
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏛️</div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">AI Council</h1>
          <p className="text-ink-muted text-sm mt-2">Set a new password</p>
        </div>

        <div className="bg-paper-light border border-line rounded-2xl p-6 shadow-[0_2px_8px_rgba(45,31,22,0.06)]">
          {done ? (
            <div className="text-center space-y-3 py-2">
              <div className="text-3xl">✅</div>
              <p className="text-sm text-ink font-medium">Password updated!</p>
              <p className="text-xs text-ink-faint">You can now sign in with your new password.</p>
              <a
                href="/"
                className="inline-block mt-2 bg-rust text-paper-light font-semibold py-2 px-6 rounded-xl text-sm hover:bg-rust-deep transition-colors"
              >
                Go to app →
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-mist focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-mist focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 transition-all"
                />
              </div>
              {error && <p className="text-xs text-agent-security">{error}</p>}
              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full bg-rust text-paper-light font-semibold py-3 rounded-xl text-sm hover:bg-rust-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading ? "Updating…" : "Update password →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
