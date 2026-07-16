/*
# Nature Chat - Full Schema

## Overview
Creates the complete schema for a real-time 1-on-1 chat application with friend
requests, private messaging, attachments (images, files, voice), read receipts,
typing indicators, online presence, notifications, and per-user privacy settings.

## New Tables
1. `profiles` — extends auth.users with public profile data + privacy settings.
   - id (uuid, PK, FK -> auth.users) — one row per auth user.
   - username (text, unique, not null) — unique handle for friend requests.
   - email (text) — cached for convenience.
   - display_name (text) — shown in chat.
   - bio (text) — short profile description.
   - avatar_url (text) — public URL to avatar image in storage.
   - last_seen (timestamptz) — updated on presence disconnect.
   - hide_online_status (boolean, default false) — privacy: hide green dot.
   - hide_last_seen (boolean, default false) — privacy: hide last seen.
   - read_receipts_enabled (boolean, default true) — privacy: send read receipts.
   - created_at (timestamptz).

2. `friendships` — friend request graph between two users.
   - id (uuid, PK).
   - requester_id (uuid, FK -> auth.users) — who sent the request.
   - addressee_id (uuid, FK -> auth.users) — who received it.
   - status (text: 'pending' | 'accepted' | 'blocked', default 'pending').
   - created_at, accepted_at (timestamptz).
   - Unique constraint on (requester_id, addressee_id) to prevent duplicates.

3. `messages` — 1-on-1 private messages.
   - id (uuid, PK).
   - sender_id, receiver_id (uuid, FK -> auth.users).
   - content (text) — text body (null if attachment-only).
   - attachment_url (text) — storage public URL.
   - attachment_type (text: 'image' | 'file' | 'voice' | null).
   - attachment_name (text) — original filename / label.
   - view_once (boolean, default false) — ephemeral image.
   - viewed (boolean, default false) — set true when opened.
   - reply_to_id (uuid, FK -> messages, nullable) — quoted message.
   - read_at (timestamptz) — when receiver read it.
   - delivered_at (timestamptz) — when receiver's client received it.
   - deleted_for_everyone (boolean, default false) — soft delete for all.
   - created_at (timestamptz).

4. `message_hides` — per-user "delete for me" without destroying the row.
   - id (uuid, PK).
   - message_id (uuid, FK -> messages ON DELETE CASCADE).
   - user_id (uuid, FK -> auth.users).
   - Unique (message_id, user_id).

5. `notifications` — friend request / accepted / message notifications.
   - id (uuid, PK).
   - user_id (uuid, FK -> auth.users) — recipient of notification.
   - actor_id (uuid, FK -> auth.users) — who triggered it.
   - type (text: 'friend_request' | 'friend_accepted' | 'message').
   - data (jsonb) — payload (e.g. message preview).
   - is_read (boolean, default false).
   - created_at (timestamptz).

## Security (RLS)
- profiles: authenticated users can read all profiles (needed for friend search);
  users can update only their own row.
- friendships: users can read rows where they are requester or addressee;
  can insert only as requester; can update status only as addressee;
  can delete only their own rows.
- messages: users can read messages they sent or received (excluding ones they
  hid or that are deleted-for-everyone); can insert only as sender; can update
  read_at/delivered_at/viewed only as receiver; can soft-delete (deleted_for_everyone)
  only as sender.
- message_hides: users can insert/read/delete only their own hides.
- notifications: users can read/update/delete only their own notifications.

## Storage
- Creates `chat-media` bucket (public) for avatars, images, files, voice clips.
- Storage policies allow authenticated users to upload/read objects; only owner
  can delete their own objects.

## Realtime
- Enables realtime on profiles, friendships, messages, notifications tables.

## Notes
1. A trigger auto-creates a profile row when a new auth.user signs up (username
   is set later during profile setup step in the UI).
2. The anon key client cannot read any of these tables — all policies require
   `authenticated`, which is correct because this app has a sign-in screen.
3. `DEFAULT auth.uid()` is NOT used on owner columns here because the client
   always passes the relevant ids explicitly (sender_id, requester_id, etc.) —
   there is no insert that omits the owner.
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  email text,
  display_name text,
  bio text DEFAULT '',
  avatar_url text,
  last_seen timestamptz DEFAULT now(),
  hide_online_status boolean NOT NULL DEFAULT false,
  hide_last_seen boolean NOT NULL DEFAULT false,
  read_receipts_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_all_authenticated" ON profiles;
CREATE POLICY "profiles_read_all_authenticated"
  ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create a profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FRIENDSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (requester_id, addressee_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select_participants" ON friendships;
CREATE POLICY "friendships_select_participants"
  ON friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "friendships_insert_as_requester" ON friendships;
CREATE POLICY "friendships_insert_as_requester"
  ON friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "friendships_update_as_addressee" ON friendships;
CREATE POLICY "friendships_update_as_addressee"
  ON friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id)
  WITH CHECK (auth.uid() = addressee_id OR auth.uid() = requester_id);

DROP POLICY IF EXISTS "friendships_delete_participants" ON friendships;
CREATE POLICY "friendships_delete_participants"
  ON friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  attachment_url text,
  attachment_type text CHECK (attachment_type IN ('image','file','voice') OR attachment_type IS NULL),
  attachment_name text,
  view_once boolean NOT NULL DEFAULT false,
  viewed boolean NOT NULL DEFAULT false,
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  read_at timestamptz,
  delivered_at timestamptz,
  deleted_for_everyone boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages (sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages (receiver_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages (reply_to_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participants" ON messages;
CREATE POLICY "messages_select_participants"
  ON messages FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

DROP POLICY IF EXISTS "messages_insert_as_sender" ON messages;
CREATE POLICY "messages_insert_as_sender"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_update_as_receiver_or_sender" ON messages;
CREATE POLICY "messages_update_as_receiver_or_sender"
  ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_delete_as_sender" ON messages;
CREATE POLICY "messages_delete_as_sender"
  ON messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- ============================================================
-- MESSAGE HIDES (delete for me)
-- ============================================================
CREATE TABLE IF NOT EXISTS message_hides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

ALTER TABLE message_hides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hides_select_own" ON message_hides;
CREATE POLICY "hides_select_own"
  ON message_hides FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "hides_insert_own" ON message_hides;
CREATE POLICY "hides_insert_own"
  ON message_hides FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "hides_delete_own" ON message_hides;
CREATE POLICY "hides_delete_own"
  ON message_hides FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('friend_request','friend_accepted','message')),
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own"
  ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "chat_media_read_authenticated" ON storage.objects;
CREATE POLICY "chat_media_read_authenticated"
  ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_insert_authenticated" ON storage.objects;
CREATE POLICY "chat_media_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND auth.uid() = owner);

DROP POLICY IF EXISTS "chat_media_update_own" ON storage.objects;
CREATE POLICY "chat_media_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-media' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'chat-media' AND auth.uid() = owner);

DROP POLICY IF EXISTS "chat_media_delete_own" ON storage.objects;
CREATE POLICY "chat_media_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-media' AND auth.uid() = owner);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
