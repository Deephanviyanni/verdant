import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Profile, Friendship, Message, AppNotification } from "../lib/types";

export type ChatListItem = {
  friend: Profile;
  lastMessage: Message | null;
  unreadCount: number;
};

export type FriendRequestItem = {
  friendship: Friendship;
  profile: Profile;
};

export function useChatData() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestItem[]>([]);
  const [sentRequests, setSentRequests] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [allProfiles, setAllProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  mountedRef.current = true;

  const fetchProfile = useCallback(async (id: string): Promise<Profile | null> => {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    return data as Profile | null;
  }, []);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    // Accepted friendships where I'm either side
    const { data: accepted } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted");

    const friendIds = (accepted || []).map((f: Friendship) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );
    const uniqueIds = [...new Set(friendIds)];

    if (uniqueIds.length === 0) { setFriends([]); setChatList([]); return; }

    const { data: friendProfiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", uniqueIds);

    const profiles = (friendProfiles || []) as Profile[];
    setFriends(profiles);

    // Build profile map
    setAllProfiles((prev) => {
      const m = new Map(prev);
      profiles.forEach((p) => m.set(p.id, p));
      return m;
    });

    // Get last message + unread count for each friend
    const items: ChatListItem[] = [];
    for (const fp of profiles) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${fp.id}),and(sender_id.eq.${fp.id},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: false })
        .limit(20);

      // Filter out messages hidden by me
      const visibleMsgs = (msgs || []) as Message[];

      // Get my hides
      const { data: hides } = await supabase
        .from("message_hides")
        .select("message_id")
        .eq("user_id", user.id);
      const hiddenIds = new Set((hides || []).map((h) => h.message_id));
      const filtered = visibleMsgs.filter((m) => !hiddenIds.has(m.id));
      const lastMsg = filtered[0] || null;

      const unread = filtered.filter((m) => m.receiver_id === user.id && !m.read_at && !m.deleted_for_everyone).length;

      items.push({ friend: fp, lastMessage: lastMsg, unreadCount: unread });
    }

    // Sort by last message time
    items.sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return tb - ta;
    });

    setChatList(items);
  }, [user]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    // Pending requests I received
    const { data: received } = await supabase
      .from("friendships")
      .select("*")
      .eq("addressee_id", user.id)
      .eq("status", "pending");

    const reqItems: FriendRequestItem[] = [];
    for (const f of (received || []) as Friendship[]) {
      const p = await fetchProfile(f.requester_id);
      if (p) reqItems.push({ friendship: f, profile: p });
    }
    setPendingRequests(reqItems);

    // Pending requests I sent
    const { data: sent } = await supabase
      .from("friendships")
      .select("*")
      .eq("requester_id", user.id)
      .eq("status", "pending");
    const sentProfiles: Profile[] = [];
    for (const f of (sent || []) as Friendship[]) {
      const p = await fetchProfile(f.addressee_id);
      if (p) sentProfiles.push(p);
    }
    setSentRequests(sentProfiles);
  }, [user, fetchProfile]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data || []) as AppNotification[]);
  }, [user]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadFriends(), loadRequests(), loadNotifications()]);
    setLoading(false);
  }, [loadFriends, loadRequests, loadNotifications]);

  // Initial load
  useEffect(() => {
    if (user) refreshAll();
    return () => { mountedRef.current = false; };
  }, [user, refreshAll]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const msgChannel = supabase
      .channel("sidebar-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` }, () => {
        loadFriends();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `sender_id=eq.${user.id}` }, () => {
        loadFriends();
      })
      .subscribe();

    const friendChannel = supabase
      .channel("sidebar-friends")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        loadFriends();
        loadRequests();
      })
      .subscribe();

    const notifChannel = supabase
      .channel("sidebar-notifs")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(friendChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [user, loadFriends, loadRequests, loadNotifications]);

  return {
    friends, chatList, pendingRequests, sentRequests, notifications,
    allProfiles, loading, refreshAll, loadFriends, loadNotifications,
  };
}
