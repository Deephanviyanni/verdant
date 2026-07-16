/*
# Fix security issues

## Changes
1. Remove the broad SELECT policy `chat_media_read_authenticated` on `storage.objects`.
   Public buckets serve objects via signed/public URLs without needing a SELECT
   policy — keeping it allows clients to list all files in the bucket, exposing
   more than intended. Object access still works via the public bucket URL.
2. Revoke EXECUTE on `public.handle_new_user()` from `anon` and `authenticated`.
   This function is a SECURITY DEFINER trigger that should only be invoked by the
   database (as a trigger on auth.users), not callable via the REST API by any
   client role.

## Security
- Reduces storage.objects exposure: clients can no longer enumerate bucket contents.
- Prevents privilege escalation via the SECURITY DEFINER function from unauthenticated
  or authenticated API callers.
*/

-- 1. Remove broad SELECT policy on storage.objects for chat-media bucket
DROP POLICY IF EXISTS "chat_media_read_authenticated" ON storage.objects;

-- 2. Revoke EXECUTE on handle_new_user from anon and authenticated (and public)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
