import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTypingChannel } from "../hooks/useTypingChannel";
import type { Profile, Message } from "../lib/types";
import { isOnline, formatDateDivider, formatLastSeen } from "../lib/utils";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import { ArrowLeft, Phone, Video, MoreVertical, Trash2, UserX } from "lucide-react";

type Props = {
  friend: Profile;
  onlineIds: Set<string>;
  onBack: () => void;
  onOpenProfile: (profile: Profile) => void;
  onRemoveFriend: (friendId: string) => void;
};

export default function ChatWindow({ friend, onlineIds, onBack, onOpenProfile, onRemoveFriend }: Props) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [typing, setTypingState] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [viewOnceImage, setViewOnceImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const { setTyping } = useTypingChannel(friend.id, setTypingState);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true })
      .limit(200);
    const { data: hides } = await supabase
      .from("message_hides")
      .select("message_id")
      .eq("user_id", user.id);
    setHiddenIds(new Set((hides || []).map((h) => h.message_id)));
    setMessages((msgs || []) as Message[]);
    setLoading(false);
  }, [user, friend.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat:${friend.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${friend.id}` }, (payload) => {
        const msg = payload.new as Message;
        if (msg.receiver_id === user.id) {
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          // Mark delivered
          (async () => {
            await supabase.from("messages").update({ delivered_at: new Date().toISOString() }).eq("id", msg.id);
          })();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_hides", filter: `user_id=eq.${user.id}` }, (payload) => {
        const hide = payload.new as { message_id: string };
        setHiddenIds((prev) => new Set(prev).add(hide.message_id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, friend.id]);

  // Mark incoming messages as read
  useEffect(() => {
    if (!user || !profile) return;
    if (!profile.read_receipts_enabled) return; // respect my privacy
    const unread = messages.filter((m) => m.receiver_id === user.id && !m.read_at && !m.deleted_for_everyone);
    if (unread.length === 0) return;
    (async () => {
      const now = new Date().toISOString();
      await supabase.from("messages").update({ read_at: now }).in("id", unread.map((m) => m.id));
    })();
  }, [messages, user, profile]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleSend = async (content: string, attachment?: { url: string; type: "image" | "file" | "voice"; name: string; viewOnce?: boolean }) => {
    if (!user) return;
    const { data } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: friend.id,
      content: content || null,
      attachment_url: attachment?.url || null,
      attachment_type: attachment?.type || null,
      attachment_name: attachment?.name || null,
      view_once: attachment?.viewOnce || false,
      reply_to_id: replyTo?.id || null,
    }).select("*").single();
    if (data) {
      setMessages((prev) => [...prev, data as Message]);
    }
    setReplyTo(null);
    setTyping(false);
    setTypingState(false);
    isTypingRef.current = false;
  };

  const handleTyping = (typing: boolean) => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setTyping(typing);
    if (typing && !isTypingRef.current) {
      isTypingRef.current = true;
      setTypingState(true);
    }
    if (typing) {
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        setTypingState(false);
      }, 3000);
    } else {
      isTypingRef.current = false;
      setTypingState(false);
    }
  };

  const handleDeleteForMe = async (msgId: string) => {
    if (!user) return;
    await supabase.from("message_hides").insert({ message_id: msgId, user_id: user.id });
    setHiddenIds((prev) => new Set(prev).add(msgId));
  };

  const handleDeleteForEveryone = async (msgId: string) => {
    await supabase.from("messages").update({ deleted_for_everyone: true, content: null, attachment_url: null, attachment_type: null, attachment_name: null }).eq("id", msgId);
  };

  const handleViewOnce = async (msg: Message) => {
    if (msg.attachment_url) setViewOnceImage(msg.attachment_url);
    if (user) {
      await supabase.from("messages").update({ viewed: true }).eq("id", msg.id);
    }
  };

  const online = isOnline(friend, onlineIds);
  const statusText = online
    ? "Online"
    : formatLastSeen(friend.last_seen, friend.hide_last_seen) || "Offline";

  // Group messages by date
  const visibleMessages = messages.filter((m) => !hiddenIds.has(m.id));
  const groups: { date: string; msgs: Message[] }[] = [];
  for (const msg of visibleMessages) {
    const dateKey = new Date(msg.created_at).toDateString();
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.msgs.push(msg);
    } else {
      groups.push({ date: dateKey, msgs: [msg] });
    }
  }

  return (
    <div className="h-full flex flex-col nature-gradient leaf-pattern">
      {/* Header */}
      <div className="glass border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="lg:hidden btn-ghost p-1.5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button onClick={() => onOpenProfile(friend)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <Avatar profile={friend} size="md" online={online} />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{friend.display_name || friend.username}</p>
            <p className="text-xs truncate" style={{ color: typing ? "var(--accent)" : "var(--text-muted)" }}>
              {typing ? "typing..." : statusText}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <button className="btn-ghost p-2" title="Voice call (coming soon)"><Phone className="w-4 h-4" /></button>
          <button className="btn-ghost p-2" title="Video call (coming soon)"><Video className="w-4 h-4" /></button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="btn-ghost p-2">
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 card shadow-soft py-1 min-w-[180px] animate-fade-in">
                  <button
                    onClick={() => { onOpenProfile(friend); setShowMenu(false); }}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-stone-100 dark:hover:bg-stone-800/40 flex items-center gap-2"
                  >
                    View profile
                  </button>
                  <button
                    onClick={() => { onRemoveFriend(friend.id); setShowMenu(false); }}
                    className="w-full px-4 py-2 text-sm text-left text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                  >
                    <UserX className="w-4 h-4" /> Remove friend
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="w-6 h-6 border-2 border-moss-500/30 border-t-moss-500 rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--bg-elevated)" }}>
              <Avatar profile={friend} size="lg" />
            </div>
            <p className="font-serif text-lg font-medium mb-1">{friend.display_name || friend.username}</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>This is the beginning of your conversation.</p>
          </div>
        ) : (
          groups.map((group, gi) => (
            <div key={gi}>
              <div className="flex justify-center my-3">
                <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                  {formatDateDivider(group.msgs[0].created_at)}
                </span>
              </div>
              {group.msgs.map((msg, mi) => {
                const isMine = msg.sender_id === user?.id;
                const prev = mi > 0 ? group.msgs[mi - 1] : null;
                const showAvatar = !isMine && (!prev || prev.sender_id !== msg.sender_id);
                const replyMsg = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isMine={isMine}
                    friend={friend}
                    showAvatar={showAvatar}
                    replyTo={replyMsg || null}
                    myReadReceipts={profile?.read_receipts_enabled ?? true}
                    onViewOnce={() => handleViewOnce(msg)}
                    onDeleteForMe={() => handleDeleteForMe(msg.id)}
                    onDeleteForEveryone={() => handleDeleteForEveryone(msg.id)}
                    onReply={() => setReplyTo(msg)}
                  />
                );
              })}
            </div>
          ))
        )}
        {typing && (
          <div className="flex items-center gap-2 px-2 py-1">
            <Avatar profile={friend} size="xs" />
            <div className="flex items-center gap-1 px-3 py-2.5 rounded-2xl rounded-bl-sm" style={{ background: "var(--bg-elevated)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-moss-400 animate-typing" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-moss-400 animate-typing" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-moss-400 animate-typing" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 border-t flex items-center gap-3" style={{ background: "var(--bg-elevated)" }}>
          <div className="w-1 h-8 rounded-full bg-leaf-500" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>Replying to {replyTo.sender_id === user?.id ? "yourself" : friend.display_name || friend.username}</p>
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {replyTo.content || (replyTo.attachment_type === "image" ? "📷 Photo" : replyTo.attachment_type === "voice" ? "🎤 Voice" : "📎 File") || "Message"}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="btn-ghost p-1"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}

      {/* Input */}
      <MessageInput onSend={handleSend} onTyping={handleTyping} friendId={friend.id} />

      {/* View-once image modal */}
      {viewOnceImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-fade-in" onClick={() => setViewOnceImage(null)}>
          <img src={viewOnceImage} alt="View once" className="max-w-full max-h-full rounded-lg" />
          <p className="absolute bottom-8 text-white/70 text-sm">Tap anywhere to close — this image can only be viewed once.</p>
        </div>
      )}
    </div>
  );
}
