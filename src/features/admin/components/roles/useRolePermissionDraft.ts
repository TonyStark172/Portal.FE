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
 * The permissions the matrix is being edited into: a delta per role that has been ticked (what was added and removed),
 * kept apart from what the server has until "Save" sends it. What a box shows is what is saved with the delta applied, so a
 * list read again (another administrator's change) shows through under the user's own ticks, and saving sends the
 * merge of the two, never the user's older view of the whole set.
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

  /** The roles with unsaved ticks: their delta against what is saved, what they would hold, and how many cells differ. */
  const changes = useMemo(() => {
    const found: { role: RoleDto; permissions: string[]; count: number; delta: Delta }[] = [];
    for (const role of roles ?? []) {
      const entry = draft[role.id];
      if (!entry) continue;
      const saved = savedOf(role);
      const delta = against(entry, saved);
      if (delta.add.length + delta.remove.length === 0) continue;
      const next = new Set(saved);
      delta.remove.forEach((code) => next.delete(code));
      delta.add.forEach((code) => next.add(code));
      found.push({ role, permissions: ordered(next), count: delta.add.length + delta.remove.length, delta });
    }
    return found;
  }, [roles, draft, savedOf, ordered]);
  const changeCount = changes.reduce((sum, change) => sum + change.count, 0);

  const permissionsOf = useCallback(
    (role: RoleDto) => changes.find((change) => change.role.id === role.id)?.permissions ?? savedOf(role),
    [changes, savedOf],
  );

  const isChanged = (role: RoleDto, code: string) => {
    const delta = changes.find((change) => change.role.id === role.id)?.delta;
    return !!delta && (delta.add.includes(code) || delta.remove.includes(code));
  };

  /** Ticks or unticks one cell in the draft (against what is saved: back to how it is saved is no change). */
  function toggle(role: RoleDto, code: string, on: boolean) {
    if (role.isAdmin || isSaving) return;
    const held = savedOf(role).includes(code);
    setDraft((current) => {
      const entry = current[role.id] ?? { add: [], remove: [] };
      const add = entry.add.filter((other) => other !== code);
      const remove = entry.remove.filter((other) => other !== code);
      if (on && !held) add.push(code);
      if (!on && held) remove.push(code);
      const others = Object.fromEntries(Object.entries(current).filter(([id]) => Number(id) !== role.id));
      return add.length === 0 && remove.length === 0 ? others : { ...others, [role.id]: { add, remove } };
    });
  }

  /** Throws away every unsaved tick: the matrix is as last saved again. */
  const reset = () => setDraft({});

  /**
   * Sends one update per role with a change, all at once, each the saved permissions with the user's ticks applied. A role
   * saved leaves the draft; one the server refuses stays in it (still marked) and its reason is shown with its name. One
   * toast says "saved" when every role was, else how many were.
   */
  async function save() {
    if (changes.length === 0 || isSaving) return;
    const todo = changes;
    setIsSaving(true);
    try {
      const results = await Promise.allSettled(
        todo.map(({ role, permissions }) =>
          updateRole({ id: role.id, updateRoleCommand: { name: role.name, description: role.description, permissions } }).unwrap(),
        ),
      );
      const saved: Record<number, JustSaved> = {};
      results.forEach((result, index) => {
        const { role, permissions } = todo[index];
        if (result.status === "fulfilled") saved[role.id] = { codes: permissions, before: role.permissions };
        else toast.danger(`${role.name}: ${toApiProblem(result.reason).detail ?? t("common.genericError")}`);
      });
      const done = Object.keys(saved).length;
      if (done > 0) setJustSaved((previous) => ({ ...previous, ...saved }));
      // Only the roles the server refused stay in the draft (saved ones are done; nothing else had a change).
      const refused = new Set(todo.map(({ role }) => role.id).filter((id) => !(id in saved)));
      setDraft((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => refused.has(Number(id)))));
      if (done === todo.length) toast.success(t("roles.saved"));
      else if (done > 0) toast.success(t("roles.savedSome").replace("{done}", String(done)).replace("{total}", String(todo.length)));
    } finally {
      setIsSaving(false);
    }
  }

  return { permissionsOf, savedOf, isChanged, toggle, reset, save, changeCount, isSaving };
}
