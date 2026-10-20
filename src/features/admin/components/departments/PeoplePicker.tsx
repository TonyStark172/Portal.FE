"use client";

import { useEffect, useState } from "react";
import { Check, Xmark } from "@gravity-ui/icons";
import { Chip, Description, Label, SearchField, Spinner } from "@heroui/react";
import { useGetUsersQuery } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";

/** A chosen person as the caller can show them (a name for a chip or a preview). */
export type ChosenPerson = { id: number; fullName: string };

type Props = {
  /** What the field is for ("Nhân viên", "Trưởng phòng"…), shown above the chips. */
  label: string;
  /** The ids of the people chosen. */
  value: number[];
  /** The new ids, and who they are (in the same order; "#id" is the name of one the picker never saw). */
  onChange: (ids: number[], people: ChosenPerson[]) => void;
  /** People already in `value` whose names the caller knows (loaded elsewhere), so their chips read as names, not "#id". */
  knownPeople?: ChosenPerson[];
  /** People who cannot be chosen (already in the place they would be added to); they are listed but disabled. */
  disabledIds?: number[];
  /** A line of help under the field. */
  hint?: string;
};

/** How many matches one search lists; typing narrows them, so there is no paging. */
const PAGE_SIZE = 20;

/** A person as the picker remembers them once chosen (the search results change while typing, the chips must not). */
type Chosen = { fullName: string; userName?: string | null };

/**
 * Chooses several ACTIVE people: the chosen ones as removable chips, a search box (the users list is asked 250 ms after
 * typing pauses, 20 matches) and the matches below it as toggle buttons. Used by the dialogs that add people to a
 * department and by the department wizard (heads, deputies, members). The picker is controlled by ids; it keeps the
 * names of the people it saw chosen so the chips stay readable when a later search no longer lists them (an id given
 * in `value` that it never saw is shown as "#id"). Enter in the search never submits a surrounding form. It reads `GET /api/Users`, so it needs whatever right that
 * endpoint asks (Users.View); without it the list says it could not load.
 */
export function PeoplePicker({ label, value, onChange, knownPeople = [], disabledIds = [], hint }: Props) {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [chosen, setChosen] = useState<Record<number, Chosen>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const users = useGetUsersQuery({ search: debounced || undefined, isActive: true, pageNumber: 1, pageSize: PAGE_SIZE });
  const selected = new Set(value);
  const disabled = new Set(disabledIds);

  const nameOf = (id: number, extra?: Record<number, Chosen>) =>
    extra?.[id]?.fullName ?? chosen[id]?.fullName ?? knownPeople.find((person) => person.id === id)?.fullName ?? `#${id}`;
  const peopleOf = (ids: number[], extra?: Record<number, Chosen>): ChosenPerson[] =>
    ids.map((id) => ({ id, fullName: nameOf(id, extra) }));

  function remove(id: number) {
    const ids = value.filter((other) => other !== id);
    onChange(ids, peopleOf(ids));
  }

  function toggle(id: number, person: Chosen) {
    if (selected.has(id)) {
      remove(id);
    } else {
      setChosen((known) => ({ ...known, [id]: person }));
      onChange([...value, id], peopleOf([...value, id], { [id]: person }));
    }
  }

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <Label>{label}</Label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const name = nameOf(id);
            return (
              <li key={id}>
                <Chip size="sm" variant="soft">
                  {name}
                  <button
                    type="button"
                    aria-label={t("people.remove").replace("{name}", name)}
                    onClick={() => remove(id)}
                    className="-mr-1 ml-1 rounded-full p-0.5 outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <Xmark className="size-3" />
                  </button>
                </Chip>
              </li>
            );
          })}
        </ul>
      )}

      <SearchField aria-label={t("people.search")} value={search} onChange={setSearch} variant="secondary" fullWidth>
        <SearchField.Group>
          <SearchField.SearchIcon />
          {/* Enter only searches (the search is live): the browser's implicit submit must not send the surrounding form. */}
          <SearchField.Input
            placeholder={t("people.search")}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <div className="max-h-56 scrollbar overflow-y-auto rounded-xl border border-border">
        {users.isLoading ? (
          <div className="flex justify-center p-4">
            <Spinner size="sm" aria-label={t("admin.opening")} />
          </div>
        ) : users.isError || !users.data ? (
          <p role="alert" className="p-3 text-sm text-danger">{t("people.loadError")}</p>
        ) : users.data.items.length === 0 ? (
          <p className="p-3 text-sm text-muted">{t("people.none")}</p>
        ) : (
          <ul>
            {users.data.items.map((user) => {
              const isChosen = selected.has(user.id);
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    aria-pressed={isChosen}
                    disabled={disabled.has(user.id)}
                    onClick={() => toggle(user.id, { fullName: user.fullName, userName: user.userName })}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UserAvatar fullName={user.fullName} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{user.fullName}</span>
                    {user.userName && <span className="shrink-0 text-xs text-muted">{user.userName}</span>}
                    {isChosen && <Check aria-hidden className="size-4 shrink-0 text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {hint && <Description>{hint}</Description>}
    </div>
  );
}
