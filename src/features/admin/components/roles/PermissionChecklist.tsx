"use client";

import { Checkbox, Description } from "@heroui/react";
import type { PermissionGroupDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { permissionDescription, permissionGroupLabel, permissionLabel } from "../../lib/permissionLabels";

type Props = { groups: PermissionGroupDto[]; value: string[]; onChange: (value: string[]) => void; isDisabled?: boolean };

/**
 * Every permission the system has, grouped by module, each group with a box that ticks or unticks it whole (mixed when
 * only some are ticked). `onChange` always reports the ticked codes in catalog order (the order of `groups`), so the
 * saved list of a role does not depend on the order the boxes were clicked in.
 */
export function PermissionChecklist({ groups, value, onChange, isDisabled }: Props) {
  const { t } = useLocale();
  const selected = new Set(value);
  const set = (codes: string[], on: boolean) => {
    const next = new Set(selected);
    for (const code of codes) {
      if (on) next.add(code);
      else next.delete(code);
    }
    onChange(groups.flatMap((group) => group.permissions).filter((code) => next.has(code)));
  };

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const ticked = group.permissions.filter((code) => selected.has(code)).length;
        const name = permissionGroupLabel(group.group, t);
        return (
          <fieldset key={group.group} className="flex flex-col gap-2 rounded-xl border border-separator p-3">
            <legend className="px-1">
              <Checkbox
                isSelected={group.permissions.length > 0 && ticked === group.permissions.length}
                isIndeterminate={ticked > 0 && ticked < group.permissions.length}
                onChange={(on) => set(group.permissions, on)}
                isDisabled={isDisabled}
                aria-label={t("admin.selectGroup").replace("{group}", name)}
              >
                <Checkbox.Content>
                  <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                  <span className="font-medium">{name}</span>
                </Checkbox.Content>
              </Checkbox>
            </legend>
            {group.permissions.map((code) => {
              const description = permissionDescription(code, t);
              return (
                <Checkbox key={code} isSelected={selected.has(code)} onChange={(on) => set([code], on)} isDisabled={isDisabled}>
                  <Checkbox.Content>
                    <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                    {permissionLabel(code, t)}
                  </Checkbox.Content>
                  {description && <Description>{description}</Description>}
                </Checkbox>
              );
            })}
          </fieldset>
        );
      })}
    </div>
  );
}
