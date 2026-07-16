import type { Profile } from "./types";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function formatLastSeen(iso: string | null, hidden: boolean): string {
  if (hidden) return "";
  if (!iso) return "a while ago";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function isOnline(profile: Profile | null, onlineIds: Set<string>): boolean {
  if (!profile) return false;
  if (profile.hide_online_status) return false;
  return onlineIds.has(profile.id);
}

export function initials(name: string | null, username: string | null): string {
  const base = (name || username || "?").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function fileKind(name: string): "image" | "file" {
  const lower = name.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) return "image";
  return "file";
}

export function bytesToSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
