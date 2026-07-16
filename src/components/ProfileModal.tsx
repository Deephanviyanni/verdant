import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Profile } from "../lib/types";
import Avatar from "./Avatar";
import { X, Camera, Save, Trash2, AlertTriangle } from "lucide-react";

type Props = {
  profile: Profile | null;
  isOwn: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function ProfileModal({ profile, isOwn, onClose, onSaved }: Props) {
  const { user, refreshProfile, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName, bio, avatar_url: avatarUrl })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setEditing(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE" || !user) return;
    setLoading(true);
    try {
      // Delete profile (cascades to friendships, messages, notifications)
      await supabase.from("profiles").delete().eq("id", user.id);
      // Delete auth user via signOut (frontend can't delete auth.users directly,
      // but profile data is gone. Full auth deletion requires service role.)
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="card shadow-soft w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
        {/* Header banner */}
        <div className="h-24 rounded-t-2xl relative" style={{ background: "linear-gradient(135deg, #a3c2a4, #7d9a74, #5e7d56)" }}>
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 text-white hover:bg-black/30 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="-mt-12 mb-4 flex justify-center">
            {editing ? (
              <button onClick={() => fileRef.current?.click()} className="relative group">
                <Avatar url={avatarUrl} displayName={displayName || profile?.username} size="xl" showRing />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-7 h-7 text-white" />
                </div>
                {uploading && <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center"><span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>}
              </button>
            ) : (
              <Avatar url={profile?.avatar_url} displayName={profile?.display_name || profile?.username} size="xl" showRing />
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Display name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="input-field" placeholder="Your name" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} className="input-field resize-none" placeholder="About you..." />
                <p className="text-xs mt-1 text-right" style={{ color: "var(--text-muted)" }}>{bio.length}/160</p>
              </div>
              {error && <div className="px-4 py-2.5 rounded-xl text-sm bg-red-500/10 text-red-600 border border-red-500/20">{error}</div>}
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                  {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
                </button>
                <button onClick={() => setEditing(false)} className="btn-ghost flex-1 border">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <h2 className="font-serif text-xl font-semibold">{profile?.display_name || profile?.username || "Unknown"}</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>@{profile?.username}</p>
              </div>

              {profile?.bio && (
                <div className="mb-4 px-4 py-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Bio</p>
                  <p className="text-sm">{profile.bio}</p>
                </div>
              )}

              {isOwn ? (
                <div className="space-y-2">
                  <button onClick={() => setEditing(true)} className="btn-primary w-full">Edit profile</button>
                  <button onClick={() => setShowDelete(true)} className="w-full px-4 py-2 rounded-xl text-sm text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5">
                    <Trash2 className="w-4 h-4" /> Delete account
                  </button>
                </div>
              ) : null}
            </>
          )}

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatar(e.target.files[0])} />
        </div>

        {/* Delete account modal */}
        {showDelete && (
          <div className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/60 rounded-2xl animate-fade-in">
            <div className="card p-6 max-w-sm w-full animate-slide-up">
              <div className="flex items-center gap-2 mb-3 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-semibold">Delete account?</h3>
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                This permanently removes your profile, messages, and friendships. Type <strong>DELETE</strong> to confirm.
              </p>
              <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="input-field mb-3" placeholder="Type DELETE" />
              {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleDeleteAccount} disabled={loading || deleteConfirm !== "DELETE"} className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50">
                  {loading ? "Deleting..." : "Delete forever"}
                </button>
                <button onClick={() => setShowDelete(false)} className="btn-ghost flex-1 border">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
