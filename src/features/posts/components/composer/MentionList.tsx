"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Persons } from "@gravity-ui/icons";
import type { SuggestionProps } from "@tiptap/suggestion";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { EVERYONE } from "../../editor/extensions";

export type MentionCandidate = {
  /** A user id, or EVERYONE for the whole company. */
  id: string;
  label: string;
  avatarUrl: string | null | undefined;
  /** Second line: the colleague's position, or what @everyone does. */
  positionName: string | null | undefined;
};

export type MentionListHandle = { onKeyDown: (event: KeyboardEvent) => boolean };

/** Colleagues matching what follows "@"; ↑ ↓ to move, Enter or Tab to pick. */
export const MentionList = forwardRef<MentionListHandle, SuggestionProps<MentionCandidate>>(function MentionList(
  { items, command },
  ref,
) {
  const [active, setActive] = useState({ items, index: 0 });
  // A new result list starts from its first entry.
  const index = active.items === items ? active.index : 0;

  function pick(position: number) {
    const item = items[position];
    if (item) command({ id: item.id, label: item.label });
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowDown") {
        setActive({ items, index: (index + 1) % items.length });
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive({ items, index: (index - 1 + items.length) % items.length });
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        pick(index);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      role="listbox"
      aria-label="Nhắc đến đồng nghiệp"
      className="w-72 overflow-hidden rounded-xl border border-border bg-overlay p-1 text-foreground shadow-overlay"
    >
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted">Không tìm thấy đồng nghiệp</p>
      ) : (
        items.map((item, position) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={position === index}
            onMouseDown={(event) => event.preventDefault()} // keep the editor focused
            onMouseEnter={() => setActive({ items, index: position })}
            onClick={() => pick(position)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left aria-selected:bg-default"
          >
            {item.id === EVERYONE ? (
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Persons className="size-4" />
              </span>
            ) : (
              <UserAvatar fullName={item.label} avatarUrl={item.avatarUrl} size="sm" className="shrink-0" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.label}</span>
              {item.positionName && <span className="block truncate text-xs text-muted">{item.positionName}</span>}
            </span>
          </button>
        ))
      )}
    </div>
  );
});
