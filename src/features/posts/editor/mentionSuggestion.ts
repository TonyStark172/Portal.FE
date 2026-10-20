import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { MentionList, type MentionCandidate, type MentionListHandle } from "../components/composer/MentionList";

const GAP = 6;
const MARGIN = 8;
const WIDTH = 288;

/** Under the "@…" text, or above it when there is no room below; always inside the viewport. */
function place(element: HTMLElement, props: SuggestionProps<MentionCandidate>) {
  const rect = props.clientRect?.();
  if (!rect) return;

  const height = element.offsetHeight || 240;
  const below = rect.bottom + GAP;
  const top = below + height <= window.innerHeight - MARGIN ? below : Math.max(MARGIN, rect.top - GAP - height);

  Object.assign(element.style, {
    position: "fixed",
    zIndex: "2147483000",
    top: `${top}px`,
    left: `${Math.max(MARGIN, Math.min(rect.left, window.innerWidth - WIDTH - MARGIN))}px`,
  });
}

/** The @ suggestion of the composer: `search` returns colleagues whose name matches what was typed. */
export function createMentionSuggestion(
  search: (query: string) => Promise<MentionCandidate[]>,
): Omit<SuggestionOptions<MentionCandidate>, "editor"> {
  return {
    items: ({ query }) => search(query),

    render: () => {
      let renderer: ReactRenderer<MentionListHandle, SuggestionProps<MentionCandidate>> | null = null;
      let latest: SuggestionProps<MentionCandidate> | null = null;
      let detach: (() => void) | null = null;

      const hide = () => {
        detach?.();
        detach = null;
        renderer?.element.remove();
        renderer?.destroy();
        renderer = null;
      };

      const show = (props: SuggestionProps<MentionCandidate>) => {
        latest = props;

        if (renderer) {
          renderer.updateProps(props);
        } else {
          renderer = new ReactRenderer(MentionList, { props, editor: props.editor });
          // The list lives in <body>. Inside a modal, React Aria makes everything outside the dialog inert;
          // marking it as a top layer (before it is attached) keeps it clickable, like toasts.
          renderer.element.dataset.reactAriaTopLayer = "true";
          document.body.appendChild(renderer.element);

          const reposition = () => renderer && latest && place(renderer.element, latest);
          // Leaving the editor (clicking another field) closes the list instead of leaving it on top of the page;
          // typing after "@" again brings it back. Picking with the mouse keeps the editor focused.
          const onBlur = () => hide();
          window.addEventListener("scroll", reposition, true);
          window.addEventListener("resize", reposition);
          props.editor.on("blur", onBlur);
          detach = () => {
            window.removeEventListener("scroll", reposition, true);
            window.removeEventListener("resize", reposition);
            props.editor.off("blur", onBlur);
          };
        }

        place(renderer.element, props);
        // Measured again once the list has its final height (it can flip above the text).
        requestAnimationFrame(() => renderer && latest && place(renderer.element, latest));
      };

      return {
        onStart: show,
        onUpdate: show,
        onKeyDown: ({ event }) => {
          if (!renderer) return false;
          if (event.key === "Escape") {
            // Closes only the list, not a dialog around the composer.
            event.stopPropagation();
            hide();
            return true;
          }
          return renderer.ref?.onKeyDown(event) ?? false;
        },
        onExit: hide,
      };
    },
  };
}
