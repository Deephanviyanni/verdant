import { useState, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { supabase } from "./lib/supabase";
import type { Profile } from "./lib/types";
import { usePresence } from "./hooks/usePresence";
import { useChatData } from "./hooks/useChatData";
import AuthScreen from "./screens/AuthScreen";
import ProfileSetup from "./screens/ProfileSetup";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ProfileModal from "./components/ProfileModal";
import SettingsModal from "./components/SettingsModal";
import FriendSearchModal from "./components/FriendSearchModal";
import { Leaf } from "lucide-react";

function MainApp() {
  const { user, profile, loading } = useAuth();
  const { onlineIds, refreshTrack } = usePresence();
  const {
    chatList, pendingRequests, sentRequests, notifications,
    refreshAll,
  } = useChatData();
  const [activeChat, setActiveChat] = useState<Profile | null>(null);
  const [profileModal, setProfileModal] = useState<{ profile: Profile | null; isOwn: boolean } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleSelectChat = useCallback((p: Profile) => {
    setActiveChat(p);
  }, []);

  const handleAcceptRequest = useCallback(async (friendshipId: string, otherId: string) => {
    if (!user) return;
    await supabase.from("friendships").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", friendshipId);
    await supabase.from("notifications").insert({
      user_id: otherId,
      actor_id: user.id,
      type: "friend_accepted",
      data: {},
    });
    await refreshAll();
  }, [user, refreshAll]);

  const handleDeclineRequest = useCallback(async (friendshipId: string) => {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    await refreshAll();
  }, [refreshAll]);

  const handleRemoveFriend = useCallback(async (friendId: string) => {
    if (!user) return;
    await supabase
      .from("friendships")
      .delete()
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`);
    setActiveChat(null);
    await refreshAll();
  }, [user, refreshAll]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center nature-gradient">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: "linear-gradient(135deg, #7d9a74, #477d3c)" }}>
            <Leaf className="w-7 h-7 text-white" />
          </div>
          <span className="w-6 h-6 border-2 border-moss-500/30 border-t-moss-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  if (user && !profile?.username) return <ProfileSetup />;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`w-full sm:w-80 md:w-96 border-r shrink-0 ${activeChat ? "hidden lg:flex" : "flex"} flex-col`}>
        <Sidebar
          chatList={chatList}
          pendingRequests={pendingRequests}
          sentRequests={sentRequests}
          notifications={notifications}
          onlineIds={onlineIds}
          activeChatId={activeChat?.id ?? null}
          onSelectChat={handleSelectChat}
          onAcceptRequest={handleAcceptRequest}
          onDeclineRequest={handleDeclineRequest}
          onOpenSettings={() => setShowSettings(true)}
          onOpenProfile={() => setProfileModal({ profile, isOwn: true })}
          onOpenSearch={() => setShowSearch(true)}
        />
      </aside>

      {/* Chat area */}
      <main className={`flex-1 ${activeChat ? "flex" : "hidden lg:flex"} flex-col`}>
        {activeChat ? (
          <ChatWindow
            key={activeChat.id}
            friend={activeChat}
            onlineIds={onlineIds}
            onBack={() => setActiveChat(null)}
            onOpenProfile={(p) => setProfileModal({ profile: p, isOwn: false })}
            onRemoveFriend={handleRemoveFriend}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center nature-gradient leaf-pattern text-center px-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "linear-gradient(135deg, #a3c2a4, #7d9a74)" }}>
              <Leaf className="w-10 h-10 text-white" />
            </div>
            <h2 className="font-serif text-2xl font-semibold mb-2">Welcome to Verdant</h2>
            <p className="text-sm max-w-xs" style={{ color: "var(--text-muted)" }}>
              Select a conversation or find a friend to start chatting privately.
            </p>
          </div>
        )}
      </main>

      {/* Modals */}
      {profileModal && (
        <ProfileModal
          profile={profileModal.profile}
          isOwn={profileModal.isOwn}
          onClose={() => setProfileModal(null)}
        />
      )}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onPrivacyChanged={refreshTrack}
        />
      )}
      {showSearch && (
        <FriendSearchModal
          onClose={() => setShowSearch(false)}
          onSent={refreshAll}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
