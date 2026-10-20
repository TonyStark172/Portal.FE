"use client";

import { useEffect, useState } from "react";
import { Magnifier } from "@gravity-ui/icons";
import { Button, Chip, Popover, SearchField } from "@heroui/react";
import { portalApi, type DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import "../../api";

/** What was picked in the search: a department, or a person (to be shown in their first department). */
export type ChartSearchPick =
  | { kind: "department"; departmentId: number }
  | { kind: "person"; departmentId: number; userId: number; fullName: string };

/** A pick with what it takes to list it again under "Tìm gần đây". */
type Recent = { pick: ChartSearchPick; label: string; detail: string | null; avatarUrl?: string | null };

const MAX_RECENT = 5;
const DEBOUNCE_MS = 300;

/** The session's last picks, newest first. Module state on purpose: it outlives the popover and the page, not the tab. */
let recent: Recent[] = [];

const sameTarget = (a: ChartSearchPick, b: ChartSearchPick) =>
  a.kind === b.kind && (a.kind === "department" ? a.departmentId === (b as typeof a).departmentId : a.userId === (b as typeof a).userId);

function remember(entry: Recent) {
  recent = [entry, ...recent.filter((other) => !sameTarget(other.pick, entry.pick))].slice(0, MAX_RECENT);
}

/** Forgets the recent picks (for tests; the app keeps them for the whole session). */
export function clearRecentChartSearches() {
  recent = [];
}

type Props = {
  /** The chart's departments: their state (inactive ones get a chip) and names (shown under a person). */
  nodes: DepartmentChartNode[];
  onPick: (pick: ChartSearchPick) => void;
};

/**
 * The toolbar's search: a magnifier button that opens a popover with one search field. Typing pauses 300 ms, then the
 * server is asked (one character is enough) and the hits come in two sections, "Phòng ban" and "Người". Departments that
 * are switched off are listed too, with the "Ngừng hoạt động" chip. With nothing typed, the last 5 picks of the session
 * are offered under "Tìm gần đây". Picking closes the popover and hands the pick to `onPick`; what to do with it (open
 * the way to the card, select it, scroll to it) is the page's business.
 */
export function ChartSearch({ nodes, onPick }: Props) {
  const { t } = useLocale();
  const [isOpen, setOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setOpen}>
      <Button isIconOnly variant="secondary" aria-label={t("departments.search")}>
        <Magnifier className="size-4" />
      </Button>
      <Popover.Content placement="bottom end" className="w-96 max-w-[calc(100vw-2rem)]">
        <Popover.Dialog aria-label={t("departments.search")} className="flex flex-col gap-3 outline-none">
          <SearchBody
            nodes={nodes}
            onPick={(entry) => {
              remember(entry);
              setOpen(false);
              onPick(entry.pick);
            }}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** The popover's content; it exists only while the popover is open, so each opening starts with an empty field. */
function SearchBody({ nodes, onPick }: { nodes: DepartmentChartNode[]; onPick: (entry: Recent) => void }) {
  const { t } = useLocale();
  const [term, setTerm] = useState("");
  // The term that was last sent (after the pause); the lazy query keeps its latest answer meanwhile.
  const [asked, setAsked] = useState("");
  const [run, result] = portalApi.useLazySearchDepartmentChartQuery();

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = term.trim();
      setAsked(next);
      if (next) void run({ search: next }, true);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, run]);

  const nameOf = (id: number) => nodes.find((node) => node.id === id)?.name;
  const isInactive = (id: number) => nodes.some((node) => node.id === id && !node.isActive);
  const typed = term.trim() !== "";
  const hits = typed && asked !== "" ? result.data : undefined;

  const departmentEntry = (hit: { id: number; name: string; code: string }): Recent => ({
    pick: { kind: "department", departmentId: hit.id },
    label: hit.name,
    detail: hit.code,
  });
  const personEntry = (hit: { userId: number; fullName: string; avatarUrl?: string | null; positionName?: string | null; departmentIds: number[] }): Recent => ({
    // `departmentIds` lists the primary department first. A person with none cannot be shown on the chart (-1: no card).
    pick: { kind: "person", departmentId: hit.departmentIds[0] ?? -1, userId: hit.userId, fullName: hit.fullName },
    label: hit.fullName,
    detail: [hit.positionName ?? t("departments.noPosition"), nameOf(hit.departmentIds[0] ?? -1)].filter(Boolean).join(" · "),
    avatarUrl: hit.avatarUrl,
  });

  function row(entry: Recent) {
    const { pick } = entry;
    return (
      <li key={`${pick.kind}-${pick.kind === "department" ? pick.departmentId : pick.userId}`}>
        <button
          type="button"
          onClick={() => onPick(entry)}
          disabled={pick.departmentId < 0}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
        >
          {pick.kind === "person" && <UserAvatar fullName={entry.label} avatarUrl={entry.avatarUrl} size="sm" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{entry.label}</span>
            {entry.detail && <span className="block truncate text-xs text-muted">{entry.detail}</span>}
          </span>
          {pick.kind === "department" && isInactive(pick.departmentId) && (
            <Chip size="sm" variant="soft" className="shrink-0">
              {t("departments.inactive")}
            </Chip>
          )}
        </button>
      </li>
    );
  }

  const section = (title: string, entries: Recent[]) =>
    entries.length > 0 && (
      <section aria-label={title} className="flex flex-col gap-1">
        <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
        <ul className="flex flex-col">{entries.map(row)}</ul>
      </section>
    );

  const departments = hits?.departments.map(departmentEntry) ?? [];
  const people = hits?.people.map(personEntry) ?? [];

  return (
    <>
      <SearchField autoFocus aria-label={t("departments.searchPlaceholder")} value={term} onChange={setTerm} variant="secondary" fullWidth>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t("departments.searchPlaceholder")} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <div aria-busy={result.isFetching} className="flex max-h-96 flex-col gap-3 overflow-y-auto">
        {!typed && section(t("departments.searchRecent"), recent)}
        {section(t("departments.searchDepartments"), departments)}
        {section(t("departments.searchPeople"), people)}
        {hits && departments.length === 0 && people.length === 0 && <p className="px-2 py-3 text-sm text-muted">{t("departments.searchNone")}</p>}
        {typed && result.isError && <p className="px-2 py-3 text-sm text-danger">{t("departments.searchError")}</p>}
      </div>
    </>
  );
}
