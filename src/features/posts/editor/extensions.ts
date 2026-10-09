import { Extension, Mark } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import { TableCell, TableHeader, TableRow } from "@tiptap/extension-table";

/** Mention id of "@Mọi người" (the whole company); every other mention id is a user id. */
export const EVERYONE = "everyone";
export const EVERYONE_LABEL = "Mọi người";

/**
 * A mark stored as one data attribute (e.g. <span data-color="red">), which Portal.BE accepts and the
 * theme turns into a readable colour; inline styles would be stripped.
 */
function dataMark(name: "textColor" | "textSize" | "fontFamily" | "highlight", tag: "span" | "mark", attribute: string) {
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

/** Font by palette name: <span data-font="arial">. */
export const FontFamily = dataMark("fontFamily", "span", "data-font");

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

export type Alignment = "left" | "center" | "right" | "justify";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textAlign: {
      /** Aligns the selected paragraphs; "left" is the default and removes the alignment. */
      setTextAlign: (alignment: Alignment) => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
  }
}

/**
 * Paragraph alignment stored as <p data-align="center"> (Portal.BE strips inline styles), with Word's shortcuts:
 * Ctrl+Shift+L / E / R / J.
 */
export const TextAlign = Extension.create({
  name: "textAlign",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          align: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-align"),
            renderHTML: (attributes) => (attributes.align ? { "data-align": attributes.align } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
        ({ commands }) =>
          commands.updateAttributes("paragraph", { align: alignment === "left" ? null : alignment }),
      unsetTextAlign:
        () =>
        ({ commands }) =>
          commands.resetAttributes("paragraph", "align"),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-l": () => this.editor.commands.setTextAlign("left"),
      "Mod-Shift-e": () => this.editor.commands.setTextAlign("center"),
      "Mod-Shift-r": () => this.editor.commands.setTextAlign("right"),
      "Mod-Shift-j": () => this.editor.commands.setTextAlign("justify"),
    };
  },
});

/** A cell attribute stored as one data attribute, e.g. background → data-bg="yellow". */
const cellAttribute = (name: string, attribute: string) => ({
  [name]: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute(attribute),
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes[name] ? { [attribute]: attributes[name] as string } : {},
  },
});

const cellAttributes = {
  ...cellAttribute("background", "data-bg"),
  ...cellAttribute("align", "data-align"),
  ...cellAttribute("valign", "data-valign"),
};

/** Table cells with a background colour (highlight palette) and horizontal / vertical alignment. */
export const PostTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
});

export const PostTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
});

/** The tallest a row can be dragged (about the composer's text area on a laptop); Portal.BE drops taller heights. */
export const MAX_ROW_HEIGHT = 400;

/** The widest a column can be dragged (about a post on a computer); Portal.BE drops wider widths. */
export const MAX_COLUMN_WIDTH = 600;

/** The most rows and columns a table may have; Portal.BE refuses a post with a bigger table. */
export const MAX_TABLE_ROWS = 50;
export const MAX_TABLE_COLUMNS = 10;

/**
 * Rows with a height the user dragged them to (null: as tall as their content), stored as <tr style="height: 80px">,
 * the one style Portal.BE keeps on a row. A row never gets shorter than its content: the height is a minimum.
 */
export const PostTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const height = Number.parseFloat(element.style.height);
          return element.style.height.endsWith("px") && height > 0 ? Math.min(Math.round(height), MAX_ROW_HEIGHT) : null;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.height ? { style: `height: ${attributes.height as number}px` } : {},
      },
    };
  },
});
