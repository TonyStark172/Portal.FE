"use client";

import { useMemo } from "react";
import { useAppDispatch } from "@/core/hooks";
import { portalApi } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { matchesVietnamese } from "@/shared/lib/vietnameseSearch";
import { EVERYONE, EVERYONE_LABEL } from "../editor/extensions";
import { createMentionSuggestion } from "../editor/mentionSuggestion";

/**
 * The "@" suggestion of a composer, asking the store for colleagues as the user types. Built once per `canMentionEveryone`:
 * only moderators may tag the whole company (Portal.BE drops the tag for anyone else).
 */
export function useColleagueMentions(canMentionEveryone: boolean) {
  const dispatch = useAppDispatch();
  const { t } = useLocale();

  return useMemo(
    () =>
      createMentionSuggestion(async (query) => {
        const page = await dispatch(
          portalApi.endpoints.getProfiles.initiate({ search: query || undefined, pageSize: 8 }, { subscribe: false }),
        ).unwrap();
        const colleagues = page.items.map((p) => ({
          id: String(p.userId),
          label: p.fullName,
          avatarUrl: p.avatarUrl,
          positionName: p.assignments.find((a) => a.isPrimary)?.positionName,
        }));
        const everyoneMatches = ["Mọi người", "everyone", "all", "tất cả"].some((name) => matchesVietnamese(name, query));
        return canMentionEveryone && everyoneMatches
          ? [{ id: EVERYONE, label: EVERYONE_LABEL, avatarUrl: null, positionName: t("posts.mention.everyone") }, ...colleagues]
          : colleagues;
      }),
    [dispatch, canMentionEveryone, t],
  );
}
