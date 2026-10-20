/** Where an event's place opens, and what it is called on the calendar. */
export type LocationLink = {
  /** A web link pasted as the place, or a Google Maps search for the address. Always http(s). */
  href: string;
  /** What the calendar shows: "Google Maps" or the host for a link (never the long link), the address itself otherwise. */
  label: string;
  /** Whether the place is a link rather than an address. */
  isLink: boolean;
};

/** An absolute http(s) link with a host, as Portal.BE accepts it (anything else is text, never opened). */
const webLink = /^https?:\/\/[^/?#\s]/i;

/** Google Maps: google.<tld>/maps, maps.google.<tld>, maps.app.goo.gl and goo.gl/maps. */
function isGoogleMaps(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.toLowerCase();
  const underMaps = path === "/maps" || path.startsWith("/maps/");
  return /^maps\.google\.[a-z.]+$/.test(host) || host === "maps.app.goo.gl"
    || (/^google\.[a-z.]+$/.test(host) && underMaps) || (host === "goo.gl" && underMaps);
}

/**
 * An event's location as a link: one pasted from Google Maps (or another site) opens as it is, an address opens a
 * Google Maps search for it. Something that only looks like a link (`javascript:`, `ftp://`, `http:/x`) is an address.
 */
export function locationLink(location: string | null | undefined): LocationLink | null {
  const text = location?.trim();
  if (!text) return null;
  if (webLink.test(text)) {
    try {
      const url = new URL(text);
      if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname)
        return { href: text, label: isGoogleMaps(url) ? "Google Maps" : url.hostname, isLink: true };
    } catch { /* not a link after all: an address */ }
  }
  return { href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`, label: text, isLink: false };
}

/** What a calendar card or a list row shows of the place: its label, never the raw link. */
export const locationLabel = (location: string | null | undefined) => locationLink(location)?.label ?? null;
