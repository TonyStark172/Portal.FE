import { Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import { exitSuggestion, type SuggestionOptions } from "@tiptap/suggestion";
import type { MentionCandidate } from "../components/composer/MentionList";
import { PostMention } from "./extensions";

/** Same limit as Portal.BE (PostCommentRules.MaxTextLength). */
export const MAX_COMMENT_LENGTH = 2000;

/**
 * The visible text of a comment as Portal.BE counts it: text and the names of mentions ("@Lê Văn Cường"), with
 * line breaks and paragraphs counting for nothing.
 */
export function commentTextOf(doc: ProseMirrorNode) {
  return doc.textBetween(0, doc.content.size, "", (node) => (node.type.name === "mention" ? `@${node.attrs.label}` : ""));
}

/** The state of the "@" suggestion: `active` from the moment "@…" is typed, whether or not its list is shown yet. */
const mentionKey = new PluginKey<{ active: boolean }>("commentMention");

/** Enter sends, unless a finger is typing (a touch device sends by its button) or an input method is composing. */
const SubmitOnEnter = Extension.create<{ onSubmit: () => void }>({
  name: "submitOnEnter",
  // Before the editor's own Enter, which would split the paragraph.
  priority: 1000,

  addOptions: () => ({ onSubmit: () => {} }),

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (window.matchMedia("(pointer: coarse)").matches || editor.view.composing) return false;
        // With "@…" half typed the mention list answers Enter: to pick, and when it has nothing to pick (or has not
        // arrived yet) Enter still must not send the raw "@…".
        if (mentionKey.getState(editor.state)?.active) return true;
        this.options.onSubmit();
        return true;
      },
    };
  },
});

type CommentExtensionsOptions = {
  /** Read each time the editor is empty, so it can change without the editor being made again. */
  placeholder: () => string;
  mentionSuggestion: Omit<SuggestionOptions<MentionCandidate>, "editor">;
  onSubmit: () => void;
};

/** A comment is plain text: paragraphs, line breaks and @mentions, with Enter to send and Shift+Enter for a new line. */
export function commentExtensions({ placeholder, mentionSuggestion, onSubmit }: CommentExtensionsOptions) {
  // The list was closed by leaving the box, not by Esc: more typing in that "@…" brings it back.
  let leftByBlur = false;

  return [
    // Only the document, its text, paragraphs and line breaks, and undo.
    StarterKit.configure({
      blockquote: false,
      bold: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      dropcursor: false,
      gapcursor: false,
      heading: false,
      horizontalRule: false,
      italic: false,
      link: false,
      listItem: false,
      listKeymap: false,
      orderedList: false,
      strike: false,
      trailingNode: false,
      underline: false,
    }),
    Placeholder.configure({ placeholder }),
    // Above the Enter that sends: with the list open, Enter picks a colleague.
    PostMention.extend({
      priority: 1100,

      // Leaving the box hides the mention list: "@…" stops waiting for a pick, or Enter would do nothing on the way back.
      onBlur() {
        if (!mentionKey.getState(this.editor.state)?.active) return;
        leftByBlur = true;
        exitSuggestion(this.editor.view, mentionKey);
      },

      onTransaction() {
        if (mentionKey.getState(this.editor.state)?.active) leftByBlur = false;
      },
    }).configure({
      suggestion: {
        ...mentionSuggestion,
        pluginKey: mentionKey,
        shouldResetDismissed: ({ transaction }) => leftByBlur && transaction.docChanged,
      },
    }),
    SubmitOnEnter.configure({ onSubmit }),
  ];
}
