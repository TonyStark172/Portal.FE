"use client";

import { useEffect, useState } from "react";
import { Autocomplete, EmptyState, Label, ListBox, SearchField, Tag, TagGroup, type Key } from "@heroui/react";
import { useMeetingsClient } from "@/features/meetings/meetingsClient";
import type { MeetingDepartment } from "@/features/meetings/meetingTypes";
import { useLocale } from "@/shared/i18n/LocaleProvider";

const DEBOUNCE_MS = 300;

/**
 * The departments an event is for: searched on the server (the list a meeting's audience picks departments from),
 * several at once; the chosen ones are tags below, each removable. `known` names the departments already chosen.
 */
export function EventDepartmentPicker({ value, known, onChange, disabled, invalid }: {
  value: number[];
  known: { id: number; name: string }[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const { t } = useLocale();
  const client = useMeetingsClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<MeetingDepartment[]>([]);
  const [failed, setFailed] = useState(false);
  const [names, setNames] = useState<Record<number, string>>(() => Object.fromEntries(known.map(department => [department.id, department.name])));
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      client.departments(search.trim() || undefined, controller.signal).then(list => {
        setFound(list);
        setFailed(false);
        setNames(seen => ({ ...seen, ...Object.fromEntries(list.map(department => [department.id, department.name])) }));
      }, () => { if (!controller.signal.aborted) { setFound([]); setFailed(true); } });
    }, search ? DEBOUNCE_MS : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [client, open, search]);
  const nameOf = (id: number) => names[id] ?? t("meetings.loadingDepartment");
  // Without a search, chosen departments the list leaves out come first, so they can be taken off.
  const missing = search.trim() ? [] : value.filter(id => !found.some(department => department.id === id));
  const options = [...missing.map(id => ({ id, name: nameOf(id) })), ...found];
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Autocomplete selectionMode="multiple" allowsEmptyCollection placeholder={t("events.pickDepartments")} value={value} isDisabled={disabled} isInvalid={invalid}
        className="w-full" onOpenChange={setOpen} onChange={keys => onChange((keys as Key[]).map(Number))}>
        <Label className="sr-only">{t("events.departments")}</Label>
        <Autocomplete.Trigger>
          <Autocomplete.Value className="min-w-0 flex-1 overflow-hidden">{() => <span className="text-muted">{t("events.pickDepartments")}</span>}</Autocomplete.Value>
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter inputValue={search} onInputChange={setSearch}>
            <SearchField autoFocus aria-label={t("events.searchDepartments")} variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={t("events.searchDepartments")} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox className="max-h-72 overflow-y-auto" renderEmptyState={() => <EmptyState>{failed ? t("meetings.listFailed") : t("events.noDepartments")}</EmptyState>}>
              {options.map(department => <ListBox.Item id={department.id} key={department.id} textValue={department.name}>{department.name}<ListBox.ItemIndicator /></ListBox.Item>)}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
      {value.length > 0 && (
        <TagGroup aria-label={t("events.departments")} onRemove={keys => { if (!disabled) onChange(value.filter(id => !keys.has(id))); }}>
          <TagGroup.List>
            {value.map(id => (
              <Tag key={id} id={id} textValue={nameOf(id)} isDisabled={disabled}>
                <span className="max-w-64 truncate">{nameOf(id)}</span>
                <Tag.RemoveButton aria-label={t("meetings.remove").replace("{name}", nameOf(id))} />
              </Tag>
            ))}
          </TagGroup.List>
        </TagGroup>
      )}
    </div>
  );
}
