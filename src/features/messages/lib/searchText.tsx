import type { ReactNode } from "react";

/** The same limits as Portal.BE's search: a few words at once, and at least two characters to look for. */
export const MAX_SEARCH_TERMS = 8;
export const MIN_SEARCH_LENGTH = 2;

/**
 * A text as the search compares it (Portal.BE's portal_search_normalize): lower case, without accents, "đ" as "d". With
 * it, for every character of the result, the index in `text` of the character it came from, so a match found in the
 * folded text can be marked in the text as written.
 */
export function foldText(text: string): { folded: string; origin: number[] } {
  let folded = "";
  const origin: number[] = [];
  for (let index = 0; index < text.length; index++) {
    const plain = text[index].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d");
    for (const character of plain) {
      folded += character;
      origin.push(index);
    }
  }
  return { folded, origin };
}

/** The words a search looks for, folded: split at spaces, each once, the first few only (as the server does). */
export function searchTerms(text: string): string[] {
  const terms: string[] = [];
  for (const word of text.split(/\s+/)) {
    const term = foldText(word).folded;
    if (term && !terms.includes(term)) terms.push(term);
    if (terms.length === MAX_SEARCH_TERMS) break;
  }
  return terms;
}

/** Where the words are in a text as written: [start, end) ranges in order, joined where they touch or overlap. */
export function matchRanges(text: string, terms: string[]): [number, number][] {
  const { folded, origin } = foldText(text);
  const found: [number, number][] = [];
  for (const term of terms) {
    if (!term) continue;
    for (let at = folded.indexOf(term); at >= 0; at = folded.indexOf(term, at + term.length)) {
      let end = origin[at + term.length - 1] + 1;
      // An accent written as its own character belongs to the letter before it.
      while (end < text.length && /\p{M}/u.test(text[end])) end++;
      found.push([origin[at], end]);
    }
  }
  found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const ranges: [number, number][] = [];
  for (const range of found) {
    const last = ranges[ranges.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else ranges.push([range[0], range[1]]);
  }
  return ranges;
}

/**
 * The part of a long text around the first word found, so a result shows why it matched: it starts a few words before
 * the match and is cut to `length`, with "…" where text was left out. A short text is returned whole.
 */
export function excerptAround(text: string, terms: string[], length = 160): string {
  if (text.length <= length) return text;
  const first = matchRanges(text, terms)[0]?.[0] ?? 0;
  let start = Math.max(0, first - 40);
  if (start > 0) {
    // From the start of a word, not from the middle of one.
    const space = text.indexOf(" ", start);
    if (space >= 0 && space < first) start = space + 1;
  }
  const end = Math.min(text.length, start + length);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/** The text with the words found marked, whatever their accents and case as written. */
export function highlightTerms(text: string, terms: string[]): ReactNode[] {
  const ranges = matchRanges(text, terms);
  if (ranges.length === 0) return [text];
  const parts: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className="rounded-sm bg-warning/30 px-px text-inherit">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}
