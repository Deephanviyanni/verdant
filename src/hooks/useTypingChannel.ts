import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type TypingState = { user_id: string; is_typing: boolean };

/**
 * Broadcasts and receives typing status via a realtime channel scoped to a chat pair.
 * The channel name is deterministic from the two user ids so both sides join the same channel.
 */
export function useTypingChannel(otherUserId: string | null, onTypingChange: (typing: boolean) => void) {
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onTypingRef = useRef(onTypingChange);
  onTypingRef.current = onTypingChange;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !otherUserId) return;
    const name = `typing:${[user.id, otherUserId].sort().join("_")}`;
    const channel = supabase.channel(name);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, (msg: { payload: TypingState }) => {
        if (msg.payload.user_id === otherUserId) {
          onTypingRef.current(msg.payload.is_typing);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (msg.payload.is_typing) {
            timeoutRef.current = setTimeout(() => onTypingRef.current(false), 4000);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, otherUserId]);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!user || !channelRef.current) return;
    await channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id, is_typing: isTyping },
    });
  }, [user]);

  return { setTyping };
}
