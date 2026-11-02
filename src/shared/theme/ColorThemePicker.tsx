"use client";

import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useLocale } from "@/shared/i18n";
import type { ColorTheme } from "./theme";
import { useColorTheme } from "./useTheme";

/** The themes as they are offered: each one's name, and the colour of its ball (Uber's, Brutalism's and Glass's accents are black or white, by the page). */
const OPTIONS: { id: ColorTheme; name?: string; color: string }[] = [
  { id: "default", color: "oklch(0.6204 0.195 253.83)" },
  { id: "sky", name: "Sky", color: "lab(80.27% -18.8 -28.73)" },
  { id: "lavender", name: "Lavender", color: "lab(65.1% 40.58 -51.77)" },
  { id: "mint", name: "Mint", color: "lab(86.85% -42.84 22.61)" },
  { id: "netflix", name: "Netflix", color: "lab(49.09% 73.92 58.26)" },
  { id: "uber", name: "Uber", color: "oklch(45% 0 0)" },
  { id: "brutalism", name: "Brutalism", color: "oklch(72% 0 0)" },
  { id: "glass", name: "Glass", color: "oklch(82% 0.06 240)" },
  { id: "mouve", name: "Mouve", color: "oklch(62% 0.17 300)" },
];

function ColorBall({ color, className }: { color: string; className: string }) {
  return (
    <span
      aria-hidden
      className={`rounded-full ${className}`}
      style={{ background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${color} 55%, white), ${color} 60%, color-mix(in oklab, ${color} 75%, black))` }}
    />
  );
}

/** The button in the top bar, a ball in the current theme's colour, opens the colour themes: a ball for each, the current one ringed. */
export function ColorThemePicker() {
  const [colorTheme, setColorTheme] = useColorTheme();
  const { t } = useLocale();
  const current = OPTIONS.find(({ id }) => id === colorTheme) ?? OPTIONS[0];

  return (
    <Popover>
      <Button isIconOnly aria-label={t("common.colorTheme")} variant="ghost">
        <ColorBall color={current.color} className="size-5" />
      </Button>
      <Popover.Content placement="bottom end">
        <Popover.Dialog aria-label={t("common.colorTheme")} className="p-2 outline-none">
          <ToggleButtonGroup
            aria-label={t("common.colorTheme")}
            isDetached
            className="grid grid-cols-4 gap-1"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[colorTheme]}
            onSelectionChange={(keys) => {
              const [selected] = keys;
              if (selected) setColorTheme(selected as ColorTheme);
            }}
          >
            {OPTIONS.map(({ id, name, color }) => (
              <ToggleButton
                key={id}
                id={id}
                className="group h-auto w-16 min-w-0 flex-col gap-1.5 rounded-xl bg-transparent px-1 py-2 text-xs font-normal text-muted hover:bg-default data-[selected=true]:bg-transparent data-[selected=true]:text-foreground"
              >
                <ColorBall color={color} className="size-8 group-data-[selected=true]:outline-2 group-data-[selected=true]:outline-offset-2 group-data-[selected=true]:outline-accent" />
                {name ?? t("common.colorThemeDefault")}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
