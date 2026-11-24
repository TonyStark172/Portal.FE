"use client";

import type { ConversationDto } from "@/shared/api/generated/portalApi";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { isActiveNow } from "../lib/messageText";

/** A green dot on an avatar's corner: the person has a page open. */
export function PresenceDot({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`absolute end-0 bottom-0 size-3 rounded-full border-2 border-background bg-success ${className}`} />;
}

/**
 * The picture of a conversation: the other person's avatar (with a green dot while they are active), or for a group
 * two of its members, one over the other.
 */
export function ConversationAvatar({ conversation, size = "md" }: {
  conversation: Pick<ConversationDto, "isGroup" | "members" | "name">;
  size?: "sm" | "md" | "lg";
}) {
  const box = size === "lg" ? "size-14" : size === "md" ? "size-10" : "size-8";

  if (!conversation.isGroup) {
    const partner = conversation.members[0];
    return (
      <span className={`relative inline-flex shrink-0 ${box}`}>
        <UserAvatar
          fullName={partner?.fullName}
          avatarUrl={partner?.avatarUrl}
          size={size}
          className={`${box} ${partner?.isActive === false ? "opacity-60" : ""}`}
        />
        {partner && partner.isActive && isActiveNow(partner.lastActiveAt) && <PresenceDot />}
      </span>
    );
  }

  const [first, second] = conversation.members;
  const anyoneActive = conversation.members.some((member) => member.isActive && isActiveNow(member.lastActiveAt));
  return (
    <span className={`relative inline-block shrink-0 ${box}`}>
      <UserAvatar fullName={second?.fullName ?? conversation.name ?? undefined} avatarUrl={second?.avatarUrl} size="sm" className="absolute end-0 top-0 size-[70%] ring-2 ring-background" />
      <UserAvatar fullName={first?.fullName ?? conversation.name ?? undefined} avatarUrl={first?.avatarUrl} size="sm" className="absolute start-0 bottom-0 size-[70%] ring-2 ring-background" />
      {anyoneActive && <PresenceDot />}
    </span>
  );
}
