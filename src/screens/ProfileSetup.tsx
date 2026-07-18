import { useState, useRef, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Avatar from "../components/Avatar";
import { Camera, Check, Waves } from "lucide-react";

export default function ProfileSetup() {
  const { user, refreshProfile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameOk, setUsernameOk] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const checkUsername = async (val: string) => {
    setUsername(val);
    if (val.length < 3) { setUsernameOk(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", val)
      .neq("id", user?.id ?? "")
      .maybeSingle();
    setUsernameOk(!data);
  };

  const handleAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file, { upsert: true });
    if (upErr) { setError(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
    setAvatarUrl(pub.publicUrl);
    setUploading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!usernameOk || username.length < 3) { setError("Username unavailable or too short (min 3 chars)."); return; }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          display_name: displayName || username,
          bio,
          avatar_url: avatarUrl,
        })
        .eq("id", user!.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full ocean-gradient ocean-bg wave-pattern flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-ocean-300/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-300/15 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <button onClick={toggle} className="absolute top-5 right-5 z-10 p-2.5 rounded-xl card hover:scale-105 transition-transform">
        {theme === "light" ? "🌙" : "☀️"}
      </button>

      <div className="relative z-10 w-full max-w-lg animate-slide-up">
        <div className="card p-8 shadow-soft">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: "linear-gradient(135deg, #38bdf8, #0284c7)" }}>
              <Waves className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-serif text-2xl font-semibold">Set up your profile</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              This is how others will see you on Ocean Breeze.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative group"
              >
                <Avatar url={avatarUrl} displayName={displayName || username} size="xl" />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-7 h-7 text-white" />
                </div>
                {uploading && <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center"><span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatar(e.target.files[0])} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Click to upload a photo</p>
            </div>

            {/* Username */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Username</label>
              <input
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                value={username}
                onChange={(e) => checkUsername(e.target.value)}
                placeholder="e.g. forest_walker"
                className="input-field"
              />
              <p className={`text-xs mt-1 ${usernameOk ? "text-teal-600" : "text-red-500"}`}>
                {username.length === 0 ? "Letters, numbers, underscores. Min 3 chars." : usernameOk ? "Available" : "Already taken"}
              </p>
            </div>

            {/* Display name */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Display name</label>
              <input
                maxLength={40}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="input-field"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Bio</label>
              <textarea
                maxLength={160}
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A few words about you..."
                className="input-field resize-none"
              />
              <p className="text-xs mt-1 text-right" style={{ color: "var(--text-muted)" }}>{bio.length}/160</p>
            </div>

            {error && <div className="px-4 py-2.5 rounded-xl text-sm bg-red-500/10 text-red-600 border border-red-500/20">{error}</div>}

            <button type="submit" disabled={loading || !usernameOk} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check className="w-4 h-4" /> Complete setup</>}
            </button>
            <button type="button" onClick={signOut} className="btn-ghost w-full text-sm">Sign out instead</button>
          </form>
        </div>
      </div>
    </div>
  );
}
