import { useState, useRef, useEffect } from "react";
import type { Message, Profile } from "../lib/types";
import { formatTime } from "../lib/utils";
import Avatar from "./Avatar";
import { Check, CheckCheck, Reply, Trash2, MoreVertical, FileText, Mic, Eye } from "lucide-react";

type Props = {
  message: Message;
  isMine: boolean;
  friend: Profile;
  showAvatar: boolean;
  replyTo: Message | null;
  myReadReceipts: boolean;
  onViewOnce: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onReply: () => void;
};

export default function MessageBubble({
  message, isMine, friend, showAvatar, replyTo, myReadReceipts,
  onViewOnce, onDeleteForMe, onDeleteForEveryone, onReply,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  if (message.deleted_for_everyone) {
    return (
      <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"} px-2`}>
        {showAvatar && !isMine && <Avatar profile={friend} size="xs" />}
        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl italic text-sm ${isMine ? "rounded-br-sm" : "rounded-bl-sm"}`} style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
          This message was deleted
          <span className="text-[10px] ml-2">{formatTime(message.created_at)}</span>
        </div>
      </div>
    );
  }

  const hasAttachment = message.attachment_url && message.attachment_type;
  const isViewOnceUnviewed = message.view_once && !message.viewed;

  return (
    <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"} px-2 group`}>
      {showAvatar && !isMine ? <Avatar profile={friend} size="xs" /> : !isMine ? <div className="w-7 shrink-0" /> : null}

      <div className="relative max-w-[75%]">
        {/* Reply quote */}
        {replyTo && !replyTo.deleted_for_everyone && (
          <div className={`px-3 py-1.5 rounded-t-2xl text-xs border-l-2 ${isMine ? "rounded-tr-2xl" : "rounded-tl-2xl"}`} style={{ background: "var(--bg-elevated)", borderColor: "var(--accent)" }}>
            <p className="font-medium" style={{ color: "var(--accent)" }}>
              {replyTo.sender_id === message.sender_id ? (isMine ? "You" : friend.display_name || friend.username || "Them") : (isMine ? friend.display_name || friend.username || "Them" : "You")}
            </p>
            <p className="truncate" style={{ color: "var(--text-muted)" }}>
              {replyTo.content || (replyTo.attachment_type === "image" ? "📷 Photo" : replyTo.attachment_type === "voice" ? "🎤 Voice" : "📎 File")}
            </p>
          </div>
        )}

        <div
          className={`px-3.5 py-2 rounded-2xl ${isMine ? "rounded-br-sm" : "rounded-bl-sm"} ${replyTo ? "rounded-tr-none rounded-tl-none" : ""}`}
          style={isMine
            ? { background: "linear-gradient(135deg, #5e7d56, #477d3c)", color: "white" }
            : { background: "var(--bg-elevated)", color: "var(--text-primary)" }
          }
        >
          {/* Image attachment */}
          {hasAttachment && message.attachment_type === "image" && (
            isViewOnceUnviewed ? (
              <button onClick={onViewOnce} className="flex flex-col items-center gap-2 py-3 px-6">
                <Eye className="w-8 h-8 opacity-60" />
                <span className="text-xs opacity-70">View once — tap to open</span>
              </button>
            ) : message.view_once && message.viewed ? (
              <div className="flex flex-col items-center gap-1 py-3 px-6 opacity-50">
                <Eye className="w-6 h-6" />
                <span className="text-xs">Viewed</span>
              </div>
            ) : (
              <img src={message.attachment_url!} alt="attachment" className="rounded-xl max-w-[280px] max-h-[280px] object-cover" />
            )
          )}

          {/* Voice attachment */}
          {hasAttachment && message.attachment_type === "voice" && (
            <VoicePlayer url={message.attachment_url!} isMine={isMine} />
          )}

          {/* File attachment */}
          {hasAttachment && message.attachment_type === "file" && (
            <a href={message.attachment_url!} target="_blank" rel="noopener noreferrer" download={message.attachment_name || undefined} className="flex items-center gap-3 py-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={isMine ? { background: "rgba(255,255,255,0.2)" } : { background: "var(--bg-panel)" }}>
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium truncate max-w-[180px]">{message.attachment_name}</p>
                <p className="text-xs opacity-60">Tap to download</p>
              </div>
            </a>
          )}

          {/* Text content */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {/* Timestamp + status */}
          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "justify-end" : "justify-end"}`}>
            <span className="text-[10px] opacity-60">{formatTime(message.created_at)}</span>
            {isMine && (
              <span className="opacity-70">
                {!message.delivered_at ? <Check className="w-3 h-3" /> : (message.read_at && myReadReceipts) ? <CheckCheck className="w-3 h-3" /> : <CheckCheck className="w-3 h-3 opacity-50" />}
              </span>
            )}
          </div>
        </div>

        {/* Hover actions */}
        <div className={`absolute -top-3 ${isMine ? "right-0" : "left-0"} opacity-0 group-hover:opacity-100 transition-opacity`}>
          <div ref={menuRef} className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-lg shadow-soft" style={{ background: "var(--bg-panel)" }}>
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div className={`absolute top-full mt-1 z-20 card shadow-soft py-1 min-w-[150px] animate-fade-in ${isMine ? "right-0" : "left-0"}`}>
                <button onClick={() => { onReply(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/40 flex items-center gap-2">
                  <Reply className="w-3.5 h-3.5" /> Reply
                </button>
                <button onClick={() => { onDeleteForMe(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/40 flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" /> Delete for me
                </button>
                {isMine && (
                  <button onClick={() => { onDeleteForEveryone(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-xs text-left text-red-500 hover:bg-red-500/10 flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Delete for everyone
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VoicePlayer({ url, isMine }: { url: string; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onloadedmetadata = () => setDuration(audioRef.current?.duration || 0);
    }
  }, []);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div className="flex items-center gap-2 py-1 min-w-[160px]">
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
      <button onClick={toggle} className="w-8 h-8 rounded-full flex items-center justify-center" style={isMine ? { background: "rgba(255,255,255,0.2)" } : { background: "var(--bg-panel)" }}>
        {playing ? <span className="text-xs">❚❚</span> : <Mic className="w-4 h-4" />}
      </button>
      <div className="flex-1 flex items-center gap-0.5">
        {[...Array(20)].map((_, i) => (
          <span
            key={i}
            className="w-0.5 rounded-full"
            style={{
              height: `${4 + Math.sin(i * 0.8) * 6 + 4}px`,
              background: isMine ? "rgba(255,255,255,0.5)" : "var(--text-muted)",
            }}
          />
        ))}
      </div>
      <span className="text-[10px] opacity-60">{duration > 0 ? `${Math.round(duration)}s` : "Voice"}</span>
    </div>
  );
}
