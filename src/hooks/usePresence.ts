import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/**
 * Manages realtime presence for online status.
 * - Tracks which users are online (by user id).
 * - Broadcasts our own presence (respecting privacy hide_online_status).
 * - Updates last_seen on disconnect.
 */
export function usePresence() {
  const { user, profile } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("ocean-chat-presence", {
      config: { presence: { key: user.id } },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        for (const key in state) {
          // Each key is a user id; but respect their privacy setting
          // We store hide flag in presence payload
          const presences = state[key] as unknown as Array<{ user_id: string; hide?: boolean }>;
          for (const p of presences) {
            if (!p.hide) ids.add(p.user_id);
          }
        }
        setOnlineIds(ids);
      })

      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const hide = profileRef.current?.hide_online_status ?? false;
          await channel.track({ user_id: user.id, hide });
        }
      });

    // Update presence when privacy setting changes
    return () => {
      // Update last_seen before leaving
      (async () => {
        await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
        await channel.untrack();
        supabase.removeChannel(channel);
      })();
    };
  }, [user]);

  const refreshTrack = useCallback(async () => {
    if (channelRef.current && user) {
      const hide = profileRef.current?.hide_online_status ?? false;
      await channelRef.current.track({ user_id: user.id, hide });
    }
  }, [user]);

  return { onlineIds, refreshTrack };
}
