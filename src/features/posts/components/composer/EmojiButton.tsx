"use client";

import { useState } from "react";
import { FaceSmile } from "@gravity-ui/icons";
import { Button, Popover, Spinner, Tooltip } from "@heroui/react";
import { EmojiPicker } from "frimousse";

/** The 🙂 button of the composer: a searchable emoji picker (Vietnamese names) that inserts the chosen emoji. */
export function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [isOpen, setOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setOpen}>
      <Tooltip delay={400}>
        <Button isIconOnly size="sm" variant="ghost" aria-label="Chèn biểu tượng cảm xúc">
          <FaceSmile className="size-4" />
        </Button>
        <Tooltip.Content>Chèn biểu tượng cảm xúc</Tooltip.Content>
      </Tooltip>
      <Popover.Content placement="top start">
        <Popover.Dialog aria-label="Chọn biểu tượng cảm xúc" className="max-h-[inherit] p-0">
          <EmojiPicker.Root
            locale="vi"
            columns={8}
            onEmojiSelect={({ emoji }) => {
              onPick(emoji);
              setOpen(false);
            }}
            className="flex h-80 max-h-[inherit] w-[19rem] flex-col"
          >
            <EmojiPicker.Search
              placeholder="Tìm biểu tượng…"
              aria-label="Tìm biểu tượng cảm xúc"
              autoFocus
              className="m-2 rounded-lg bg-default px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-focus"
            />
            <EmojiPicker.Viewport className="relative min-h-0 flex-1 outline-none">
              <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center">
                <Spinner size="sm" />
              </EmojiPicker.Loading>
              <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                Không tìm thấy biểu tượng
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
                    <button
                      {...props}
                      className="flex size-9 items-center justify-center rounded-md text-xl data-[active]:bg-default"
                    >
                      {emoji.emoji}
                    </button>
                  ),
                }}
              />
            </EmojiPicker.Viewport>
          </EmojiPicker.Root>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
