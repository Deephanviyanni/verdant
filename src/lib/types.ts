export type Profile = {
  id: string;
  username: string | null;
  email: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  last_seen: string | null;
  hide_online_status: boolean;
  hide_last_seen: boolean;
  read_receipts_enabled: boolean;
  created_at: string;
};

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  accepted_at: string | null;
};

export type AttachmentType = "image" | "file" | "voice" | null;

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: AttachmentType;
  attachment_name: string | null;
  view_once: boolean;
  viewed: boolean;
  reply_to_id: string | null;
  read_at: string | null;
  delivered_at: string | null;
  deleted_for_everyone: boolean;
  created_at: string;
};

export type MessageHide = {
  id: string;
  message_id: string;
  user_id: string;
  created_at: string;
};

export type NotificationType = "friend_request" | "friend_accepted" | "message";

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string;
  type: NotificationType;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

export type PrivacySettings = {
  hide_online_status: boolean;
  hide_last_seen: boolean;
  read_receipts_enabled: boolean;
};

export type Theme = "light" | "dark";
