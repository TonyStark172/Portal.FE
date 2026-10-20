"use client";
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, TrashBin } from "@gravity-ui/icons";
import { Button, Input, TextField, Tooltip } from "@heroui/react";
// Straight from its module, not the meetings feature's index: that one brings the whole calendar along.
import { meetingProblem, useMeetingsClient } from "@/features/meetings/meetingsClient";
import type { MeetingKindDto } from "@/shared/api/generated/portalApi";
import { toFieldErrors } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";

type Names = { name: string; englishName: string };
/** What a row, or the new-kind form ("new"), is told when a write is refused. */
type Errors = Record<string, string>;

/**
 * The kinds of meeting: their Vietnamese and English names, their order in pickers, whether new meetings can pick
 * them (hidden ones stay on the meetings that have them), and deletion of the ones no meeting uses. A name is saved
 * when the row is left or Enter is pressed.
 */
export function MeetingKindsEditor() {
  const { t } = useLocale();
  const client = useMeetingsClient();
  const title = useId();
  const [kinds, setKinds] = useState<MeetingKindDto[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Names being edited, by kind id, until they are saved.
  const [drafts, setDrafts] = useState<Record<number, Names>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [added, setAdded] = useState<Names>({ name: "", englishName: "" });

  const reload = useCallback((signal?: AbortSignal) => client.kinds(true, signal).then(
    list => { setKinds(list); setLoadFailed(false); },
    () => { if (!signal?.aborted) setLoadFailed(true); }), [client]);
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  const setError = (key: string, message: string | null) => setErrors(current => {
    const next = { ...current };
    if (message) next[key] = message; else delete next[key];
    return next;
  });
  /** Runs a write; a refusal is shown at `key`. The list is read again either way (the server's order and flags). */
  const write = async (key: string, action: () => Promise<unknown>) => {
    setError(key, null);
    try {
      await action();
      return true;
    } catch (failure) {
      const problem = meetingProblem(failure);
      // The first message the server gives for any field (name taken, the last active kind...), else the problem's own.
      setError(key, Object.values(toFieldErrors(problem))[0]?.[0]
        ?? (problem.code === "meetingKindInUse" ? t("settings.meetings.inUse") : problem.detail ?? t("common.genericError")));
      return false;
    } finally {
      void reload();
    }
  };
  /** Forgets the names being edited (only those given, when names typed since then must stay). */
  const clearDraft = (id: number, only?: Names) => setDrafts(current => {
    if (only && current[id] !== only) return current;
    const next = { ...current };
    delete next[id];
    return next;
  });
  // Rows whose names are being saved: leaving the row after Enter must not send them twice.
  const renaming = useRef(new Set<number>());

  const rename = async (kind: MeetingKindDto) => {
    const draft = drafts[kind.id];
    if (!draft) return;
    const name = draft.name.trim(), englishName = draft.englishName.trim();
    if (name === kind.originalName && englishName === (kind.englishName ?? "")) { clearDraft(kind.id); setError(String(kind.id), null); return; }
    if (!name) { setError(String(kind.id), t("settings.meetings.nameRequired")); return; }
    if (renaming.current.has(kind.id)) return;
    renaming.current.add(kind.id);
    try {
      if (await write(String(kind.id), () => client.updateKind(kind.id, { name, englishName: englishName || null, isActive: kind.isActive })))
        clearDraft(kind.id, draft);
    } finally {
      renaming.current.delete(kind.id);
    }
  };
  const toggle = (kind: MeetingKindDto) =>
    write(String(kind.id), () => client.updateKind(kind.id, { name: kind.originalName, englishName: kind.englishName, isActive: !kind.isActive }));
  const move = (index: number, by: -1 | 1) => {
    const next = [...kinds!];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setKinds(next);
    void write(String(next[index + by].id), () => client.reorderKinds(next.map(k => k.id)));
  };
  const remove = async (kind: MeetingKindDto) => {
    if (await write(String(kind.id), () => client.deleteKind(kind.id))) clearDraft(kind.id);
  };
  const add = async (event: FormEvent) => {
    event.preventDefault();
    const name = added.name.trim(), englishName = added.englishName.trim();
    if (!name) { setError("new", t("settings.meetings.nameRequired")); return; }
    if (await write("new", () => client.createKind({ name, englishName: englishName || null }))) setAdded({ name: "", englishName: "" });
  };

  return (
    <section aria-labelledby={title} className="flex flex-col gap-4 rounded-2xl border border-separator bg-surface p-5">
      <div>
        <h2 id={title} className="text-lg font-semibold">{t("settings.meetings.kinds")}</h2>
        <p className="text-sm text-muted">{t("settings.meetings.kindsHint")}</p>
      </div>
      {!kinds ? (
        loadFailed
          ? <p role="alert" className="text-sm text-danger">{t("settings.meetings.kindsLoadFailed")}</p>
          : <p className="text-sm text-muted">{t("settings.meetings.loading")}</p>
      ) : kinds.length === 0 ? (
        <p className="text-sm text-muted">{t("settings.meetings.noKinds")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {kinds.map((kind, index) => (
            <KindRow key={kind.id} kind={kind} error={errors[kind.id]} isFirst={index === 0} isLast={index === kinds.length - 1}
              names={drafts[kind.id] ?? { name: kind.originalName, englishName: kind.englishName ?? "" }}
              onNames={names => setDrafts(current => ({ ...current, [kind.id]: names }))}
              onCommit={() => void rename(kind)} onToggle={() => void toggle(kind)}
              onMove={by => move(index, by)} onDelete={() => void remove(kind)} />
          ))}
        </ul>
      )}
      <form aria-label={t("settings.meetings.addKind")} onSubmit={add} className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <NameFields names={added} onNames={setAdded} />
          <Button type="submit" variant="secondary">{t("settings.meetings.addKind")}</Button>
        </div>
        {errors.new && <p role="alert" className="text-sm text-danger">{errors.new}</p>}
      </form>
    </section>
  );
}

function NameFields({ names, onNames, onEnter }: { names: Names; onNames: (names: Names) => void; onEnter?: () => void }) {
  const { t } = useLocale();
  const onKeyDown = onEnter && ((event: KeyboardEvent) => { if (event.key === "Enter") onEnter(); });
  return (
    <>
      <TextField aria-label={t("settings.meetings.kindName")} value={names.name} onChange={name => onNames({ ...names, name })} className="min-w-40 flex-1">
        <Input placeholder={t("settings.meetings.kindName")} onKeyDown={onKeyDown} />
      </TextField>
      <TextField aria-label={t("settings.meetings.kindEnglishName")} value={names.englishName} onChange={englishName => onNames({ ...names, englishName })} className="min-w-40 flex-1">
        <Input placeholder={t("settings.meetings.kindEnglishName")} onKeyDown={onKeyDown} />
      </TextField>
    </>
  );
}

type KindRowProps = {
  kind: MeetingKindDto; names: Names; error?: string; isFirst: boolean; isLast: boolean;
  onNames: (names: Names) => void; onCommit: () => void; onToggle: () => void; onMove: (by: -1 | 1) => void; onDelete: () => void;
};

function KindRow({ kind, names, error, isFirst, isLast, onNames, onCommit, onToggle, onMove, onDelete }: KindRowProps) {
  const { t } = useLocale();
  // The names are saved once focus leaves the row, not when it moves from one name to the other.
  const onBlur = (event: FocusEvent<HTMLLIElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) onCommit(); };
  return (
    <li aria-label={kind.originalName} onBlur={onBlur}
      className={`flex flex-col gap-1 rounded-xl border border-separator p-3 ${kind.isActive ? "" : "bg-surface-secondary"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <NameFields names={names} onNames={onNames} onEnter={onCommit} />
        {!kind.isActive && <span className="rounded-full bg-default px-2 py-0.5 text-xs text-muted">{t("settings.meetings.hidden")}</span>}
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onPress={onToggle}>{kind.isActive ? t("settings.meetings.hide") : t("settings.meetings.show")}</Button>
          <Button isIconOnly size="sm" variant="ghost" aria-label={t("settings.meetings.moveUp")} isDisabled={isFirst} onPress={() => onMove(-1)}>
            <ArrowUp className="size-4" />
          </Button>
          <Button isIconOnly size="sm" variant="ghost" aria-label={t("settings.meetings.moveDown")} isDisabled={isLast} onPress={() => onMove(1)}>
            <ArrowDown className="size-4" />
          </Button>
          {kind.isUsed ? (
            // Disabled through aria-disabled, not `disabled`, and still taking the pointer: hovered or focused, it says why.
            <Tooltip delay={300}>
              <Button isIconOnly size="sm" variant="ghost" aria-label={t("settings.meetings.delete")} aria-disabled="true"
                className="pointer-events-auto data-[pressed=true]:transform-none">
                <TrashBin className="size-4" />
              </Button>
              <Tooltip.Content>{t("settings.meetings.inUse")}</Tooltip.Content>
            </Tooltip>
          ) : (
            <Button isIconOnly size="sm" variant="ghost" aria-label={t("settings.meetings.delete")} onPress={onDelete}>
              <TrashBin className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </li>
  );
}
