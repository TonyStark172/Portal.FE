import { expect, test } from "vitest";
import { locationLink } from "./eventLocation";

const search = (text: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;

test.each([
  "https://www.google.com/maps/place/Nh%C3%A0+h%C3%A1t+L%E1%BB%9Bn/@21.0242,105.8574,17z/data=!3m1!4b1",
  "https://google.com.vn/maps?q=21.02,105.85",
  "http://maps.google.com/?q=Hanoi",
  "https://maps.google.com.vn/maps?q=Hanoi",
  "https://maps.app.goo.gl/AbC123xyz",
  "https://goo.gl/maps/AbC123",
  "HTTPS://MAPS.APP.GOO.GL/AbC123xyz",
])("a Google Maps link %s opens as it is, named 'Google Maps'", link => {
  expect(locationLink(link)).toEqual({ href: link, label: "Google Maps", isLink: true });
});

test("another web link opens as it is, named by its host", () => {
  expect(locationLink("https://www.bing.com/maps?q=Hanoi")).toEqual({ href: "https://www.bing.com/maps?q=Hanoi", label: "www.bing.com", isLink: true });
  // google.com outside /maps, goo.gl outside /maps: not a map.
  expect(locationLink("https://www.google.com/search?q=Hanoi")?.label).toBe("www.google.com");
  expect(locationLink("https://goo.gl/AbC")?.label).toBe("goo.gl");
});

test("an address in plain text opens a Google Maps search for it, named by itself", () => {
  expect(locationLink("Hội trường tầng 5: toà A")).toEqual({ href: search("Hội trường tầng 5: toà A"), label: "Hội trường tầng 5: toà A", isLink: false });
  expect(locationLink("12 Láng Hạ & 3 Lê Lợi?")!.href).toBe("https://www.google.com/maps/search/?api=1&query=12%20L%C3%A1ng%20H%E1%BA%A1%20%26%203%20L%C3%AA%20L%E1%BB%A3i%3F");
});

test("a location is trimmed first", () => {
  expect(locationLink("  https://maps.app.goo.gl/AbC  ")).toEqual({ href: "https://maps.app.goo.gl/AbC", label: "Google Maps", isLink: true });
  expect(locationLink("  Vũng Tàu \n")).toEqual({ href: search("Vũng Tàu"), label: "Vũng Tàu", isLink: false });
});

test.each(["javascript:alert(1)", "JavaScript:alert(document.cookie)", "data:text/html,<b>x</b>", "ftp://files.example.com/map", "http:/broken", "https://"])(
  "%s is never opened: it is searched for as text",
  text => {
    const link = locationLink(text)!;
    expect(link.isLink).toBe(false);
    expect(link.href).toBe(search(text));
    expect(link.href.startsWith("https://www.google.com/maps/search/")).toBe(true);
  });

test("no location, no link", () => {
  expect(locationLink(null)).toBeNull();
  expect(locationLink(undefined)).toBeNull();
  expect(locationLink("   ")).toBeNull();
});
