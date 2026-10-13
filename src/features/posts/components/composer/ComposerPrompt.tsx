"use client";

import { useLocale } from "@/shared/i18n";

/** The box's line: opens the composer, or offers to go on with the draft kept. */
export function ComposerPrompt({ hasDraft, onOpen }: { hasDraft: boolean; onOpen: () => void }) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex-1 rounded-full bg-default px-4 py-2.5 text-left text-sm text-muted outline-none hover:bg-default-hover focus-visible:ring-2 focus-visible:ring-focus"
    >
      {t(hasDraft ? "posts.continueDraft" : "posts.compose")}
    </button>
  );
}
