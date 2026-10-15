"use client";

import { useRef, useState } from "react";
import { Copy, Eye, Lock, Pencil, Plus, TrashBin } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Skeleton, Spinner } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import {
  useGetPermissionsQuery,
  useGetRolesQuery,
  type PermissionGroupDto,
  type RoleDto,
} from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { permissionGroupLabel } from "../../lib/permissionLabels";
import { AdminNoAccess } from "../AdminNoAccess";
import { DeleteRoleDialog } from "./DeleteRoleDialog";
import { RoleDialog, type RoleDraft } from "./RoleDialog";

/** How many permission groups a card names before the rest collapse into "+N". */
const VISIBLE_GROUPS = 3;

/** What the open dialog is for: a new role (possibly a copy of one), or looking at / changing an existing one. */
type DialogState = { key: number; draft: RoleDraft };

/**
 * Roles & permissions: the administrator's alone (it is how permissions are granted), so anyone else typing
 * /admin/roles gets the no-access notice, and the requests below are not even sent for them. One card per role; a role
 * is created, edited or duplicated through {@link RoleDialog} and deleted through {@link DeleteRoleDialog}.
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

function RolesPage() {
  const { t } = useLocale();
  const roles = useGetRolesQuery();
  const permissions = useGetPermissionsQuery();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleting, setDeleting] = useState<{ key: number; role: RoleDto } | null>(null);
  // A new key remounts a dialog (a fresh form) each time it is opened.
  const opened = useRef(0);

  const groups = permissions.data;
  const list = roles.data;
  const open = (draft: RoleDraft) => {
    opened.current += 1;
    setDialog({ key: opened.current, draft });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("admin.roles")}</h2>
        <Button isDisabled={!groups} onPress={() => open({ id: null, name: "", description: "", permissions: [], readOnly: false })}>
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

      {roles.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : list && list.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.noRoles")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list?.map((role) => (
            <li key={role.id} aria-label={role.name} className="flex">
              <RoleCard
                role={role}
                groups={groups}
                isReady={Boolean(groups)}
                onOpen={() => groups && open(draftOf(role, groups))}
                onDuplicate={() => open(copyOf(role, t("admin.copyName")))}
                onDelete={() => { opened.current += 1; setDeleting({ key: opened.current, role }); }}
              />
            </li>
          ))}
        </ul>
      )}

      {dialog && groups && (
        <RoleDialog key={dialog.key} draft={dialog.draft} groups={groups} onClose={() => setDialog(null)} />
      )}
      {deleting && list && (
        <DeleteRoleDialog key={deleting.key} role={deleting.role} roles={list} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

/**
 * The form's starting point for an existing role. The administrator's role is read-only and always holds every
 * permission the catalog has (so a permission added since it was saved is shown ticked).
 */
function draftOf(role: RoleDto, groups: PermissionGroupDto[]): RoleDraft {
  return {
    id: role.id,
    name: role.name,
    description: role.description ?? "",
    permissions: role.isAdmin ? groups.flatMap((group) => group.permissions) : role.permissions,
    readOnly: role.isAdmin,
  };
}

/** A copy is a new role (no id) with the original's description and permissions under a "(copy)" name. */
function copyOf(role: RoleDto, copyName: string): RoleDraft {
  return {
    id: null,
    name: copyName.replace("{name}", role.name),
    description: role.description ?? "",
    permissions: role.permissions,
    readOnly: false,
  };
}

type RoleCardProps = {
  role: RoleDto;
  groups: PermissionGroupDto[] | undefined;
  isReady: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function RoleCard({ role, groups, isReady, onOpen, onDuplicate, onDelete }: RoleCardProps) {
  const { t } = useLocale();
  const touched = groupsTouched(role, groups, t);

  return (
    <Card className="w-full gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-base font-semibold">{role.name}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {role.isDefault && (
            <Chip size="sm" variant="soft" color="accent">
              {t("admin.defaultRole")}
            </Chip>
          )}
          {role.isAdmin && <Lock role="img" aria-label={t("admin.administratorRole")} className="size-4 text-muted" />}
        </div>
      </div>

      {role.description && <p className="text-sm text-muted">{role.description}</p>}
      <p className="text-sm tabular-nums">{t("admin.peopleCount").replace("{count}", String(role.userCount))}</p>

      {touched.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {touched.slice(0, VISIBLE_GROUPS).map((name) => (
            <Chip key={name} size="sm" variant="secondary">
              {name}
            </Chip>
          ))}
          {touched.length > VISIBLE_GROUPS && (
            <Chip size="sm" variant="secondary">
              +{touched.length - VISIBLE_GROUPS}
            </Chip>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="secondary" isDisabled={!isReady} onPress={onOpen}>
          {role.isAdmin ? <Eye className="size-4" /> : <Pencil className="size-4" />}
          {role.isAdmin ? t("admin.view") : t("admin.edit")}
        </Button>
        <Button size="sm" variant="secondary" isDisabled={!isReady} onPress={onDuplicate}>
          <Copy className="size-4" />
          {t("admin.duplicate")}
        </Button>
        {!role.isAdmin && !role.isDefault && (
          <Button size="sm" variant="danger-soft" onPress={onDelete}>
            <TrashBin className="size-4" />
            {t("admin.delete")}
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * The names of the permission groups a role holds something of, in catalog order. A code the catalog does not list
 * counts under its own prefix ("Users.View" -> "Users"), so a card never hides what a role holds.
 */
function groupsTouched(role: RoleDto, groups: PermissionGroupDto[] | undefined, t: (key: string) => string): string[] {
  const held = new Set(role.permissions);
  const listed = new Set((groups ?? []).flatMap((group) => group.permissions));
  const names = (groups ?? []).filter((group) => group.permissions.some((code) => held.has(code))).map((group) => group.group);
  for (const code of role.permissions) {
    const prefix = code.split(".")[0];
    if (!listed.has(code) && !names.includes(prefix)) names.push(prefix);
  }
  return names.map((name) => permissionGroupLabel(name, t));
}
