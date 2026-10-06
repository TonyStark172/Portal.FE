"use client";

import { Card, Chip, Spinner } from "@heroui/react";
import { useCurrentUser } from "../hooks/useCurrentUser";

/** Who is signed in: positions, roles and number of permissions. */
export function CurrentUserSummary() {
  const { user, permissions, isLoading } = useCurrentUser();

  if (isLoading || !user) return <Spinner aria-label="Đang tải" />;

  return (
    <Card className="max-w-2xl">
      <Card.Header>
        <Card.Title>Xin chào, {user.fullName}</Card.Title>
        <Card.Description>Tên đăng nhập: {user.userName}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4 text-sm">
        <section>
          <h4 className="mb-2 font-medium">Vị trí công tác</h4>
          {user.assignments.length === 0 ? (
            <p className="text-muted">Chưa được phân vào phòng ban nào.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {user.assignments.map((a) => (
                <li key={`${a.departmentId}-${a.positionId}`}>
                  {a.positionName} — {a.departmentName}
                  {a.isPrimary && <Chip size="sm" className="ml-2">Chính</Chip>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h4 className="mb-2 font-medium">Vai trò</h4>
          <div className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <Chip key={role.id} size="sm">{role.name}</Chip>
            ))}
          </div>
          <p className="mt-2 text-muted">Có {permissions.length} quyền trong hệ thống.</p>
        </section>
      </Card.Content>
    </Card>
  );
}
