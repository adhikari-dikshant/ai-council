"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next: Mode) => { setMode(next); setError(""); setResetSent(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });
      if (error) setError(error.message);
      else setResetSent(true);
      setLoading(false);
      return;
    }

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

  const subtitle = mode === "signin"
    ? "Sign in to convene your council"
    : mode === "signup"
    ? "Create an account to get started"
    : "Reset your password";

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏛️</div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">AI Council</h1>
          <p className="text-ink-muted text-sm mt-2">{subtitle}</p>
        </div>

        <div className="bg-paper-light border border-line rounded-2xl p-6 shadow-[0_2px_8px_rgba(45,31,22,0.06)]">
          {resetSent ? (
            <div className="text-center space-y-3 py-2">
              <div className="text-3xl">📬</div>
              <p className="text-sm text-ink font-medium">Reset link sent</p>
              <p className="text-sm text-ink-muted font-mono bg-paper-beige rounded-lg px-3 py-2">{email}</p>
              <p className="text-xs text-ink-faint leading-relaxed pt-1">
                Click the link in the email to set a new password.
              </p>
              <button
                onClick={() => switchMode("signin")}
                className="text-xs text-rust hover:text-rust-deep underline underline-offset-2 mt-2"
              >
                Back to sign in
              </button>
            </div>
          ) : (
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

              {mode !== "forgot" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-ink-soft">Password</label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="text-xs text-rust hover:text-rust-deep underline underline-offset-2"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
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
              )}

              {error && <p className="text-xs text-agent-security">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email.trim() || (mode !== "forgot" && !password)}
                className="w-full bg-rust text-paper-light font-semibold py-3 rounded-xl text-sm hover:bg-rust-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading
                  ? "Please wait…"
                  : mode === "signin"
                  ? "Sign in →"
                  : mode === "signup"
                  ? "Create account →"
                  : "Send reset link →"}
              </button>
            </form>
          )}

          {!resetSent && (
            <p className="text-center text-xs text-ink-mist mt-4">
              {mode === "signin" ? (
                <>Don't have an account?{" "}
                  <button onClick={() => switchMode("signup")} className="text-rust hover:text-rust-deep underline underline-offset-2">Sign up</button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button onClick={() => switchMode("signin")} className="text-rust hover:text-rust-deep underline underline-offset-2">Sign in</button>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
