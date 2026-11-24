"use client";

import { useState, type ReactNode } from "react";
import { Popover } from "@heroui/react";
import { Plus } from "@gravity-ui/icons";
import { useLocale } from "@/shared/i18n";
import { QUICK_REACTIONS } from "../lib/messageText";
import { EmojiPickerPanel } from "./EmojiPopover";

/**
 * What the 🙂 beside a message opens, as on Messenger: the six quick reactions and a "+" that turns it into the full
 * emoji picker. The reader's own reaction is marked (and added to the row when it is not one of the six); picking it
 * again removes it.
 */
export function ReactionPopover({ trigger, myReaction, onPick, onOpenChange, placement }: {
  trigger: ReactNode;
  myReaction: string | null;
  /** The emoji picked, or null when the reader picked their own again. */
  onPick: (emoji: string | null) => void;
  onOpenChange?: (open: boolean) => void;
  placement: "top start" | "top end";
}) {
  const { t } = useLocale();
  const [isOpen, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const row = myReaction && !QUICK_REACTIONS.includes(myReaction) ? [...QUICK_REACTIONS, myReaction] : QUICK_REACTIONS;

  // Back to the quick row when it opens again (not as it closes, which would swap the content mid-animation).
  const open = (next: boolean) => {
    setOpen(next);
    if (next) setFull(false);
    onOpenChange?.(next);
  };
  const pick = (emoji: string) => {
    onPick(emoji === myReaction ? null : emoji);
    open(false);
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={open}>
      {trigger}
      <Popover.Content placement={placement}>
        {full ? (
          <Popover.Dialog aria-label={t("messages.moreReactions")} className="max-h-[inherit] p-0">
            <EmojiPickerPanel onPick={pick} />
          </Popover.Dialog>
        ) : (
          <Popover.Dialog aria-label={t("messages.action.react")} className="flex items-center gap-0.5 rounded-full p-1">
            {row.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={t("messages.reactWith").replace("{emoji}", emoji)}
                aria-pressed={myReaction === emoji}
                onClick={() => pick(emoji)}
                className="flex size-9 items-center justify-center rounded-full text-2xl outline-none transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-focus aria-pressed:bg-accent-soft motion-reduce:transition-none"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              aria-label={t("messages.moreReactions")}
              onClick={() => setFull(true)}
              className="ms-0.5 flex size-8 items-center justify-center rounded-full bg-default text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Plus className="size-4" />
            </button>
          </Popover.Dialog>
        )}
      </Popover.Content>
    </Popover>
  );
}
