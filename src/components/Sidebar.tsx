import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import type { ChatListItem, FriendRequestItem } from "../hooks/useChatData";
import type { Profile, AppNotification } from "../lib/types";
import { isOnline, formatTime, formatLastSeen } from "../lib/utils";
import Avatar from "./Avatar";
import { Search, Users, MessageSquare, Bell, Settings, Leaf, Moon, Sun, X, UserPlus, Check } from "lucide-react";

type Tab = "chats" | "friends" | "requests";

type Props = {
  chatList: ChatListItem[];
  pendingRequests: FriendRequestItem[];
  sentRequests: Profile[];
  notifications: AppNotification[];
  onlineIds: Set<string>;
  activeChatId: string | null;
  onSelectChat: (profile: Profile) => void;
  onAcceptRequest: (friendshipId: string, otherId: string) => void;
  onDeclineRequest: (friendshipId: string) => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenSearch: () => void;
};

export default function Sidebar({
  chatList, pendingRequests, sentRequests, onlineIds,
  activeChatId, onSelectChat, onAcceptRequest, onDeclineRequest,
  onOpenSettings, onOpenProfile, onOpenSearch,
}: Props) {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<Tab>("chats");
  const [search, setSearch] = useState("");


  const filteredChats = chatList.filter((c) => {
    const name = (c.friend.display_name || c.friend.username || "").toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-panel)" }}>
      {/* Header */}
      <div className="px-4 py-3.5 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7d9a74, #477d3c)" }}>
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="font-serif text-lg font-semibold">Verdant</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggle} className="btn-ghost p-2" aria-label="Toggle theme">
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button onClick={onOpenSettings} className="btn-ghost p-2" aria-label="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Profile chip */}
      <button onClick={onOpenProfile} className="px-4 py-3 border-b flex items-center gap-3 hover:bg-stone-100 dark:hover:bg-stone-800/40 transition-colors text-left">
        <Avatar profile={profile} size="sm" online={isOnline(profile, onlineIds)} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{profile?.display_name || profile?.username || "You"}</p>
          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>@{profile?.username}</p>
        </div>
      </button>

      {/* Tabs */}
      <div className="px-3 pt-3 flex gap-1">
        <TabButton active={tab === "chats"} onClick={() => setTab("chats")} icon={<MessageSquare className="w-4 h-4" />} label="Chats" badge={chatList.filter(c => c.unreadCount > 0).length} />
        <TabButton active={tab === "requests"} onClick={() => setTab("requests")} icon={<Bell className="w-4 h-4" />} label="Requests" badge={pendingRequests.length} />
        <TabButton active={tab === "friends"} onClick={() => setTab("friends")} icon={<Users className="w-4 h-4" />} label="Friends" />
      </div>

      {/* Search (chats tab only) */}
      {tab === "chats" && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></button>}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2">
        {tab === "chats" && (
          <div className="space-y-0.5">
            {filteredChats.length === 0 && (
              <EmptyState text="No conversations yet. Add a friend to start chatting." action={<button onClick={onOpenSearch} className="btn-primary text-sm mt-2"><UserPlus className="w-4 h-4 inline mr-1" />Find friends</button>} />
            )}
            {filteredChats.map((item) => (
              <ChatRow
                key={item.friend.id}
                item={item}
                onlineIds={onlineIds}
                active={activeChatId === item.friend.id}
                onClick={() => onSelectChat(item.friend)}
              />
            ))}
          </div>
        )}

        {tab === "requests" && (
          <div className="space-y-2">
            {pendingRequests.length === 0 && <EmptyState text="No pending requests." />}
            {pendingRequests.map((req) => (
              <div key={req.friendship.id} className="px-3 py-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800/40 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar profile={req.profile} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{req.profile.display_name || req.profile.username}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>@{req.profile.username} wants to connect</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => onAcceptRequest(req.friendship.id, req.profile.id)} className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" /> Accept
                  </button>
                  <button onClick={() => onDeclineRequest(req.friendship.id)} className="btn-ghost flex-1 text-sm py-2 border">
                    Decline
                  </button>
                </div>
              </div>
            ))}

            {sentRequests.length > 0 && (
              <>
                <p className="text-xs font-medium px-3 pt-3 pb-1" style={{ color: "var(--text-muted)" }}>SENT REQUESTS</p>
                {sentRequests.map((p) => (
                  <div key={p.id} className="px-3 py-2.5 rounded-xl flex items-center gap-3">
                    <Avatar profile={p} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.display_name || p.username}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Pending...</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "friends" && (
          <div className="space-y-0.5">
            <div className="px-3 py-2">
              <button onClick={onOpenSearch} className="btn-primary w-full text-sm flex items-center justify-center gap-1.5">
                <UserPlus className="w-4 h-4" /> Add friend
              </button>
            </div>
            {chatList.length === 0 && <EmptyState text="No friends yet. Start by adding one!" />}
            {chatList.map((item) => (
              <button
                key={item.friend.id}
                onClick={() => onSelectChat(item.friend)}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors text-left ${activeChatId === item.friend.id ? "bg-moss-500/10" : "hover:bg-stone-100 dark:hover:bg-stone-800/40"}`}
              >
                <Avatar profile={item.friend} size="md" online={isOnline(item.friend, onlineIds)} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.friend.display_name || item.friend.username}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {isOnline(item.friend, onlineIds) ? "Online" : formatLastSeen(item.friend.last_seen, item.friend.hide_last_seen) || "Offline"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t">
        <button onClick={signOut} className="btn-ghost w-full text-sm">Sign out</button>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium transition-all relative ${active ? "text-leaf-600 dark:text-leaf-400" : ""}`}
      style={active ? { background: "var(--bg-elevated)" } : { color: "var(--text-muted)" }}
    >
      <div className="relative">
        {icon}
        {badge ? (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-clay-500 text-white text-[10px] font-bold flex items-center justify-center">
            {badge}
          </span>
        ) : null}
      </div>
      {label}
    </button>
  );
}

function ChatRow({ item, onlineIds, active, onClick }: { item: ChatListItem; onlineIds: Set<string>; active: boolean; onClick: () => void }) {
  const last = item.lastMessage;
  let preview = "Say hello!";
  if (last) {
    if (last.deleted_for_everyone) preview = "Message deleted";
    else if (last.attachment_type === "image") preview = "📷 Photo";
    else if (last.attachment_type === "voice") preview = "🎤 Voice message";
    else if (last.attachment_type === "file") preview = `📎 ${last.attachment_name || "File"}`;
    else if (last.content) preview = last.content.slice(0, 50);
  }
  const online = isOnline(item.friend, onlineIds);

  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors text-left ${active ? "bg-moss-500/15" : "hover:bg-stone-100 dark:hover:bg-stone-800/40"}`}
    >
      <Avatar profile={item.friend} size="md" online={online} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sm truncate">{item.friend.display_name || item.friend.username}</p>
          {last && <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{formatTime(last.created_at)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {last && last.sender_id !== item.friend.id ? "You: " : ""}{preview}
          </p>
          {item.unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-leaf-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {item.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
