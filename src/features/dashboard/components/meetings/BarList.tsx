export type BarListRow = {
  key: string;
  name: string;
  /** What the bar measures, against the largest row. */
  value: number;
  /** The row's figures after its name: the first (what the bar measures) in full ink, the others muted. */
  figures: { slot: string; text: string }[];
};

type Props = {
  rows: BarListRow[];
  /** Names the list for screen readers. */
  label: string;
  /** Marks each row (e.g. data-kind-row), for tests. */
  rowAttribute: string;
  /** Numbers the rows: a ranking. */
  ranked?: boolean;
};

/**
 * A ranked list read as a horizontal bar chart: on each row the name and its figures over a thin track filled by the
 * row's share of the largest, in one colour (a single measure). Names stay whole, wrapping on a phone, which a chart's
 * axis would cut short.
 */
export function BarList({ rows, label, rowAttribute, ranked = false }: Props) {
  const max = Math.max(0, ...rows.map((row) => row.value));
  return (
    <ol aria-label={label} className="flex flex-col divide-y divide-separator">
      {rows.map((row, index) => (
        <li key={row.key} {...{ [rowAttribute]: "" }} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-baseline gap-3 text-sm">
            {ranked && (
              <span aria-hidden className="w-4 shrink-0 tabular-nums text-muted">
                {index + 1}
              </span>
            )}
            <span data-slot="name" className="min-w-0 flex-1 break-words text-foreground md:truncate">
              {row.name}
            </span>
            {row.figures.map((figure, position) => (
              <span
                key={figure.slot}
                data-slot={figure.slot}
                className={`shrink-0 whitespace-nowrap tabular-nums ${position === 0 ? "font-medium text-foreground" : "min-w-16 text-end text-muted"}`}
              >
                {figure.text}
              </span>
            ))}
          </div>
          <div aria-hidden className={`h-1.5 rounded-full bg-default ${ranked ? "ms-7" : ""}`}>
            <div
              data-slot="bar"
              className="kpi-wipe h-full min-w-1.5 rounded-full bg-accent"
              style={{ width: `${max > 0 ? (row.value / max) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
