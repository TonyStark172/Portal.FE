"use client";

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Display, Moon, Sun } from "@gravity-ui/icons";
import { useTheme } from "./useTheme";
import type { Theme } from "./theme";

const options = [
  { id: "light", label: "Sáng", Icon: Sun },
  { id: "dark", label: "Tối", Icon: Moon },
  { id: "system", label: "Theo hệ thống", Icon: Display },
] as const;

/** Light / dark / system switch. */
export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();

  return (
    <ToggleButtonGroup
      aria-label="Giao diện"
      size="sm"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[theme]}
      onSelectionChange={(keys) => {
        const [selected] = keys;
        if (selected) setTheme(selected as Theme);
      }}
    >
      {options.map(({ id, label, Icon }) => (
        <ToggleButton key={id} id={id} isIconOnly aria-label={label}>
          <Icon className="size-4" />
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
