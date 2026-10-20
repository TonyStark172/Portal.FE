import "@/app/globals.css";
import { DateField, Input, InputGroup, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { afterEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

/*
 * Computed colours come back in whatever space the theme wrote them in (oklch, lab, color-mix results…), so they are
 * not comparable as strings. A 1×1 canvas resolves any CSS colour to sRGB bytes; the two are then compared by their
 * WCAG contrast ratio, so "different" means visibly different, not a rounding difference.
 */
function toRgb(color: string): [number, number, number] {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function luminance([r, g, b]: [number, number, number]) {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Element, b: Element) {
  const [la, lb] = [a, b].map((element) => luminance(toRgb(getComputedStyle(element).backgroundColor)));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A field box visible on its surface: the same step HeroUI's own "secondary" field variant puts between them. */
const MIN_CONTRAST = 1.1;

function Fields() {
  return (
    <>
      <TextField>
        <Label>Tên</Label>
        <Input data-testid="input" />
      </TextField>
      <TextField>
        <Label>Tìm</Label>
        <InputGroup data-testid="group">
          <InputGroup.Input />
        </InputGroup>
      </TextField>
    </>
  );
}

/** The same fields with HeroUI's "secondary" variant, which sets its colours on the field itself. */
function SecondaryFields() {
  return (
    <>
      <TextField variant="secondary">
        <Label>Tên</Label>
        <Input data-testid="secondary-input" />
      </TextField>
      <TextField>
        <Label>Tìm</Label>
        <InputGroup variant="secondary" data-testid="secondary-group">
          <InputGroup.Input />
        </InputGroup>
      </TextField>
      <DateField aria-label="Kết thúc lặp">
        <DateField.Group variant="secondary" data-testid="secondary-date">
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
      </DateField>
      <Select variant="secondary" aria-label="Lặp lại">
        <Select.Trigger data-testid="secondary-select">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="weekly" textValue="Hằng tuần">Hằng tuần</ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
    </>
  );
}

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.documentElement.classList.remove("dark");
});

describe.each(["light", "dark"] as const)("form fields in the %s theme", (theme) => {
  function setTheme() {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }

  test("stand out from the card they sit on", async () => {
    setTheme();
    const screen = await render(
      <div data-testid="card" className="rounded-2xl border border-separator bg-surface p-5">
        <Fields />
      </div>,
    );

    const card = screen.getByTestId("card").element();
    expect(contrast(screen.getByTestId("input").element(), card)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrast(screen.getByTestId("group").element(), card)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  test("stand out from a secondary panel inside a card", async () => {
    setTheme();
    const screen = await render(
      <div className="bg-surface p-5">
        <section data-testid="panel" className="rounded-xl border border-separator bg-surface-secondary p-4">
          <Fields />
        </section>
      </div>,
    );

    const panel = screen.getByTestId("panel").element();
    expect(contrast(screen.getByTestId("input").element(), panel)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  test("in their secondary variant, stand out from a secondary panel inside a dialog", async () => {
    setTheme();
    const screen = await render(
      <Modal.Backdrop isOpen>
        <Modal.Container>
          <Modal.Dialog aria-label="Đặt lịch">
            <Modal.Body>
              <section data-testid="panel" className="rounded-xl border border-separator bg-surface-secondary p-4">
                <SecondaryFields />
              </section>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>,
    );

    await expect.element(screen.getByTestId("secondary-input")).toBeVisible();
    const panel = screen.getByTestId("panel").element();
    for (const id of ["secondary-input", "secondary-group", "secondary-date", "secondary-select"])
      expect.soft(contrast(screen.getByTestId(id).element(), panel), id).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  test("stand out from the dialog they sit in", async () => {
    setTheme();
    const screen = await render(
      <Modal.Backdrop isOpen>
        <Modal.Container>
          <Modal.Dialog aria-label="Đặt lịch" data-testid="dialog">
            <Modal.Body>
              <Fields />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>,
    );

    await expect.element(screen.getByTestId("input")).toBeVisible();
    const dialog = screen.getByTestId("dialog").element();
    expect(contrast(screen.getByTestId("input").element(), dialog)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrast(screen.getByTestId("group").element(), dialog)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});
