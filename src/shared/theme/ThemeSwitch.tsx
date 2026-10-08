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
    // Detached: HeroUI rounds each button; the pill track and the selected circle are styled with utilities.
    <ToggleButtonGroup
      aria-label="Giao diện"
      size="sm"
      isDetached
      className="theme-switch gap-0.5 rounded-full bg-default p-0.5"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[theme]}
      onSelectionChange={(keys) => {
        const [selected] = keys;
        if (selected) setTheme(selected as Theme);
      }}
    >
      {options.map(({ id, label, Icon }) => (
        <ToggleButton
          key={id}
          id={id}
          isIconOnly
          aria-label={label}
          className="size-7 min-w-0 rounded-full bg-transparent p-0 text-muted hover:bg-default-hover data-[selected=true]:bg-(--theme-switch-selected) data-[selected=true]:text-foreground data-[selected=true]:shadow-sm"
        >
          <Icon className="size-4 shrink-0" />
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
