"use client";

import { useGetUnreadConversationCountQuery } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { useLogin } from "@/shared/session/login";
import { formatUnreadConversations } from "../api";

/**
 * How many conversations have unread messages, beside "Messages" in the menu (a dot on the collapsed rail). Kept
 * current by the hub's "Messages" signal, which reads every conversation query again.
 */
export function MessagesNavBadge() {
  const { t } = useLocale();
  const login = useLogin();
  const { currentData: count = 0 } = useGetUnreadConversationCountQuery(undefined, { skip: login === null });
  const label = formatUnreadConversations(count);
  if (label === null) return null;

  return (
    <span className="ms-auto shrink-0 rounded-full bg-accent px-1.5 text-[0.6875rem] font-semibold leading-4 text-accent-foreground group-data-[state=collapsed]/sidebar:absolute group-data-[state=collapsed]/sidebar:end-0.5 group-data-[state=collapsed]/sidebar:top-0.5 group-data-[state=collapsed]/sidebar:size-2 group-data-[state=collapsed]/sidebar:p-0">
      <span className="group-data-[state=collapsed]/sidebar:sr-only">
        <span className="sr-only">{t("messages.unreadConversations")}: </span>
        {label}
      </span>
    </span>
  );
}
