import { useLocale } from "@/shared/i18n/LocaleProvider";
import { formatBusinessTime } from "../businessTime";
import type { MeetingProblem } from "../meetingsClient";

/** Why a booking could not be saved, with the occurrences that clash. */
export function MeetingConflictList({ problem }: { problem: MeetingProblem }) {
  const { t, locale } = useLocale();
  const conflicts = problem.conflicts ?? [];
  const hidden = (problem.totalCount ?? 0) - conflicts.length;
  return (
    <div role="alert" className="space-y-2 rounded-xl border border-danger/25 bg-danger/5 p-3 text-sm text-danger">
      <p>{problem.detail}</p>
      {!!conflicts.length && (
        <ul className="space-y-1">
          {conflicts.map(conflict => (
            <li key={conflict.sequence}>
              {t("meetings.conflictLine")
                .replace("{number}", String(conflict.sequence + 1))
                .replace("{start}", formatBusinessTime(conflict.startUtc, locale))
                .replace("{end}", formatBusinessTime(conflict.endUtc, locale))
                .replace("{what}", [conflict.locationConflict && t("meetings.conflictRoom"), conflict.participantConflict && t("meetings.conflictPeople")]
                  .filter(Boolean).join(", "))}
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && <p>{t("meetings.conflictMore").replace("{count}", String(hidden))}</p>}
    </div>
  );
}
