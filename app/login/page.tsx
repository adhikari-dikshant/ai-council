"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏛️</div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">AI Council</h1>
          <p className="text-ink-muted text-sm mt-2">
            {sent ? "Check your inbox" : "Sign in to convene your council"}
          </p>
        </div>

        <div className="bg-paper-light border border-line rounded-2xl p-6 shadow-[0_2px_8px_rgba(45,31,22,0.06)]">
          {sent ? (
            <div className="text-center space-y-3 py-2">
              <div className="text-3xl">📬</div>
              <p className="text-sm text-ink font-medium">Magic link sent to</p>
              <p className="text-sm text-ink-muted font-mono bg-paper-beige rounded-lg px-3 py-2">
                {email}
              </p>
              <p className="text-xs text-ink-faint leading-relaxed pt-1">
                Click the link in the email to sign in.<br />
                You can close this tab.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-xs text-rust hover:text-rust-deep underline underline-offset-2 mt-2"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-mist focus:outline-none focus:border-rust/50 focus:ring-2 focus:ring-rust/10 transition-all"
                />
              </div>
              {error && <p className="text-xs text-agent-security">{error}</p>}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-rust text-paper-light font-semibold py-3 rounded-xl text-sm hover:bg-rust-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading ? "Sending…" : "Send magic link →"}
              </button>
              <p className="text-center text-xs text-ink-mist pt-1">
                No password needed — we'll email you a link.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
