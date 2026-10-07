import type { ReactNode } from "react";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/user";
import { cn } from "@/lib/utils";

export interface UserAvatarProps {
  avatar?: string | null | undefined;
  name?: string | null | undefined;
  className?: string | undefined;
  fallbackClassName?: string | undefined;
  iconClassName?: string | undefined;
  fallbackIcon?: ReactNode | undefined;
}

/**
 * Reusable user avatar component that renders:
 * 1. An image URL (Google OAuth avatar or custom image upload)
 * 2. An emoji avatar fallback
 * 3. Initials or default User icon placeholder if no image exists or if loading fails
 */
export function UserAvatar({
  avatar,
  name,
  className = "h-8 w-8",
  fallbackClassName,
  iconClassName = "h-4 w-4",
  fallbackIcon,
}: UserAvatarProps) {
  const initials = getInitials(name);

  if (avatar) {
    if (
      avatar.startsWith("data:") ||
      avatar.startsWith("http://") ||
      avatar.startsWith("https://")
    ) {
      return (
        <Avatar className={className}>
          <AvatarImage
            src={avatar}
            alt={name?.trim() || "User"}
            className="object-cover"
          />
          <AvatarFallback
            className={cn(
              "bg-primary/10 text-primary font-medium text-xs",
              fallbackClassName,
            )}
          >
            {initials || fallbackIcon || <User className={iconClassName} />}
          </AvatarFallback>
        </Avatar>
      );
    }

    // Emoji avatar fallback
    return (
      <Avatar className={className}>
        <AvatarFallback
          className={cn(
            "bg-primary/10 text-lg flex items-center justify-center",
            fallbackClassName,
          )}
        >
          {avatar}
        </AvatarFallback>
      </Avatar>
    );
  }

  // Default placeholder fallback when no avatar is provided
  return (
    <Avatar className={className}>
      <AvatarFallback
        className={cn(
          "bg-primary/10 text-primary font-medium text-xs",
          fallbackClassName,
        )}
      >
        {initials || fallbackIcon || <User className={iconClassName} />}
      </AvatarFallback>
    </Avatar>
  );
}

