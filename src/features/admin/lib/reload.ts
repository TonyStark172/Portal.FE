/**
 * Opens the home page afresh: after handing administration over the viewer is an ordinary user, and everything the
 * app knew about what they may do must be read again. Its own module so tests can replace it.
 */
export function reloadPage() {
  // A full load, not a client-side navigation: nothing read as the administrator may survive.
  window.location.assign(new URL("/", window.location.origin));
}
