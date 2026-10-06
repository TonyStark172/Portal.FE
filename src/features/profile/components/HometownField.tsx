"use client";

import { House } from "@gravity-ui/icons";
import { ComboBox, FieldError, Input, Label, ListBox } from "@heroui/react";
import { provinces } from "@/shared/data/provinces";
import { matchesVietnamese } from "@/shared/lib/vietnameseSearch";

/** Submitted when the user picks "Không nêu"; the form turns it into no hometown. */
export const NO_HOMETOWN = "none";

/**
 * Hometown picked from the list of provinces, searchable without diacritics.
 * A value saved before the list existed (free text) stays selectable so it is not lost on save.
 */
export function HometownField({ name, defaultValue }: { name: string; defaultValue: string | null | undefined }) {
  const options = defaultValue && !provinces.includes(defaultValue) ? [defaultValue, ...provinces] : provinces;

  return (
    <ComboBox
      name={name}
      variant="secondary"
      fullWidth
      defaultSelectedKey={defaultValue ?? undefined}
      defaultFilter={matchesVietnamese}
    >
      <Label>Quê quán</Label>
      <ComboBox.InputGroup>
        <House aria-hidden className="pointer-events-none absolute start-3 z-10 size-4 text-muted" />
        {/* ComboBox CSS gives the focused input the surface colour, which hides it on a dark drawer; keep the
            secondary background like the other fields. */}
        <Input placeholder="Chọn hoặc gõ tên tỉnh, vd: ha noi" className="ps-9 focus:bg-default" />
        <ComboBox.Trigger aria-label="Hiện danh sách tỉnh" />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          <ListBox.Item id={NO_HOMETOWN} textValue="Không nêu">
            <span className="text-muted">Không nêu</span>
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {options.map((province) => (
            <ListBox.Item key={province} id={province} textValue={province}>
              {province}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
      <FieldError />
    </ComboBox>
  );
}
