"use client";

import { useId } from "react";
import { Chip } from "@heroui/react";
import type { PermissionGroupDto, RoleDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { permissionGroupLabel, permissionLabel } from "../../lib/permissionLabels";

type Props = {
  /**
   * The permission catalogue (GET /permissions): it sets the order of the modules and of the permissions in them.
   * `undefined` while it loads (a blank of the same kind keeps the dialog from jumping); `[]` when it could not be loaded.
   */
  groups: PermissionGroupDto[] | undefined;
  /** Every role there is; `undefined` while they load. */
  roles: RoleDto[] | undefined;
  /** The roles whose permissions are shown (a fixed administrator role included). */
  roleIds: number[];
};

/**
 * What a person can do, read from the roles chosen for them: the union of the roles' permissions, grouped by module in
 * catalogue order. Permissions come only from roles, so this is the whole picture. The administrator role holds
 * everything, so it is told in a line instead of a list. Read-only; the list scrolls so a long one does not push the
 * dialog's buttons away.
 */
export function RolePermissionsPreview({ groups, roles, roleIds }: Props) {
  const { t } = useLocale();
  const titleId = useId();
  const loading = !groups || !roles;
  const chosen = (roles ?? []).filter((role) => roleIds.includes(role.id));
  const holdsEverything = chosen.some((role) => role.isAdmin);
  const held = new Set(chosen.flatMap((role) => role.permissions));

  // Catalogue order; a code the catalogue does not list (added on the back end first) counts under its own prefix
  // ("Reports.Export" -> "Reports"), after the catalogue's modules, so nothing a role holds is hidden.
  const catalogue = groups ?? [];
  const listed = new Set(catalogue.flatMap((group) => group.permissions));
  const shown = catalogue.map((group) => ({ group: group.group, codes: group.permissions.filter((code) => held.has(code)) }));
  for (const code of held) {
    if (listed.has(code)) continue;
    const prefix = code.split(".")[0];
    const existing = shown.find((entry) => entry.group === prefix);
    if (existing) existing.codes.push(code);
    else shown.push({ group: prefix, codes: [code] });
  }
  const modules = shown.filter((entry) => entry.codes.length > 0);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-separator p-3">
      <div className="flex flex-col">
        <h3 id={titleId} className="text-sm font-medium">{t("admin.permissionPreview.title")}</h3>
        <p className="text-xs text-muted">{t("admin.permissionPreview.hint")}</p>
      </div>
      {loading ? (
        <div aria-busy="true" className="h-16 animate-pulse rounded-lg bg-default" />
      ) : holdsEverything ? (
        <p className="text-sm font-medium">{t("admin.permissionPreview.administrator")}</p>
      ) : modules.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.permissionPreview.empty")}</p>
      ) : (
        // Focusable, so the keyboard can scroll it.
        <div role="region" aria-labelledby={titleId} tabIndex={0} className="flex max-h-48 flex-col gap-2 overflow-y-auto">
          {modules.map(({ group, codes }) => {
            const name = permissionGroupLabel(group, t);
            return (
              <div key={group} role="group" aria-label={name} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted" aria-hidden="true">{name}</span>
                <ul className="flex flex-wrap gap-1">
                  {codes.map((code) => (
                    <li key={code}>
                      <Chip size="sm" variant="soft">{permissionLabel(code, t)}</Chip>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
