"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");

    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setError(error.message); setLoading(false); }
      else window.location.href = "/";
    } else {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) { setError(error.message); setLoading(false); }
      else window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏛️</div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">AI Council</h1>
          <p className="text-ink-muted text-sm mt-2">
            {mode === "signin" ? "Sign in to convene your council" : "Create an account to get started"}
          </p>
        </div>

        <div className="bg-paper-light border border-line rounded-2xl p-6 shadow-[0_2px_8px_rgba(45,31,22,0.06)]">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-mist focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1.5">Password</label>
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
            {error && <p className="text-xs text-agent-security">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full bg-rust text-paper-light font-semibold py-3 rounded-xl text-sm hover:bg-rust-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? "Please wait…" : mode === "signin" ? "Sign in →" : "Create account →"}
            </button>
          </form>

          <p className="text-center text-xs text-ink-mist mt-4">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
              className="text-rust hover:text-rust-deep underline underline-offset-2"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
