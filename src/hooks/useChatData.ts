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
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestItem[]>([]);
  const [sentRequests, setSentRequests] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    const { data: accepted } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted");

    const friendIds = (accepted || []).map((f: Friendship) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );
    const uniqueIds = [...new Set(friendIds)];

    if (uniqueIds.length === 0) { setChatList([]); return; }

    const [profilesRes, hidesRes] = await Promise.all([
      supabase.from("profiles").select("*").in("id", uniqueIds),
      supabase.from("message_hides").select("message_id").eq("user_id", user.id),
    ]);

    const profiles = (profilesRes.data || []) as Profile[];
    const hiddenIds = new Set((hidesRes.data || []).map((h) => h.message_id));

    const [sentMsgs, recvMsgs] = await Promise.all([
      supabase.from("messages")
        .select("*")
        .in("receiver_id", uniqueIds)
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("messages")
        .select("*")
        .in("sender_id", uniqueIds)
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const allMsgs = [...(sentMsgs.data || []), ...(recvMsgs.data || [])] as Message[];
    const lastByFriend = new Map<string, Message>();
    const unreadByFriend = new Map<string, number>();

    for (const msg of allMsgs) {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (hiddenIds.has(msg.id)) continue;
      const existing = lastByFriend.get(otherId);
      if (!existing || new Date(msg.created_at) > new Date(existing.created_at)) {
        lastByFriend.set(otherId, msg);
      }
      if (msg.receiver_id === user.id && !msg.read_at && !msg.deleted_for_everyone) {
        unreadByFriend.set(otherId, (unreadByFriend.get(otherId) || 0) + 1);
      }
    }

    const items: ChatListItem[] = profiles.map((fp) => ({
      friend: fp,
      lastMessage: lastByFriend.get(fp.id) || null,
      unreadCount: unreadByFriend.get(fp.id) || 0,
    }));

    items.sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return tb - ta;
    });

    setChatList(items);
  }, [user]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    const [receivedRes, sentRes] = await Promise.all([
      supabase.from("friendships").select("*").eq("addressee_id", user.id).eq("status", "pending"),
      supabase.from("friendships").select("*").eq("requester_id", user.id).eq("status", "pending"),
    ]);

    const received = (receivedRes.data || []) as Friendship[];
    const sent = (sentRes.data || []) as Friendship[];

    const receivedIds = received.map((f) => f.requester_id);
    const sentIds = sent.map((f) => f.addressee_id);
    const allIds = [...new Set([...receivedIds, ...sentIds])];

    if (allIds.length === 0) {
      setPendingRequests([]);
      setSentRequests([]);
      return;
    }

    const { data: profilesData } = await supabase.from("profiles").select("*").in("id", allIds);
    const profileMap = new Map<string, Profile>();
    (profilesData || []).forEach((p) => profileMap.set((p as Profile).id, p as Profile));

    const reqItems: FriendRequestItem[] = received
      .map((f) => {
        const p = profileMap.get(f.requester_id);
        return p ? { friendship: f, profile: p } : null;
      })
      .filter((x): x is FriendRequestItem => x !== null);

    const sentProfiles = sentIds
      .map((id) => profileMap.get(id))
      .filter((p): p is Profile => p !== null);

    setPendingRequests(reqItems);
    setSentRequests(sentProfiles);
  }, [user]);

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

  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadFriends();
      loadRequests();
      loadNotifications();
    }, 300);
  }, [loadFriends, loadRequests, loadNotifications]);

  useEffect(() => {
    if (user) refreshAll();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [user, refreshAll]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("sidebar-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` }, debouncedRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` }, debouncedRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${user.id}` }, debouncedRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, debouncedRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, debouncedRefresh)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, debouncedRefresh]);

  return {
    chatList, pendingRequests, sentRequests, notifications,
    loading, refreshAll, loadFriends, loadNotifications,
  };
}
