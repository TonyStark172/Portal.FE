"use client";

import { useRef } from "react";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Display, Moon, Sun } from "@gravity-ui/icons";
import { useTheme } from "./useTheme";
import type { Theme } from "./theme";
import { revealTheme } from "./themeReveal";
import { useLocale } from "@/shared/i18n";

/** Light / dark / system switch. A change of colours is revealed from the chosen button (themeReveal.ts). */
export function ThemeSwitch() {
  const [theme] = useTheme();
  const group = useRef<HTMLDivElement>(null);
  const { t } = useLocale();
  const options = [
    { id: "light", label: t("common.themeLight"), Icon: Sun },
    { id: "dark", label: t("common.themeDark"), Icon: Moon },
    { id: "system", label: t("common.themeSystem"), Icon: Display },
  ] as const;

  return (
    // Detached: HeroUI rounds each button; the pill track and the selected circle are styled with utilities.
    <ToggleButtonGroup
      ref={group}
      aria-label={t("common.theme")}
      size="sm"
      isDetached
      className="theme-switch gap-0.5 rounded-full bg-default p-0.5"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[theme]}
      onSelectionChange={(keys) => {
        const [selected] = keys;
        if (!selected) return;
        // Chosen by pointer or keyboard, the reveal starts from the chosen button.
        const button = group.current?.querySelector(`[data-theme-option="${String(selected)}"]`)?.getBoundingClientRect();
        revealTheme(
          selected as Theme,
          button
            ? { x: button.left + button.width / 2, y: button.top + button.height / 2, radius: button.width / 2 }
            : { x: window.innerWidth / 2, y: window.innerHeight / 2, radius: 0 },
        );
      }}
    >
      {options.map(({ id, label, Icon }) => (
        <ToggleButton
          key={id}
          id={id}
          data-theme-option={id}
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
