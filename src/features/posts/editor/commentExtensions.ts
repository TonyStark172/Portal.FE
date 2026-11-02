import { Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { SuggestionOptions } from "@tiptap/suggestion";
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
    PostMention.extend({ priority: 1100 }).configure({ suggestion: mentionSuggestion }),
    SubmitOnEnter.configure({ onSubmit }),
  ];
}
