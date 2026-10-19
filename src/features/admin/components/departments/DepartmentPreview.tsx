"use client";

import type { DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { DepartmentCard } from "./DepartmentCard";
import type { ChosenPerson } from "./PeoplePicker";

type Props = {
  /** What the card hangs from: the parent department's name, or the organization's. */
  parentName: string;
  /** The name typed so far; empty shows the placeholder. */
  name: string;
  /** The heads chosen (the card shows the first, and how many more). */
  heads: ChosenPerson[];
  deputies: ChosenPerson[];
  memberCount: number;
};

/**
 * What the wizard is making, as the chart will draw it: the parent's name above a {@link DepartmentCard} (the chart's
 * own card, with no menu, no footer and nothing to select) showing the typed name, the first chosen head or the "no
 * head" line, the headcount, and the deputies' avatars. It only reads what the wizard holds.
 */
export function DepartmentPreview({ parentName, name, heads, deputies, memberCount }: Props) {
  const { t } = useLocale();
  const shownName = name.trim() || t("departments.wizard.namePlaceholder");
  const preview: DepartmentChartNode = {
    id: -1,
    code: "",
    name: shownName,
    originalName: shownName,
    description: null,
    parentId: null,
    isActive: true,
    memberCount,
    childCount: 0,
    headCount: heads.length,
    heads: heads.slice(0, 1).map((head) => ({ userId: head.id, fullName: head.fullName, avatarUrl: null })),
  };

  return (
    <div aria-label={t("departments.wizard.preview")} role="region" className="flex flex-col items-center gap-3 rounded-2xl bg-surface-secondary p-4">
      <p className="max-w-full truncate text-sm font-medium text-muted">{parentName}</p>
      <span className="block h-3 w-px bg-border" />
      <DepartmentCard
        node={preview}
        isSelected={false}
        isMine={false}
        isCollapsed={false}
        rights={{ create: false, update: false, delete: false }}
        onSelect={() => undefined}
        onToggleCollapse={() => undefined}
        onMenuAction={() => undefined}
        extra={
          deputies.length > 0 && (
            <ul aria-label={t("departments.wizard.deputy")} className="flex -space-x-1.5">
              {deputies.map((deputy) => (
                <li key={deputy.id} title={deputy.fullName}>
                  <UserAvatar fullName={deputy.fullName} size="sm" />
                </li>
              ))}
            </ul>
          )
        }
      />
    </div>
  );
}
