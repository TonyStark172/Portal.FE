import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { layoutSpans, type CardSpan } from "../../lib/gridLayout";

type ItemProps = { span?: CardSpan; children: ReactNode };

/** One card of the grid: half a row (default) or the whole row on large screens. */
function DashboardGridItem({ children }: ItemProps) {
  return <>{children}</>;
}

/**
 * The cards of a dashboard tab: two columns on large screens, one on small ones. A half card that would be alone
 * on its row stretches to the whole row, so adding or removing a card never leaves a hole.
 */
export function DashboardGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<ItemProps>[];
  const spans = layoutSpans(items.map((item) => item.props.span ?? "half"));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {items.map((item, index) => (
        <div key={item.key ?? index} data-span={spans[index]} className={spans[index] === "full" ? "lg:col-span-2" : undefined}>
          {item}
        </div>
      ))}
    </div>
  );
}

DashboardGrid.Item = DashboardGridItem;
