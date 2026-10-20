"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Autocomplete, Button, Drawer, EmptyState, Header, Label, ListBox, Popover, SearchField, Select, Tooltip, type Key } from "@heroui/react";
import { Funnel } from "@gravity-ui/icons";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { activeFilterCount, noFilters, type CalendarShow, type MeetingFilters } from "../meetingFilters";
import { useMeetingsClient } from "../meetingsClient";
import type { MeetingKindDto, MeetingLocationDto } from "../meetingTypes";

const DEBOUNCE_MS = 300;
const withCount = (label: string, count: number) => count ? `${label} (${count})` : label;

/** Several choices in a narrow box: the first one and how many more ("501 +9"); every name in the tooltip. */
function Chosen({ names }: { names: string[] }) {
  return <span className="block min-w-0 truncate" title={names.join(", ")}>{names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0]}</span>;
}

/** Where the filters are: in a row ("inline"), behind a "Filters (n)" button ("popover"), or in a sheet from a phone's funnel icon. */
export type FilterBarVariant = "inline" | "popover" | "sheet";
type Props = { filters: MeetingFilters; onChange: (filters: MeetingFilters) => void; kinds: MeetingKindDto[]; disabled?: boolean; variant?: FilterBarVariant };

/**
 * What the calendar shows: a title search, "mine", kinds (hidden ones too), places, and whether it shows meetings,
 * company events and holidays and birthdays at all. On a narrower screen
 * the same controls open from a "Filters (n)" button, on a phone from a funnel icon as a sheet from the bottom.
 */
export function MeetingFilterBar({ filters, onChange, kinds, disabled, variant = "inline" }: Props) {
  const compact = variant !== "inline";
  const { t } = useLocale();
  const count = activeFilterCount(filters);

  // The search is typed here and reported after a pause; a search changed from outside (cleared) replaces the text.
  const [text, setText] = useState(filters.search);
  const [reported, setReported] = useState(filters.search);
  if (reported !== filters.search) { setReported(filters.search); setText(filters.search); }
  const latest = useRef({ filters, onChange });
  useLayoutEffect(() => { latest.current = { filters, onChange }; });
  const timer = useRef<number | null>(null);
  const stopTimer = () => { if (timer.current !== null) window.clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stopTimer, []);
  const type = (value: string) => {
    setText(value);
    stopTimer();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const { filters: current, onChange: report } = latest.current;
      if (value !== current.search) report({ ...current, search: value });
    }, DEBOUNCE_MS);
  };
  const clear = () => { stopTimer(); setText(""); onChange(noFilters); };

  const fields = (
    <>
      <SearchField aria-label={t("meetings.filterSearch")} value={text} onChange={type} isDisabled={disabled} maxLength={100} className={compact ? "w-full" : "min-w-44 max-w-md flex-1"}>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t(variant === "sheet" ? "meetings.filterSearchShort" : "meetings.filterSearch")} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <KindFilter kinds={kinds} mine={filters.mine} kindIds={filters.kindIds} disabled={disabled} wide={compact}
        onChange={(mine, kindIds) => onChange({ ...filters, mine, kindIds })} />
      <LocationFilter value={filters.locations} disabled={disabled} wide={compact} onChange={locations => onChange({ ...filters, locations })} />
      <ShowFilter show={filters.show} disabled={disabled} wide={compact} onChange={show => onChange({ ...filters, show })} />
    </>
  );
  const clearButton = count > 0 && <Button size="sm" variant="ghost" className="shrink-0" isDisabled={disabled} onPress={clear}>{withCount(t("meetings.clearFilters"), count)}</Button>;
  // Phones and tablets open the filters from a funnel icon with a small count; the name says it too.
  const funnel = (
    <Tooltip delay={400}>
      <Button size="sm" variant="ghost" isIconOnly isDisabled={disabled} aria-label={withCount(t("meetings.filters"), count)} className="tap-target relative">
        <Funnel className="size-4" />
        {count > 0 && <span aria-hidden className="meeting-filter-badge">{count}</span>}
      </Button>
      <Tooltip.Content>{t("meetings.filters")}</Tooltip.Content>
    </Tooltip>
  );
  if (variant === "sheet") return (
    <Drawer>
      {funnel}
      <Drawer.Backdrop>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog>
            <Drawer.Handle />
            <Drawer.Header className="flex-row items-center justify-between gap-2">
              <Drawer.Heading className="text-base font-semibold">{t("meetings.filters")}</Drawer.Heading>
              {clearButton}
            </Drawer.Header>
            <Drawer.Body className="flex flex-col items-stretch gap-3 pb-4">{fields}</Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
  if (variant === "popover") return (
    <Popover>
      {funnel}
      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label={t("meetings.filtersLabel")} className="flex w-[min(20rem,calc(100vw-2rem))] flex-col items-stretch gap-3 p-3">{fields}{clearButton}</Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
  // One line that never wraps (a desktop below it takes the tablet's toolbar): the search gives way to "Xóa lọc", so
  // the calendar under the row never moves while filtering.
  return <div role="group" aria-label={t("meetings.filtersLabel")} className="meeting-filters flex items-center gap-3">{fields}{clearButton}</div>;
}

const showKeys = ["meetings", "events", "occasions"] as const;
const showLabels = { meetings: "events.showMeetings", events: "events.showEvents", occasions: "events.showOccasions" } as const;

/** Whether the calendar shows meetings, company events, and holidays and birthdays: one of them at least. */
function ShowFilter({ show, onChange, disabled, wide }: { show: CalendarShow; onChange: (show: CalendarShow) => void; disabled?: boolean; wide: boolean }) {
  const { t } = useLocale();
  const shown = showKeys.filter(key => show[key]);
  return (
    <Select selectionMode="multiple" value={[...shown]} isDisabled={disabled} className={wide ? "w-full" : "w-36 shrink-0"}
      onChange={keys => {
        const chosen = (keys as Key[]).map(String);
        // Showing nothing at all is not a choice: the last one stays.
        if (chosen.length) onChange(Object.fromEntries(showKeys.map(key => [key, chosen.includes(key)])) as CalendarShow);
      }}>
      <Label className="sr-only">{t("events.show")}</Label>
      <Select.Trigger>
        <Select.Value className="min-w-0 flex-1 overflow-hidden">
          {() => shown.length === showKeys.length ? <span className="block truncate">{t("events.showAll")}</span> : <Chosen names={shown.map(key => t(showLabels[key]))} />}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Section>
            <Header>{t("events.show")}</Header>
            {showKeys.map(key => <ListBox.Item id={key} key={key} textValue={t(showLabels[key])}>{t(showLabels[key])}<ListBox.ItemIndicator /></ListBox.Item>)}
          </ListBox.Section>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

const MINE = "mine";

/** Whose meetings ("mine" first, in its own group) and which kinds — one list, so the bar stays short. */
function KindFilter({ kinds, mine, kindIds, onChange, disabled, wide }: {
  kinds: MeetingKindDto[]; mine: boolean; kindIds: number[]; onChange: (mine: boolean, kindIds: number[]) => void; disabled?: boolean; wide: boolean;
}) {
  const { t } = useLocale();
  const value: Key[] = [...(mine ? [MINE] : []), ...kindIds];
  const names = [...(mine ? [t("meetings.filterMine")] : []), ...kindIds.map(id => kinds.find(kind => kind.id === id)?.name ?? String(id))];
  return (
    <Select selectionMode="multiple" placeholder={t("meetings.allMeetings")} value={value} isDisabled={disabled} className={wide ? "w-full" : "w-52 shrink-0"}
      onChange={keys => {
        const chosen = keys as Key[];
        onChange(chosen.includes(MINE), chosen.filter(key => key !== MINE).map(Number));
      }}>
      <Label className="sr-only">{t("meetings.filterKinds")}</Label>
      <Select.Trigger>
        <Select.Value className="min-w-0 flex-1 overflow-hidden">{({ defaultChildren }) => names.length ? <Chosen names={names} /> : defaultChildren}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Section>
            <Header>{t("meetings.filterScope")}</Header>
            <ListBox.Item id={MINE} textValue={t("meetings.filterMineOption")}>{t("meetings.filterMineOption")}<ListBox.ItemIndicator /></ListBox.Item>
          </ListBox.Section>
          <ListBox.Section>
            <Header>{t("meetings.filterKindsHeader")}</Header>
            {kinds.map(kind => {
              const name = kind.isActive ? kind.name : t("meetings.kindHidden").replace("{name}", kind.name);
              return <ListBox.Item id={kind.id} key={kind.id} textValue={name}>{name}<ListBox.ItemIndicator /></ListBox.Item>;
            })}
          </ListBox.Section>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Places meetings are held at, searched on the server; a place is chosen by its key (its text, trimmed, upper-case). */
function LocationFilter({ value, onChange, disabled, wide }: { value: string[]; onChange: (keys: string[]) => void; disabled?: boolean; wide: boolean }) {
  const { t } = useLocale();
  const client = useMeetingsClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<MeetingLocationDto[]>([]);
  const [failed, setFailed] = useState(false);
  // Names of places seen, to show the chosen ones while a search lists others.
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      client.locations(search.trim() || undefined, controller.signal).then(places => {
        setFound(places);
        setFailed(false);
        setNames(known => ({ ...known, ...Object.fromEntries(places.map(place => [place.key, place.name])) }));
      }, () => { if (!controller.signal.aborted) { setFound([]); setFailed(true); } });
    }, search ? DEBOUNCE_MS : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [client, open, search]);
  const nameOf = (key: string) => names[key] ?? key;
  // Without a search, chosen places the list does not include are listed first, so they can be taken off.
  const missing = search.trim() ? [] : value.filter(key => !found.some(place => place.key === key));
  const options = [...missing.map(key => ({ key, name: nameOf(key) })), ...found];
  return (
    <Autocomplete selectionMode="multiple" allowsEmptyCollection placeholder={t("meetings.allLocations")} value={value} isDisabled={disabled}
      className={wide ? "w-full" : "w-56 shrink-0"} onOpenChange={setOpen} onChange={keys => onChange((keys as Key[]).map(String))}>
      <Label className="sr-only">{t("meetings.filterLocations")}</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value className="min-w-0 flex-1 overflow-hidden">{({ defaultChildren }) => value.length ? <Chosen names={value.map(nameOf)} /> : defaultChildren}</Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter inputValue={search} onInputChange={setSearch}>
          <SearchField autoFocus aria-label={t("meetings.searchLocations")} variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={t("meetings.searchLocations")} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox className="max-h-72 overflow-y-auto" renderEmptyState={() => <EmptyState>{failed ? t("meetings.listFailed") : t("meetings.noLocations")}</EmptyState>}>
            {options.map(place => <ListBox.Item id={place.key} key={place.key} textValue={place.name}>{place.name}<ListBox.ItemIndicator /></ListBox.Item>)}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
