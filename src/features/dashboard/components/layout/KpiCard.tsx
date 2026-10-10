import type { ReactNode } from "react";
import { Card, Chip } from "@heroui/react";

type KpiCardProps = {
  /** Identifies the figure (data-kpi), e.g. for tests. */
  id: string;
  label: string;
  value: ReactNode;
  animationDelay?: number;
  /** A short note at the right of the value: a share, a change… */
  chip?: { text: ReactNode; color?: "default" | "success" | "danger" };
};

/** A headline figure at the top of a dashboard tab. */
export function KpiCard({ id, label, value, chip, animationDelay = 0 }: KpiCardProps) {
  return (
    <Card data-kpi={id} className="dashboard-reveal gap-4" style={{ animationDelay: `${animationDelay}ms` }}>
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums leading-none text-foreground">{value}</span>
        {chip && (
          <Chip size="sm" variant="soft" color={chip.color ?? "default"}>
            {chip.text}
          </Chip>
        )}
      </div>
    </Card>
  );
}
