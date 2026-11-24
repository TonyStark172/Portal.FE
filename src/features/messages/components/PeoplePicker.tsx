"use client";

import { useEffect, useState } from "react";
import { SearchField, Spinner } from "@heroui/react";
import { Check } from "@gravity-ui/icons";
import { useGetProfilesQuery } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";

const SEARCH_DELAY_MS = 250;

/** `value` once it has stopped changing for `delayMs`. */
export function useDebounced<T>(value: T, delayMs = SEARCH_DELAY_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

export type PickedPerson = { userId: number; fullName: string; avatarUrl?: string | null };

/**
 * Colleagues from the staff directory (active accounts), searched by name. A press picks one (`onPick`), or with
 * `selected` toggles them, shown with a tick. `exclude` leaves people out (oneself, those already in a group).
 */
export function PeoplePicker({ onPick, selected, exclude = [], disabled = false, autoFocus = true }: {
  onPick: (person: PickedPerson) => void;
  selected?: PickedPerson[];
  exclude?: number[];
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim());
  const { currentData, isFetching, isError } = useGetProfilesQuery({ search: term || undefined, pageSize: 30 });
  const people = (currentData?.items ?? []).filter((person) => !exclude.includes(person.userId));
  const isSelected = (userId: number) => selected?.some((person) => person.userId === userId) ?? false;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <SearchField autoFocus={autoFocus} aria-label={t("messages.searchPeople")} value={search} onChange={setSearch} variant="secondary" fullWidth>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t("messages.searchPeople")} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <div className="flex min-h-48 flex-col overflow-y-auto scrollbar" aria-busy={isFetching}>
        {isError && <p className="p-4 text-center text-sm text-muted">{t("messages.loadError")}</p>}
        {!isError && !isFetching && people.length === 0 && <p className="p-4 text-center text-sm text-muted">{t("messages.noPeople")}</p>}
        {isFetching && people.length === 0 && <Spinner size="sm" className="m-auto" />}
        <ul className="flex flex-col gap-0.5">
          {people.map((person) => (
            <li key={person.userId}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={selected ? isSelected(person.userId) : undefined}
                onClick={() => onPick({ userId: person.userId, fullName: person.fullName, avatarUrl: person.avatarUrl })}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
              >
                <UserAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{person.fullName}</span>
                  {person.userName && <span className="truncate text-xs text-muted">@{person.userName}</span>}
                </span>
                {selected && (
                  <span
                    aria-hidden
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      isSelected(person.userId) ? "border-accent bg-accent text-accent-foreground" : "border-border"
                    }`}
                  >
                    {isSelected(person.userId) && <Check className="size-3" />}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The people picked so far, as chips that remove them when pressed. */
export function PickedChips({ people, onRemove }: { people: PickedPerson[]; onRemove: (userId: number) => void }) {
  const { t } = useLocale();
  if (people.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {people.map((person) => (
        <li key={person.userId}>
          <button
            type="button"
            onClick={() => onRemove(person.userId)}
            aria-label={t("messages.unpick").replace("{name}", person.fullName)}
            className="flex items-center gap-1.5 rounded-full bg-default py-0.5 ps-0.5 pe-2.5 text-xs outline-none hover:bg-default-hover focus-visible:ring-2 focus-visible:ring-focus"
          >
            <UserAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} size="sm" className="size-5" />
            {person.fullName}
            <span aria-hidden>×</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Adds or removes a person from a selection. */
export const togglePerson = (people: PickedPerson[], person: PickedPerson) =>
  people.some((p) => p.userId === person.userId) ? people.filter((p) => p.userId !== person.userId) : [...people, person];
