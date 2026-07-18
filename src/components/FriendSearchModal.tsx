import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Profile } from "../lib/types";
import Avatar from "./Avatar";
import { X, Search, UserPlus, Check, Loader2 } from "lucide-react";

type Props = {
  onClose: () => void;
  onSent: () => void;
};

export default function FriendSearchModal({ onClose, onSent }: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    setError("");
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("id", user?.id ?? "")
        .limit(20);
      setResults((data || []) as Profile[]);
    } catch {
      setError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }, [user]);

  const sendRequest = async (targetId: string) => {
    if (!user) return;
    setError("");
    try {
      const { error } = await supabase
        .from("friendships")
        .insert({ requester_id: user.id, addressee_id: targetId, status: "pending" });
      if (error) throw error;
      // Create notification for recipient
      await supabase.from("notifications").insert({
        user_id: targetId,
        actor_id: user.id,
        type: "friend_request",
        data: {},
      });
      setSentIds((prev) => new Set(prev).add(targetId));
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="card shadow-soft w-full max-w-md max-h-[80vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">Find friends</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Search by username or name..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {searching && <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />}
          </div>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {results.length === 0 && query.trim().length >= 2 && !searching && (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No users found.</p>
          )}
          {results.length === 0 && query.trim().length < 2 && (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Start typing to search for people.</p>
          )}
          {results.map((p) => (
            <div key={p.id} className="px-3 py-2.5 rounded-xl flex items-center gap-3 hover:bg-ocean-50 dark:hover:bg-mist-800/40 transition-colors">
              <Avatar profile={p} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.display_name || p.username}</p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>@{p.username}</p>
              </div>
              {sentIds.has(p.id) ? (
                <span className="flex items-center gap-1 text-sm text-teal-600 px-3 py-1.5">
                  <Check className="w-4 h-4" /> Sent
                </span>
              ) : (
                <button onClick={() => sendRequest(p.id)} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
