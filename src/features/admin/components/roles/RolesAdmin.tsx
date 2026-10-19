"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRotateLeft, Plus } from "@gravity-ui/icons";
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
import { PermissionMatrix } from "./PermissionMatrix";
import { RoleDialog, type RoleDraft } from "./RoleDialog";
import { useRolePermissionDraft } from "./useRolePermissionDraft";

/** From this many unsaved changes, resetting asks first (a few ticks are quicker to tick again than to be asked about). */
const CONFIRM_RESET_FROM = 5;

/** What the open dialog is for: a new role, or renaming one. */
type DialogState = { key: number; draft: RoleDraft };

/**
 * Roles & permissions: the administrator's alone (it is how permissions are granted), so anyone else typing
 * /admin/roles gets the no-access notice, and the requests below are not even sent for them. A matrix of the permissions
 * against the roles; the ticks are a draft until "Save changes" sends them. A role is created or renamed through
 * {@link RoleDialog}, duplicated at once from its column menu, and deleted through {@link DeleteRoleDialog}.
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

function RolesPage() {
  const { t, locale } = useLocale();
  const roles = useGetRolesQuery();
  const permissions = useGetPermissionsQuery();
  const [createRole] = useCreateRoleMutation();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleting, setDeleting] = useState<{ key: number; role: RoleDto } | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  // A new key remounts a dialog (a fresh form) each time it is opened.
  const opened = useRef(0);

  const groups = permissions.data;
  const list = roles.data;
  const ordered = useMemo(() => displayOrder(list ?? [], locale), [list, locale]);
  const draft = useRolePermissionDraft(list, groups);
  const hasChanges = draft.changeCount > 0;

  const open = (next: RoleDraft) => {
    opened.current += 1;
    setDialog({ key: opened.current, draft: next });
  };

  async function duplicate(role: RoleDto) {
    const name = copyName(role, list ?? [], t("admin.copyName"));
    try {
      // A copy is of what is saved, not of ticks not yet saved.
      await createRole({ createRoleCommand: { name, description: role.description ?? null, permissions: draft.savedOf(role) } }).unwrap();
      toast.success(t("roles.duplicated").replace("{name}", name));
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  const reset = () => {
    if (draft.changeCount >= CONFIRM_RESET_FROM) setConfirmingReset(true);
    else draft.reset();
  };

  return (
    <div className="flex flex-col gap-4">
      <UnsavedChangesGuard when={hasChanges} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("admin.roles")}</h2>
        <Button isDisabled={!groups} onPress={() => open({ id: null, name: "", description: "", permissions: [] })}>
          <Plus className="size-4" />
          {t("admin.createRole")}
        </Button>
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
        <Skeleton className="h-80 rounded-2xl" />
      ) : list && list.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.noRoles")}</p>
      ) : (
        list &&
        groups && (
          <section aria-label={t("admin.roles")} className="overflow-hidden rounded-2xl border border-separator bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator px-4 py-3">
              <p className="min-w-0 flex-1 basis-64 text-sm text-muted">{t("roles.intro")}</p>
              <Button size="sm" variant="secondary" isDisabled={!hasChanges || draft.isSaving} onPress={reset}>
                <ArrowRotateLeft className="size-4" />
                {t("roles.reset")}
              </Button>
            </div>
            <PermissionMatrix
              roles={ordered}
              groups={groups}
              permissionsOf={draft.permissionsOf}
              isChanged={draft.isChanged}
              onToggle={draft.toggle}
              isDisabled={draft.isSaving}
              onRename={(role) => open({ id: role.id, name: role.name, description: role.description ?? "", permissions: draft.savedOf(role) })}
              onDuplicate={(role) => void duplicate(role)}
              onDelete={(role) => {
                opened.current += 1;
                setDeleting({ key: opened.current, role });
              }}
            />
          </section>
        )
      )}

      {list && groups && (
        <div
          role="region"
          aria-label={t("roles.saveBar")}
          className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-separator bg-surface/95 px-4 py-3 shadow-lg backdrop-blur"
        >
          <p aria-live="polite" className="text-sm tabular-nums">
            {hasChanges ? t("roles.pending").replace("{count}", String(draft.changeCount)) : t("roles.noPending")}
          </p>
          <Button isDisabled={!hasChanges} isPending={draft.isSaving} onPress={() => void draft.save()}>
            {t("roles.save")}
          </Button>
        </div>
      )}

      {dialog && <RoleDialog key={dialog.key} draft={dialog.draft} onClose={() => setDialog(null)} />}
      {deleting && list && (
        <DeleteRoleDialog key={deleting.key} role={deleting.role} roles={list} onClose={() => setDeleting(null)} />
      )}
      {confirmingReset && (
        <ConfirmDialog
          title={t("roles.resetTitle").replace("{count}", String(draft.changeCount))}
          message={t("roles.resetMessage")}
          confirmLabel={t("roles.reset")}
          cancelLabel={t("roles.keep")}
          danger
          isPending={false}
          onConfirm={() => {
            setConfirmingReset(false);
            draft.reset();
          }}
          onClose={() => setConfirmingReset(false)}
        />
      )}
    </div>
  );
}
