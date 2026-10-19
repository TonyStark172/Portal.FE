"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "@heroui/react";
import { useUpdateRoleMutation, type PermissionGroupDto, type RoleDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";

/** The permissions a role was just saved with, while the list has not been read again since. */
const standIn = (saved: { codes: string[]; before: string[] } | undefined, role: RoleDto) => (saved && saved.before === role.permissions ? saved.codes : undefined);

/** Whether the two lists hold the same codes (the order does not matter). */
const sameCodes = (left: string[], right: string[]) => left.length === right.length && left.every((code) => right.includes(code));

/** How many codes are in one list and not the other. */
const differences = (left: string[], right: string[]) =>
  left.filter((code) => !right.includes(code)).length + right.filter((code) => !left.includes(code)).length;

/**
 * The permissions the matrix is being edited into: a draft per role that has been ticked, kept apart from what the server
 * has until "Save" sends it. A role's draft is dropped as soon as it equals what is saved, so a cell ticked and unticked
 * again is no change. Roles not ticked at all have no draft.
 *
 * `saved` is what a role holds as far as this page knows: the server's list, except for a role just saved, whose new
 * permissions are used until the list is read again (so the boxes do not jump back for a moment). That is while the
 * role's permissions in the list are still the very array they were when it was saved.
 */
export function useRolePermissionDraft(roles: RoleDto[] | undefined, groups: PermissionGroupDto[] | undefined) {
  const { t } = useLocale();
  const [updateRole] = useUpdateRoleMutation();
  const [draft, setDraft] = useState<Record<number, string[]>>({});
  const [justSaved, setJustSaved] = useState<Record<number, { codes: string[]; before: string[] }>>({});
  const [isSaving, setIsSaving] = useState(false);

  const savedOf = useCallback(
    (role: RoleDto) => (role.isAdmin ? (groups ?? []).flatMap((group) => group.permissions) : (standIn(justSaved[role.id], role) ?? role.permissions)),
    [groups, justSaved],
  );
  const permissionsOf = useCallback((role: RoleDto) => draft[role.id] ?? savedOf(role), [draft, savedOf]);

  /** The roles with unsaved ticks, with the number of cells that differ from what is saved. */
  const changes = useMemo(() => {
    const found: { role: RoleDto; permissions: string[]; count: number }[] = [];
    for (const role of roles ?? []) {
      const permissions = draft[role.id];
      if (permissions) found.push({ role, permissions, count: differences(permissions, savedOf(role)) });
    }
    return found;
  }, [roles, draft, savedOf]);
  const changeCount = changes.reduce((sum, change) => sum + change.count, 0);

  const isChanged = (role: RoleDto, code: string) => {
    const ticked = draft[role.id];
    return ticked !== undefined && ticked.includes(code) !== savedOf(role).includes(code);
  };

  /** Ticks or unticks one cell in the draft. The codes are kept in catalogue order, those the catalogue lacks after them. */
  function toggle(role: RoleDto, code: string, on: boolean) {
    if (role.isAdmin || isSaving) return;
    const saved = savedOf(role);
    const next = new Set(draft[role.id] ?? saved);
    if (on) next.add(code);
    else next.delete(code);
    const listed = (groups ?? []).flatMap((group) => group.permissions);
    const ordered = [...listed.filter((candidate) => next.has(candidate)), ...[...next].filter((candidate) => !listed.includes(candidate))];
    setDraft((current) => {
      const others = Object.fromEntries(Object.entries(current).filter(([id]) => Number(id) !== role.id));
      return sameCodes(ordered, saved) ? others : { ...others, [role.id]: ordered };
    });
  }

  /** Throws away every unsaved tick: the matrix is as last saved again. */
  const reset = () => setDraft({});

  /**
   * Sends one update per changed role, all at once. A role saved leaves the draft; one the server refuses stays in it
   * (still marked) and its reason is shown. One toast says "saved" only when every role was.
   */
  async function save() {
    const ticked = draft;
    const todo = (roles ?? []).filter((role) => ticked[role.id]);
    if (todo.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const results = await Promise.allSettled(
        todo.map((role) =>
          updateRole({
            id: role.id,
            updateRoleCommand: { name: role.name, description: role.description, permissions: ticked[role.id] },
          }).unwrap(),
        ),
      );
      const saved: Record<number, { codes: string[]; before: string[] }> = {};
      const reasons = new Set<string>();
      results.forEach((result, index) => {
        const role = todo[index];
        if (result.status === "fulfilled") saved[role.id] = { codes: ticked[role.id], before: role.permissions };
        else reasons.add(toApiProblem(result.reason).detail ?? t("common.genericError"));
      });
      if (Object.keys(saved).length > 0) {
        setJustSaved((previous) => ({ ...previous, ...saved }));
        setDraft((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => !(id in saved))));
      }
      if (reasons.size === 0) toast.success(t("roles.saved"));
      else reasons.forEach((reason) => toast.danger(reason));
    } finally {
      setIsSaving(false);
    }
  }

  return { permissionsOf, savedOf, isChanged, toggle, reset, save, changeCount, isSaving };
}
