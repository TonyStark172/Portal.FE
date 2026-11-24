"use client";

import { useState, type ReactNode } from "react";
import { Popover, Spinner } from "@heroui/react";
import { EmojiPicker } from "frimousse";
import { useLocale } from "@/shared/i18n";

/** A searchable emoji picker, names in the reader's language: inside a popover, alone or after the quick reactions. */
export function EmojiPickerPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const { locale, t } = useLocale();
  return (
    <EmojiPicker.Root
      locale={locale === "en-US" ? "en" : "vi"}
      columns={8}
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      className="flex h-80 max-h-[inherit] w-[19rem] flex-col"
    >
      <EmojiPicker.Search
        placeholder={t("posts.emoji.searchPlaceholder")}
        aria-label={t("posts.emoji.search")}
        autoFocus
        className="m-2 rounded-lg bg-default px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-focus"
      />
      <EmojiPicker.Viewport className="relative min-h-0 flex-1 outline-none">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" />
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          {t("posts.emoji.none")}
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-1.5"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div {...props} className="bg-overlay px-3 pt-2 pb-1 text-xs font-medium text-muted">
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div {...props} className="scroll-my-1.5 px-1.5">
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button {...props} className="flex size-9 items-center justify-center rounded-md text-xl data-[active]:bg-default">
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}

/** The emoji picker in a popover opened by `trigger`: the composer's 🙂. */
export function EmojiPopover({ trigger, onPick, placement = "top start" }: {
  trigger: ReactNode;
  onPick: (emoji: string) => void;
  placement?: "top start" | "top end" | "bottom start" | "bottom end" | "top";
}) {
  const { t } = useLocale();
  const [isOpen, setOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setOpen}>
      {trigger}
      <Popover.Content placement={placement}>
        <Popover.Dialog aria-label={t("posts.emoji.choose")} className="max-h-[inherit] p-0">
          <EmojiPickerPanel
            onPick={(emoji) => {
              onPick(emoji);
              setOpen(false);
            }}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
