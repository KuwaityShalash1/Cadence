import type { User } from "@supabase/supabase-js";

/**
 * Resolves the user's avatar strictly following the priority order:
 * 1. Custom selected avatar:
 *    - Locally configured selection (e.g. settings.avatar: custom image, data URL, or emoji)
 *    - Supabase user metadata `custom_avatar`
 * 2. OAuth avatar (e.g. Google avatar_url / picture, identities)
 * 3. Default placeholder (undefined)
 *
 * Flow: custom_avatar || oauth_avatar || default_placeholder
 */
export function extractUserAvatarUrl(
  user: User | null | undefined,
  customAvatar?: string | null,
): string | undefined {
  // 1. Priority 1: Custom Avatar (local selection or user metadata)
  // Check locally selected avatar (settings.avatar - could be emoji, base64 data URL, or storage URL)
  if (typeof customAvatar === "string" && customAvatar.trim().length > 0) {
    return customAvatar.trim();
  }

  // Check custom_avatar stored in Supabase user metadata
  if (user?.user_metadata) {
    const meta = user.user_metadata as Record<string, unknown>;
    const cloudCustomAvatar = meta["custom_avatar"];
    if (typeof cloudCustomAvatar === "string" && cloudCustomAvatar.trim().length > 0) {
      return cloudCustomAvatar.trim();
    }
  }

  // 2. Priority 2: OAuth Avatar (Google OAuth avatar_url or picture)
  const oauthAvatar = extractOAuthAvatarUrl(user);
  if (oauthAvatar) {
    return oauthAvatar;
  }

  // 3. Priority 3: Default Placeholder
  return undefined;
}

/**
 * Extracts the raw OAuth avatar URL (e.g. Google avatar_url or picture)
 * from Supabase session metadata or identities.
 */
export function extractOAuthAvatarUrl(user: User | null | undefined): string | undefined {
  if (user?.user_metadata) {
    const meta = user.user_metadata as Record<string, unknown>;
    const googleAvatar =
      (meta["avatar_url"] as string | undefined) || (meta["picture"] as string | undefined);

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
          (data["avatar_url"] as string | undefined) || (data["picture"] as string | undefined);
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

  return undefined;
}

/**
 * Extracts the user's display name, giving top priority to any custom local settings
 * display name, then Supabase session metadata / Google Auth metadata, and finally email prefix.
 */
export function extractUserDisplayName(
  user: User | null | undefined,
  customDisplayName?: string,
): string {
  // 1. Give precedence to custom display name configured in local settings
  if (
    customDisplayName &&
    typeof customDisplayName === "string" &&
    customDisplayName.trim().length > 0
  ) {
    return customDisplayName.trim();
  }

  // 2. Fall back to Supabase / OAuth user metadata (e.g. Google full_name)
  if (user?.user_metadata) {
    const meta = user.user_metadata as Record<string, unknown>;
    const name = (meta["full_name"] as string | undefined) || (meta["name"] as string | undefined);

    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }
  }

  // 3. Fall back to identities data
  if (user?.identities && Array.isArray(user.identities)) {
    for (const identity of user.identities) {
      const data = identity.identity_data as Record<string, unknown> | undefined;
      if (data) {
        const identityName =
          (data["full_name"] as string | undefined) || (data["name"] as string | undefined);
        if (typeof identityName === "string" && identityName.trim().length > 0) {
          return identityName.trim();
        }
      }
    }
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
