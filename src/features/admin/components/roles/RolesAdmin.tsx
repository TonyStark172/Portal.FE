"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Button, Skeleton, Spinner, toast } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import {
  useCreateRoleMutation,
  useGetPermissionsQuery,
  useGetRolesQuery,
  type RoleDto,
} from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { AdminNoAccess } from "../AdminNoAccess";
import { ConfirmDialog } from "../ConfirmDialog";
import { UnsavedChangesGuard } from "../UnsavedChangesGuard";
import { DeleteRoleDialog } from "./DeleteRoleDialog";
import { RoleDetail } from "./RoleDetail";
import { RoleDialog, type RoleDraft } from "./RoleDialog";
import { RoleList, RolePicker } from "./RoleList";
import { SwitchRoleDialog } from "./SwitchRoleDialog";
import { useRolePermissionDraft } from "./useRolePermissionDraft";

/** From this many unsaved changes, resetting asks first (a few ticks are quicker to tick again than to be asked about). */
const CONFIRM_RESET_FROM = 5;

/** The query parameter that names the role shown. */
const ROLE_PARAM = "role";

/** What the open dialog is for: a new role, or renaming one. */
type DialogState = { key: number; draft: RoleDraft };

/**
 * Roles & permissions: the administrator's alone (it is how permissions are granted), so anyone else typing
 * /admin/roles gets the no-access notice, and the requests below are not even sent for them. The roles in a list, and the
 * permissions of the one picked beside it; its ticks are a draft until "Save changes" sends them. One role is edited at a
 * time: picking another while there are unsaved changes asks first. A role is created or renamed through
 * {@link RoleDialog}, duplicated at once from its menu, and deleted through {@link DeleteRoleDialog}.
 */
export function RolesAdmin() {
  const { isAdministrator, isLoading } = useCurrentUser();
  const { t } = useLocale();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner aria-label={t("admin.opening")} />
      </div>
    );
  }
  if (!isAdministrator) return <AdminNoAccess />;

  return <RolesPage />;
}

/** The administrator's role first, then the default one, then the others by name. */
function displayOrder(roles: RoleDto[], locale: string): RoleDto[] {
  const rank = (role: RoleDto) => (role.isAdmin ? 0 : role.isDefault ? 1 : 2);
  return [...roles].sort((left, right) => rank(left) - rank(right) || left.name.localeCompare(right.name, locale));
}

/** "<name> (copy)", or with a number after it when a role of that name already exists. */
function copyName(role: RoleDto, taken: RoleDto[], template: string): string {
  const names = new Set(taken.map((other) => other.name.toLowerCase()));
  const base = template.replace("{name}", role.name);
  let name = base;
  for (let n = 2; names.has(name.toLowerCase()); n += 1) name = `${base} ${n}`;
  return name;
}

const parseId = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : null);

/**
 * Keeps `?role=` in the address on the role shown, so a reload or coming back to the page shows it again. The entry is
 * replaced, not added: picking roles does not fill the history. It is written again after a step through the history
 * that lands on this page with another role in it: the unsaved-changes guard steps back from its own entry once the
 * changes are saved or dropped, which can come after the switch to another role was written. And again when the address
 * changes under the page (`inAddress`, e.g. the active tab pressed again goes to /admin/roles without it).
 */
function useRoleInAddress(id: number | undefined, inAddress: string | null) {
  useEffect(() => {
    if (id === undefined) return;
    const here = location.pathname;
    const write = () => {
      if (location.pathname !== here) return;
      const url = new URL(location.href);
      if (url.searchParams.get(ROLE_PARAM) === String(id)) return;
      url.searchParams.set(ROLE_PARAM, String(id));
      // The entry keeps its state (the router's, and the guard's marker if it is the guard's entry).
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    };
    write();
    window.addEventListener("popstate", write);
    return () => window.removeEventListener("popstate", write);
  }, [id, inAddress]);
}

function RolesPage() {
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();
  const roles = useGetRolesQuery();
  const permissions = useGetPermissionsQuery();
  const [createRole] = useCreateRoleMutation();
  // The role asked for (from the address at first); the one shown falls back to the default role when it does not exist.
  const [wantedId, setWantedId] = useState(() => parseId(searchParams.get(ROLE_PARAM)));
  // A role just created or duplicated, shown once the list read again has it (until then the current role stays shown).
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [switching, setSwitching] = useState<RoleDto | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleting, setDeleting] = useState<{ key: number; role: RoleDto } | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  // A new key remounts a dialog (a fresh form) each time it is opened.
  const opened = useRef(0);

  const groups = permissions.data;
  const list = roles.data;
  const ordered = useMemo(() => displayOrder(list ?? [], locale), [list, locale]);
  const draft = useRolePermissionDraft(list, groups);
  const role = ordered.find((other) => other.id === wantedId) ?? ordered.find((other) => other.isDefault) ?? ordered[0];
  const changeCount = role ? draft.changeCountOf(role) : 0;
  useRoleInAddress(role?.id, searchParams.get(ROLE_PARAM));

  // The role just made is shown once it is listed, unless the role shown has unsaved changes by then (they stay where they
  // are; the new role is only listed). Decided while rendering, on the latest state, not in the handler that made it (whose
  // view of the changes may be stale); React renders again at once with the new selection.
  if (pendingId !== null && list?.some((other) => other.id === pendingId)) {
    setPendingId(null);
    if (changeCount === 0) setWantedId(pendingId);
  }

  const open = (next: RoleDraft) => {
    opened.current += 1;
    setDialog({ key: opened.current, draft: next });
  };
  const create = () => open({ id: null, name: "", description: "", permissions: [] });
  /** Shows a role just made once it is listed (see `pendingId`). */
  const showMade = (id: number) => setPendingId(id);

  /** Shows another role; with unsaved changes on the one shown, asks first. */
  const select = (next: RoleDto) => {
    if (!role || next.id === role.id) return;
    if (changeCount > 0) setSwitching(next);
    else setWantedId(next.id);
  };

  async function duplicate(source: RoleDto) {
    const name = copyName(source, list ?? [], t("admin.copyName"));
    try {
      // A copy is of what is saved, not of ticks not yet saved.
      const id = await createRole({ createRoleCommand: { name, description: source.description ?? null, permissions: draft.savedOf(source) } }).unwrap();
      toast.success(t("roles.duplicated").replace("{name}", name));
      showMade(id);
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  const reset = () => {
    if (!role) return;
    if (changeCount >= CONFIRM_RESET_FROM) setConfirmingReset(true);
    else draft.reset(role);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <UnsavedChangesGuard when={draft.changeCount > 0} />

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("admin.roles")}</h2>
        <p className="text-sm text-muted">{t("roles.intro")}</p>
      </div>

      {(roles.isError || permissions.isError) && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{roles.isError ? t("admin.rolesLoadError") : t("admin.permissionsLoadError")}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => (roles.isError ? roles.refetch() : permissions.refetch())}>
            {t("admin.retry")}
          </Button>
        </Alert>
      )}

      {roles.isLoading || (permissions.isLoading && !roles.isError) ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : list && list.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.noRoles")}</p>
      ) : (
        role &&
        groups && (
          // In the full-height layout the card takes what the heading leaves, and each pane scrolls on its own.
          <div data-roles-card className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-separator bg-surface">
            <RoleList
              roles={ordered}
              selectedId={role.id}
              isDirty={(other) => draft.changeCountOf(other) > 0}
              onSelect={select}
              onCreate={create}
            />
            <RoleDetail
              role={role}
              groups={groups}
              held={draft.permissionsOf(role)}
              isChanged={(code) => draft.isChanged(role, code)}
              changeCount={changeCount}
              isSaving={draft.isSaving}
              onSet={(codes, on) => draft.set(role, codes, on)}
              onReset={reset}
              onSave={() => void draft.save(role)}
              onRename={() => open({ id: role.id, name: role.name, description: role.description ?? "", permissions: draft.savedOf(role) })}
              onDuplicate={() => void duplicate(role)}
              onDelete={() => {
                opened.current += 1;
                setDeleting({ key: opened.current, role });
              }}
              picker={
                <RolePicker
                  roles={ordered}
                  selectedId={role.id}
                  onSelect={(id) => {
                    const next = ordered.find((other) => other.id === id);
                    if (next) select(next);
                  }}
                  onCreate={create}
                />
              }
            />
          </div>
        )
      )}

      {switching && role && (
        <SwitchRoleDialog
          roleName={role.name}
          changeCount={changeCount}
          isSaving={draft.isSaving}
          onSave={async () => {
            const saved = await draft.save(role);
            setSwitching(null);
            if (saved) setWantedId(switching.id);
          }}
          onDiscard={() => {
            draft.reset(role);
            setSwitching(null);
            setWantedId(switching.id);
          }}
          onStay={() => setSwitching(null)}
        />
      )}
      {dialog && <RoleDialog key={dialog.key} draft={dialog.draft} onSaved={dialog.draft.id === null ? showMade : undefined} onClose={() => setDialog(null)} />}
      {deleting && list && (
        <DeleteRoleDialog key={deleting.key} role={deleting.role} roles={list} onClose={() => setDeleting(null)} />
      )}
      {confirmingReset && role && (
        <ConfirmDialog
          title={t("roles.resetTitle").replace("{count}", String(changeCount))}
          message={t("roles.resetMessage")}
          confirmLabel={t("roles.reset")}
          cancelLabel={t("roles.keep")}
          danger
          isPending={false}
          onConfirm={() => {
            setConfirmingReset(false);
            draft.reset(role);
          }}
          onClose={() => setConfirmingReset(false)}
        />
      )}
    </div>
  );
}
