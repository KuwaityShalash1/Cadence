import type { User } from "@supabase/supabase-js";

/**
 * Extracts the user's profile picture URL directly from Supabase session metadata.
 * Inspects Google OAuth fields `avatar_url` and `picture`, identity data,
 * and falls back to any custom local avatar URL if provided.
 */
export function extractUserAvatarUrl(
  user: User | null | undefined,
  fallbackAvatar?: string,
): string | undefined {
  if (user?.user_metadata) {
    const meta = user.user_metadata as Record<string, unknown>;
    const googleAvatar =
      (meta["avatar_url"] as string | undefined) ||
      (meta["picture"] as string | undefined);

    if (
      typeof googleAvatar === "string" &&
      googleAvatar.trim().length > 0 &&
      (googleAvatar.startsWith("http://") ||
        googleAvatar.startsWith("https://") ||
        googleAvatar.startsWith("data:"))
    ) {
      return googleAvatar.trim();
    }
  }

  if (user?.identities && Array.isArray(user.identities)) {
    for (const identity of user.identities) {
      const data = identity.identity_data as Record<string, unknown> | undefined;
      if (data) {
        const identityAvatar =
          (data["avatar_url"] as string | undefined) ||
          (data["picture"] as string | undefined);
        if (
          typeof identityAvatar === "string" &&
          identityAvatar.trim().length > 0 &&
          (identityAvatar.startsWith("http://") ||
            identityAvatar.startsWith("https://") ||
            identityAvatar.startsWith("data:"))
        ) {
          return identityAvatar.trim();
        }
      }
    }
  }

  // Fallback to locally configured avatar if it is a valid URL or data URL
  if (
    fallbackAvatar &&
    typeof fallbackAvatar === "string" &&
    fallbackAvatar.trim().length > 0 &&
    (fallbackAvatar.startsWith("http://") ||
      fallbackAvatar.startsWith("https://") ||
      fallbackAvatar.startsWith("data:"))
  ) {
    return fallbackAvatar.trim();
  }

  return undefined;
}

/**
 * Extracts the user's display name from Supabase session metadata,
 * falling back to local settings display name or email prefix.
 */
export function extractUserDisplayName(
  user: User | null | undefined,
  fallbackName?: string,
): string {
  if (user?.user_metadata) {
    const meta = user.user_metadata as Record<string, unknown>;
    const name =
      (meta["full_name"] as string | undefined) ||
      (meta["name"] as string | undefined);

    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }
  }

  if (user?.identities && Array.isArray(user.identities)) {
    for (const identity of user.identities) {
      const data = identity.identity_data as Record<string, unknown> | undefined;
      if (data) {
        const identityName =
          (data["full_name"] as string | undefined) ||
          (data["name"] as string | undefined);
        if (typeof identityName === "string" && identityName.trim().length > 0) {
          return identityName.trim();
        }
      }
    }
  }

  if (fallbackName && typeof fallbackName === "string" && fallbackName.trim().length > 0) {
    return fallbackName.trim();
  }

  if (user?.email) {
    const emailPrefix = user.email.split("@")[0];
    if (emailPrefix) {
      return emailPrefix;
    }
  }

  return "User";
}

/**
 * Generates up to two uppercase initials from a name string for avatar fallback.
 */
export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0] ?? "";
    const second = parts[1] ?? "";
    return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

