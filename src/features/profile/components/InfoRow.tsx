import type { ReactNode } from "react";
import { useLocale } from "@/shared/i18n";

type InfoRowProps = {
  icon: ReactNode;
  /** What the value is. The icon says it on screen, so the label is only read by screen readers. */
  label: string;
  value: ReactNode;
  /** An optional control at the end of the row, e.g. a "Change" button. */
  action?: ReactNode;
};

/** The list that holds {@link InfoRow}s. */
export function InfoList({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-4">{children}</dl>;
}

/** One line of a profile: an icon and the value beside it. Must be placed in an {@link InfoList}. */
export function InfoRow({ icon, label, value, action }: InfoRowProps) {
  const { locale, t } = useLocale();
  const translatedField = locale === "en-US"
    ? ({ "Vị trí công tác": "work position", Email: "email", "Số điện thoại": "phone number", "Ngày sinh": "date of birth", "Giới tính": "gender", "Quê quán": "hometown", "Ngày gia nhập": "join date", "Thâm niên": "seniority", "Vai trò": "role", "Quyền trong hệ thống": "system permissions" } as Record<string, string>)[label] ?? label.toLowerCase()
    : label.toLowerCase();
  return (
    <div className="flex min-h-6 items-start gap-3">
      {/* Lined up with the first line of the value when it wraps. */}
      <span aria-hidden className="mt-0.5 shrink-0 text-foreground [&>svg]:size-5">
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 flex-1 text-base break-words text-foreground">
        {/* Without a value there is nothing for the icon to explain, so the empty state names the field. */}
        {value || <span className="text-muted">{t("profile.notUpdated").replace("{field}", translatedField)}</span>}
      </dd>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
