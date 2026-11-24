"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Comments } from "@gravity-ui/icons";
import { useCurrentUser } from "@/features/auth";
import { useLocale } from "@/shared/i18n";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { NewConversationDialog } from "./NewConversationDialog";

/** The open conversation is in the URL (?c=12), so a link or a reload brings it back. */
function readSelected(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Private messages: the conversations on the left, the open one on the right (with its details beside it when asked
 * for). A phone shows one at a time, the list first, and the back button of the conversation returns to it.
 */
export function MessagesPage() {
  const { t } = useLocale();
  const { user } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = readSelected(searchParams.get("c"));
  const [starting, setStarting] = useState<"direct" | "group" | null>(null);

  const select = (id: number | null) => router.replace(id === null ? "/messages" : `/messages?c=${id}`, { scroll: false });

  return (
    <section className="messages-page flex overflow-hidden rounded-2xl border border-separator bg-background">
      <h1 className="sr-only">{t("messages.title")}</h1>
      <aside className={`w-full shrink-0 border-separator md:w-80 md:border-e ${selectedId === null ? "" : "max-md:hidden"}`}>
        <ConversationList selectedId={selectedId} onSelect={select} onNew={setStarting} myId={user?.id} />
      </aside>

      <div className={`min-w-0 flex-1 ${selectedId === null ? "max-md:hidden" : ""}`}>
        {selectedId === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted">
            <Comments className="size-10 opacity-60" />
            {t("messages.selectConversation")}
          </div>
        ) : (
          <ConversationThread key={selectedId} conversationId={selectedId} myId={user?.id} onBack={() => select(null)} onLeft={() => select(null)} />
        )}
      </div>

      <NewConversationDialog
        isOpen={starting !== null}
        initialMode={starting ?? "direct"}
        myId={user?.id}
        onClose={() => setStarting(null)}
        onOpened={(id) => {
          setStarting(null);
          select(id);
        }}
      />
    </section>
  );
}
