import { Mark } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";

/** Mention id of "@Mọi người" (the whole company); every other mention id is a user id. */
export const EVERYONE = "everyone";
export const EVERYONE_LABEL = "Mọi người";

/**
 * A mark stored as one data attribute (e.g. <span data-color="red">), which Portal.BE accepts and the
 * theme turns into a readable colour; inline styles would be stripped.
 */
function dataMark(name: "textColor" | "textSize" | "highlight", tag: "span" | "mark", attribute: string) {
  return Mark.create({
    name,

    addAttributes() {
      return {
        value: {
          default: null,
          parseHTML: (element) => element.getAttribute(attribute),
          renderHTML: (attributes) => (attributes.value ? { [attribute]: attributes.value } : {}),
        },
      };
    },

    // Not consuming, so a span carrying both data-color and data-size gives both marks.
    parseHTML: () => [{ tag: `${tag}[${attribute}]`, consuming: false }],

    renderHTML: ({ HTMLAttributes }) => [tag, HTMLAttributes, 0],
  });
}

/** Text colour by palette name: <span data-color="red">. */
export const TextColor = dataMark("textColor", "span", "data-color");

/** Text size: <span data-size="large">. */
export const TextSize = dataMark("textSize", "span", "data-size");

/** Highlight colour: <mark data-color="yellow">. */
export const Highlight = dataMark("highlight", "mark", "data-color");

/**
 * @mention stored as <span data-mention-id="12">@Nguyễn Văn An</span>,
 * or <span data-mention-everyone>@Mọi người</span> for the whole company.
 */
export const PostMention = Mention.extend({
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) =>
          element.hasAttribute("data-mention-everyone") ? EVERYONE : element.getAttribute("data-mention-id"),
        rendered: false,
      },
      label: {
        default: null,
        parseHTML: (element) => element.textContent?.replace(/^@/, "") ?? null,
        rendered: false,
      },
    };
  },

  parseHTML: () => [{ tag: "span[data-mention-id]" }, { tag: "span[data-mention-everyone]" }],

  renderHTML: ({ node }) =>
    node.attrs.id === EVERYONE
      ? ["span", { "data-mention-everyone": "" }, `@${EVERYONE_LABEL}`]
      : ["span", { "data-mention-id": node.attrs.id }, `@${node.attrs.label}`],
});
