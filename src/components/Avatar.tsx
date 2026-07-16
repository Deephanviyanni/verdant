import { initials as getInitials } from "../lib/utils";
import type { Profile } from "../lib/types";

type Props = {
  profile?: Profile | null;
  username?: string | null;
  displayName?: string | null;
  url?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;
  showRing?: boolean;
};

const sizes = {
  xs: "w-7 h-7 text-[10px]",
  sm: "w-9 h-9 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-16 h-16 text-lg",
  xl: "w-24 h-24 text-2xl",
};

const dotSizes = {
  xs: "w-2 h-2 -bottom-0 -right-0",
  sm: "w-2.5 h-2.5 -bottom-0 -right-0",
  md: "w-3 h-3 -bottom-0.5 -right-0.5",
  lg: "w-4 h-4 -bottom-1 -right-1",
  xl: "w-5 h-5 -bottom-1 -right-1",
};

export default function Avatar({ profile, username, displayName, url, size = "md", online, showRing }: Props) {
  const avatarUrl = url ?? profile?.avatar_url ?? null;
  const name = displayName ?? profile?.display_name ?? null;
  const uname = username ?? profile?.username ?? null;
  const initials = getInitials(name, uname);

  return (
    <div className="relative inline-block shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || uname || "avatar"}
          className={`${sizes[size]} rounded-full object-cover ${showRing ? "ring-2 ring-moss-400/40" : ""}`}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white`}
          style={{ background: "linear-gradient(135deg, #7d9a74, #5e7d56)" }}
        >
          {initials}
        </div>
      )}
      {online && (
        <span className={`absolute ${dotSizes[size]} bg-leaf-500 rounded-full border-2`} style={{ borderColor: "var(--bg-panel)" }}>
          <span className="absolute inset-0 rounded-full bg-leaf-400 animate-ping opacity-60" />
        </span>
      )}
    </div>
  );
}
