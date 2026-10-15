import { Provider } from "react-redux";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { LoginForm } from "./LoginForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

test("the form posts to its own page, so a submit before the page is hydrated never puts the credentials in the URL", async () => {
  const screen = await render(<Provider store={makeStore()}><LoginForm /></Provider>);
  const form = screen.container.querySelector("form")!;
  expect(form.getAttribute("method")?.toLowerCase()).toBe("post");
  expect(form.hasAttribute("action")).toBe(false);
});
