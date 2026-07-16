import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { X, Eye, Clock, Check, Mail, Moon, Sun, Bell } from "lucide-react";

type Props = {
  onClose: () => void;
  onPrivacyChanged?: () => void;
};

export default function SettingsModal({ onClose, onPrivacyChanged }: Props) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [hideOnline, setHideOnline] = useState(profile?.hide_online_status ?? false);
  const [hideLastSeen, setHideLastSeen] = useState(profile?.hide_last_seen ?? false);
  const [readReceipts, setReadReceipts] = useState(profile?.read_receipts_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [resetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState("");

  const savePrivacy = async () => {
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          hide_online_status: hideOnline,
          hide_last_seen: hideLastSeen,
          read_receipts_enabled: readReceipts,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      onPrivacyChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setError("");
    setSaving(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail || user?.email || "");
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="card shadow-soft w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Appearance */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Appearance</h3>
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${theme === t ? "border-leaf-500 bg-leaf-500/5" : "border-transparent"}`}
                  style={{ background: "var(--bg-elevated)" }}
                >
                  {t === "light" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  <span className="text-sm font-medium capitalize">{t}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Privacy */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Privacy</h3>
            <div className="space-y-1">
              <ToggleRow
                icon={<Eye className="w-4 h-4" />}
                title="Hide online status"
                desc="Others won't see your green dot"
                checked={hideOnline}
                onChange={setHideOnline}
              />
              <ToggleRow
                icon={<Clock className="w-4 h-4" />}
                title="Hide last seen"
                desc="Others won't see when you were last active"
                checked={hideLastSeen}
                onChange={setHideLastSeen}
              />
              <ToggleRow
                icon={<Check className="w-4 h-4" />}
                title="Read receipts"
                desc="Send read receipts when you read messages"
                checked={readReceipts}
                onChange={setReadReceipts}
              />
            </div>
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            <button onClick={savePrivacy} disabled={saving} className="btn-primary w-full mt-3 flex items-center justify-center gap-1.5">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Save privacy settings"}
            </button>
          </section>

          {/* Password reset */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Security</h3>
            <div className="px-4 py-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm font-medium">Reset password</p>
              </div>
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                {resetSent ? "Reset link sent to your email." : "We'll send a reset link to your email."}
              </p>
              {!resetSent && (
                <button onClick={handleReset} disabled={saving} className="btn-ghost w-full text-sm border">
                  {saving ? "Sending..." : "Send reset link"}
                </button>
              )}
            </div>
          </section>

          {/* Account */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Account</h3>
            <div className="px-4 py-3 rounded-xl flex items-center gap-2" style={{ background: "var(--bg-elevated)" }}>
              <Bell className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm">{user?.email}</p>
            </div>
            <button onClick={signOut} className="btn-ghost w-full mt-2 border text-sm">Sign out</button>
          </section>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ icon, title, desc, checked, onChange }: { icon: React.ReactNode; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full px-4 py-3 rounded-xl flex items-center gap-3 hover:bg-stone-100 dark:hover:bg-stone-800/40 transition-colors text-left">
      <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
      </div>
      <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${checked ? "bg-leaf-500" : "bg-stone-300 dark:bg-stone-700"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
    </button>
  );
}
