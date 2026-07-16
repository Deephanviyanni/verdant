import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import { Leaf, Mail, Lock, Eye, EyeOff, Sparkles } from "lucide-react";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showReset, setShowReset] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created! Please sign in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setInfo("Password reset link sent to your email.");
      setShowReset(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full nature-gradient leaf-pattern flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-moss-300/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-clay-300/15 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <button
        onClick={toggle}
        className="absolute top-5 right-5 z-10 p-2.5 rounded-xl card hover:scale-105 transition-transform"
        aria-label="Toggle theme"
      >
        {theme === "light" ? <Moon /> : <Sun />}
      </button>

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-soft" style={{ background: "linear-gradient(135deg, #7d9a74, #477d3c)" }}>
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Verdant
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Private conversations, naturally connected
          </p>
        </div>

        {showReset ? (
          <div className="card p-8 shadow-soft animate-fade-in">
            <h2 className="font-serif text-xl font-semibold mb-2">Reset password</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleReset} className="space-y-4">
              <Field icon={<Mail className="w-4 h-4" />}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent outline-none text-sm"
                />
              </Field>
              {error && <ErrorBox text={error} />}
              {info && <InfoBox text={info} />}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Sending..." : "Send reset link"}
              </button>
              <button type="button" onClick={() => setShowReset(false)} className="btn-ghost w-full text-sm">
                Back to sign in
              </button>
            </form>
          </div>
        ) : (
          <div className="card p-8 shadow-soft animate-fade-in">
            <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
              {(["login", "signup"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); setInfo(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    mode === m ? "text-white shadow-soft" : "hover:opacity-80"
                  }`}
                  style={mode === m ? { background: "linear-gradient(135deg, #5e7d56, #477d3c)" } : { color: "var(--text-secondary)" }}
                >
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field icon={<Mail className="w-4 h-4" />}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full bg-transparent outline-none text-sm"
                />
              </Field>
              <Field icon={<Lock className="w-4 h-4" />}>
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-transparent outline-none text-sm"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="opacity-50 hover:opacity-100 transition-opacity">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>

              {mode === "login" && (
                <button type="button" onClick={() => setShowReset(true)} className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>
                  Forgot password?
                </button>
              )}

              {error && <ErrorBox text={error} />}
              {info && <InfoBox text={info} />}

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : mode === "login" ? (
                  <>Sign In</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Create account</>
                )}
              </button>
            </form>

            <p className="text-xs text-center mt-6" style={{ color: "var(--text-muted)" }}>
              By continuing you agree to our terms & privacy policy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border input-field-like" style={{ borderColor: "var(--border)" }}>
      <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      {children}
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="px-4 py-2.5 rounded-xl text-sm bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
      {text}
    </div>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <div className="px-4 py-2.5 rounded-xl text-sm bg-leaf-500/10 text-leaf-700 dark:text-leaf-300 border border-leaf-500/20">
      {text}
    </div>
  );
}

function Moon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function Sun() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
