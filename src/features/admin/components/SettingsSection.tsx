import { useId, type ReactNode } from "react";

type Props = {
  title: string;
  /** One line on what the part is for, under the title. */
  description?: string;
  /** "danger": the title in the danger colour (handing administration over…). */
  tone?: "default" | "danger";
  /**
   * What the part has saved, at a glance, in a third column at the right of its row (very wide screens; below the
   * fields otherwise). Pass it, `null` included, on every part of a page that has such a column, so the column and
   * its line run down the whole page; leave it out on pages without one.
   */
  aside?: ReactNode;
  children: ReactNode;
};

/**
 * One part of a settings page: on a wide screen a row, its title and what it is for on the left (a third), its fields
 * on the right; on a narrow one the two stacked. With an `aside`, a very wide screen gets a third column beside the
 * fields, after a vertical line. Parts are not boxed: the page puts a thin line between them
 * (`divide-y divide-separator` on their parent). The padding is in the cells, not the row, so the vertical line runs
 * unbroken from one part to the next.
 */
export function SettingsSection({ title, description, tone = "default", aside, children }: Props) {
  const heading = useId();
  const withAside = aside !== undefined;

  return (
    <section
      aria-labelledby={heading}
      className={`group/part grid gap-x-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] ${withAside ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_18rem] xl:gap-x-0" : ""}`}
    >
      <div className={`flex flex-col gap-1 pt-8 group-first/part:pt-2 lg:pb-8 ${withAside ? "xl:pe-10" : ""}`}>
        <h2 id={heading} className={`text-base font-semibold ${tone === "danger" ? "text-danger" : "text-foreground"}`}>{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <div className={`min-w-0 pb-8 pt-4 lg:pt-8 lg:group-first/part:pt-2 ${withAside ? "xl:pe-8" : ""}`}>{children}</div>
      {withAside && (
        <div className="min-w-0 pb-8 lg:col-start-2 xl:col-start-auto xl:border-s xl:border-separator xl:ps-8 xl:pt-8 xl:group-first/part:pt-2">
          {aside}
        </div>
      )}
    </section>
  );
}
