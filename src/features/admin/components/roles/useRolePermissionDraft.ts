"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "@heroui/react";
import { useUpdateRoleMutation, type PermissionGroupDto, type RoleDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";

/** What the user changed in a role: the codes ticked that it did not hold, and the codes unticked that it did. */
type Delta = { add: string[]; remove: string[] };

/** A role just saved: what it was saved with, and the permissions array the list had then (see `standIn`). */
type JustSaved = { codes: string[]; before: string[] };

/** The permissions a role was just saved with, while the list has not been read again since. */
const standIn = (saved: JustSaved | undefined, role: RoleDto) => (saved && saved.before === role.permissions ? saved.codes : undefined);

/**
 * The delta as it stands against what is saved now: a code ticked that the role holds by now (another administrator
 * ticked it too), or unticked that it no longer holds, is no change any more. That is how a list read again composes with
 * the user's ticks, and how a delta equal to the server's state disappears.
 */
const against = (delta: Delta, saved: string[]): Delta => ({
  add: delta.add.filter((code) => !saved.includes(code)),
  remove: delta.remove.filter((code) => saved.includes(code)),
});

/**
 * The permissions a role is being edited into: a delta per role (what was added and removed), kept apart from what the
 * server has until "Save" sends it. What a box shows is what is saved with the delta applied, so a list read again
 * (another administrator's change) shows through under the user's own ticks, and saving sends the merge of the two, never
 * the user's older view of the whole set. The page edits one role at a time, but the draft is kept per role, so a rename
 * or a refetch never mixes one role's ticks into another's.
 *
 * `saved` is what a role holds as far as this page knows: the server's list, except for a role just saved, whose new
 * permissions are used until the list is read again (so the boxes do not jump back for a moment). That is while the
 * role's permissions in the list are still the very array they were when it was saved.
 */
export function useRolePermissionDraft(roles: RoleDto[] | undefined, groups: PermissionGroupDto[] | undefined) {
  const { t } = useLocale();
  const [updateRole] = useUpdateRoleMutation();
  const [draft, setDraft] = useState<Record<number, Delta>>({});
  const [justSaved, setJustSaved] = useState<Record<number, JustSaved>>({});
  const [isSaving, setIsSaving] = useState(false);

  const listed = useMemo(() => (groups ?? []).flatMap((group) => group.permissions), [groups]);

  const savedOf = useCallback(
    (role: RoleDto) => (role.isAdmin ? listed : (standIn(justSaved[role.id], role) ?? role.permissions)),
    [listed, justSaved],
  );

  /** The codes in catalogue order, those the catalogue lacks after them. */
  const ordered = useCallback(
    (codes: Set<string>) => [...listed.filter((code) => codes.has(code)), ...[...codes].filter((code) => !listed.includes(code))],
    [listed],
  );

  /** The roles with unsaved ticks: their delta against what is saved, what they would hold, and how many boxes differ. */
  const changes = useMemo(() => {
    const found = new Map<number, { role: RoleDto; permissions: string[]; count: number; delta: Delta }>();
    for (const role of roles ?? []) {
      const entry = draft[role.id];
      if (!entry) continue;
      const saved = savedOf(role);
      const delta = against(entry, saved);
      if (delta.add.length + delta.remove.length === 0) continue;
      const next = new Set(saved);
      delta.remove.forEach((code) => next.delete(code));
      delta.add.forEach((code) => next.add(code));
      found.set(role.id, { role, permissions: ordered(next), count: delta.add.length + delta.remove.length, delta });
    }
    return found;
  }, [roles, draft, savedOf, ordered]);
  /** Every unsaved change on the page (what the leave guard watches). */
  const changeCount = [...changes.values()].reduce((sum, change) => sum + change.count, 0);

  const permissionsOf = useCallback((role: RoleDto) => changes.get(role.id)?.permissions ?? savedOf(role), [changes, savedOf]);
  const changeCountOf = (role: RoleDto) => changes.get(role.id)?.count ?? 0;
  const isChanged = (role: RoleDto, code: string) => {
    const delta = changes.get(role.id)?.delta;
    return !!delta && (delta.add.includes(code) || delta.remove.includes(code));
  };

  /** Ticks or unticks some boxes of a role in the draft (against what is saved: back to how it is saved is no change). */
  function set(role: RoleDto, codes: string[], on: boolean) {
    if (role.isAdmin || isSaving) return;
    const saved = savedOf(role);
    setDraft((current) => {
      const entry = current[role.id] ?? { add: [], remove: [] };
      const add = entry.add.filter((other) => !codes.includes(other));
      const remove = entry.remove.filter((other) => !codes.includes(other));
      for (const code of codes) {
        const held = saved.includes(code);
        if (on && !held) add.push(code);
        if (!on && held) remove.push(code);
      }
      const others = Object.fromEntries(Object.entries(current).filter(([id]) => Number(id) !== role.id));
      return add.length === 0 && remove.length === 0 ? others : { ...others, [role.id]: { add, remove } };
    });
  }

  /** Throws away a role's unsaved ticks: it is as last saved again. */
  const reset = (role: RoleDto) =>
    setDraft((current) => Object.fromEntries(Object.entries(current).filter(([id]) => Number(id) !== role.id)));

  /**
   * Sends the role's saved permissions with the user's ticks applied, its name and description unchanged. Saved, it leaves
   * the draft; refused, it stays in it (still marked) and the reason is shown with the role's name. Resolves to whether
   * nothing is left unsaved for the role.
   */
  async function save(role: RoleDto): Promise<boolean> {
    const change = changes.get(role.id);
    if (!change) return true;
    if (isSaving) return false;
    setIsSaving(true);
    try {
      const { permissions } = change;
      await updateRole({ id: role.id, updateRoleCommand: { name: role.name, description: role.description, permissions } }).unwrap();
      setJustSaved((previous) => ({ ...previous, [role.id]: { codes: permissions, before: role.permissions } }));
      reset(role);
      toast.success(t("roles.saved").replace("{role}", role.name));
      return true;
    } catch (failure) {
      toast.danger(`${role.name}: ${toApiProblem(failure).detail ?? t("common.genericError")}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return { permissionsOf, savedOf, isChanged, changeCountOf, set, reset, save, changeCount, isSaving };
}
