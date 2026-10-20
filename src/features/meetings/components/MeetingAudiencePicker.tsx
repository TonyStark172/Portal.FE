"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, Collection, ComboBox, Input, Label, ListBox, ListBoxLoadMoreItem, ListLayout, Skeleton, Tag, TagGroup, Virtualizer } from "@heroui/react";
import { Persons } from "@gravity-ui/icons";
import { useCurrentUser } from "@/features/auth";
import { Permissions } from "@/shared/auth/permissions";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { meetingProblem, useMeetingsClient } from "../meetingsClient";
import type { AudiencePerson, AudienceSelection, MeetingDepartment } from "../meetingTypes";
import { CloseEmptySuggestions } from "./CloseEmptySuggestions";
import { useParticipantProfiles } from "./useParticipantProfiles";
import { usePagedAudienceSuggestions } from "./usePagedAudienceSuggestions";
import { usePhone } from "@/shared/hooks/usePhone";

type Suggestion = { key: string; name: string; description: string; disabled?: boolean; person?: AudiencePerson; departmentId?: number };
const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
const PAGE_SIZE = 30;

/**
 * Who a meeting is for: "@" picks people (or everyone, for those allowed to broadcast), "/" a department. A department
 * stays a department (its members are not listed as tags); people it already covers are taken off as individuals.
 */
export function MeetingAudiencePicker({ selection, onChange, disabled, onBusyChange }: { selection: AudienceSelection; onChange: (value: AudienceSelection) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { t, locale } = useLocale();
  const client = useMeetingsClient();
  const { hasPermission } = useCurrentUser();
  const canBroadcast = hasPermission(Permissions.Meetings.Broadcast);
  // A phone's field is too narrow for the whole hint.
  const isPhone = usePhone();
  const [query, setQuery] = useState("");
  const [departments, setDepartments] = useState<MeetingDepartment[]>([]);
  const [departmentsLocale, setDepartmentsLocale] = useState(locale);
  const [departmentError, setDepartmentError] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [visibleCount, setVisibleCount] = useState(50);
  const lifetime = useRef<AbortController | null>(null);
  const groupRequest = useRef<AbortController | null>(null);
  const visibleIds = selection.allEmployees ? [] : selection.userIds.slice(0, visibleCount);
  const { profiles, failed, retry: retryProfiles, remember } = useParticipantProfiles(visibleIds);
  const selectionKey = JSON.stringify(selection);
  useEffect(() => () => groupRequest.current?.abort(), [selectionKey, disabled]);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    client.departments(undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setDepartments(result); setDepartmentsLocale(locale); setDepartmentError(false); } })
      .catch(() => { if (!controller.signal.aborted) setDepartmentError(true); });
    return () => controller.abort();
  }, [client, retry, locale]);

  // Check only candidate IDs against group membership. Do not expand groups into tags or freeze them here.
  const coveredIds = useCallback(async (ids: number[], groups: AudienceSelection, signal: AbortSignal) => {
    const covered = new Set<number>();
    for (let offset = 0; offset < ids.length; offset += 50) {
      const candidateIds = ids.slice(offset, offset + 50);
      const page = await client.preview({ selection: { ...groups, userIds: [], excludedUserIds: [] }, candidateIds, pageNumber: 1, pageSize: 50 }, signal);
      page.items.forEach(person => covered.add(person.userId));
    }
    return covered;
  }, [client]);

  const loadSuggestions = useCallback(async (pageNumber: number, signal: AbortSignal) => {
    const current: AudienceSelection = JSON.parse(selectionKey);
    const tagQuery = query.trimStart();
    const search = tagQuery.replace(/^[@/]/, "").trim();
    if (tagQuery.startsWith("/")) {
      const matches = await client.departments(search, signal);
      // The server answers again: also reload the list that names department tags, if it failed earlier.
      if (departmentError) setRetry(attempt => attempt + 1);
      return {
        hasMore: false,
        items: matches.map((department): Suggestion => ({
          key: `department:${department.id}`, name: department.name, description: t("meetings.departmentLabel"), departmentId: department.id,
          disabled: current.departmentIds.includes(department.id),
        })),
      };
    }
    const page = await client.people({ pageSize: PAGE_SIZE, pageNumber, search }, signal);
    const covered = current.departmentIds.length ? await coveredIds(page.items.map(p => p.userId), current, signal) : new Set<number>();
    const items = page.items.map((person): Suggestion => ({
      key: `user:${person.userId}`, name: person.fullName,
      description: [person.employeeCode, person.positionName].filter(Boolean).join(" · ") || t("meetings.staff"), person,
      disabled: current.userIds.includes(person.userId) || covered.has(person.userId) && !current.excludedUserIds.includes(person.userId),
    }));
    const everyone = [t("meetings.allEmployees"), t("meetings.everyoneWords"), "all"];
    if (canBroadcast && pageNumber === 1 && (!search || everyone.some(word => normalize(word).includes(normalize(search)))))
      items.unshift({ key: "all", name: t("meetings.allEmployees"), description: t("meetings.inviteAll") });
    return { items, hasMore: page.items.length > 0 && pageNumber * PAGE_SIZE < page.totalCount };
  }, [query, selectionKey, departmentError, client, coveredIds, canBroadcast, t]);
  const hasTagPrefix = /^[@/]/.test(query.trimStart());
  const describeFailure = useCallback((failure: unknown) =>
    failure instanceof Error ? failure.message : meetingProblem(failure).detail ?? t("meetings.listFailed"), [t]);
  const suggestions = usePagedAudienceSuggestions(hasTagPrefix && !selection.allEmployees && !disabled && !addingGroup, loadSuggestions, describeFailure);
  const options = hasTagPrefix ? suggestions.items : [];
  const loading = suggestions.loading;

  const clearQuery = () => { setQuery(""); setError(null); };
  const select = async (key: string) => {
    const option = options.find(item => item.key === key);
    if (!option || option.disabled || disabled || addingGroup || selection.allEmployees) return;
    if (key === "all") {
      onChange({ userIds: [], departmentIds: [], allEmployees: true, excludedUserIds: [] });
      clearQuery();
    } else if (option.person) {
      remember(option.person);
      const person = option.person.userId;
      onChange({ ...selection, userIds: [...new Set([...selection.userIds, person])], excludedUserIds: selection.excludedUserIds.filter(id => id !== person) });
      clearQuery();
    } else if (option.departmentId) {
      const controller = new AbortController();
      groupRequest.current = controller;
      clearQuery();
      setAddingGroup(true);
      onBusyChange?.(true);
      try {
        const next = { ...selection, departmentIds: [...new Set([...selection.departmentIds, option.departmentId])] };
        const covered = await coveredIds(selection.userIds, next, controller.signal);
        if (lifetime.current?.signal.aborted || controller.signal.aborted) return;
        onChange({ ...next, userIds: selection.userIds.filter(id => !covered.has(id) || selection.excludedUserIds.includes(id)) });
      } catch (e) {
        if (!lifetime.current?.signal.aborted && !controller.signal.aborted) setError(meetingProblem(e).detail ?? t("meetings.membersFailed"));
      } finally {
        if (!lifetime.current?.signal.aborted) { setAddingGroup(false); onBusyChange?.(false); }
      }
    }
  };
  const departmentName = (id: number) => (departmentsLocale === locale ? departments.find(d => d.id === id)?.name : null) ?? t("meetings.loadingDepartment");
  const personName = (id: number) => profiles[id]?.fullName;
  const tags = selection.allEmployees
    ? [{ key: "all", name: `@${t("meetings.allEmployees")}`, remove: t("meetings.remove").replace("{name}", t("meetings.allEmployees")) }]
    : [
      ...selection.departmentIds.map(id => ({ key: `department:${id}`, name: `/${departmentName(id)}`, remove: t("meetings.remove").replace("{name}", departmentName(id)) })),
      ...visibleIds.map(id => ({
        key: `user:${id}`,
        name: personName(id) ? `@${personName(id)}` : failed ? t("meetings.nameFailed") : t("meetings.loadingName"),
        remove: t("meetings.remove").replace("{name}", personName(id) ?? t("meetings.participants").toLowerCase()),
      })),
    ];
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-sm font-medium">{t("meetings.participants")}</p>
      <div className="rounded-xl border border-separator bg-surface p-2">
        {!!tags.length && (
          <TagGroup aria-label={t("meetings.selectedPeople")} className="mb-2 max-h-40 scrollbar overflow-y-auto" onRemove={keys => {
            if (disabled || addingGroup) return;
            if (keys.has("all")) { onChange({ userIds: [], departmentIds: [], allEmployees: false, excludedUserIds: [] }); return; }
            onChange({ ...selection, userIds: selection.userIds.filter(id => !keys.has(`user:${id}`)), departmentIds: selection.departmentIds.filter(id => !keys.has(`department:${id}`)) });
          }}>
            <TagGroup.List>
              {tags.map(tag => <Tag key={tag.key} id={tag.key} textValue={tag.name} isDisabled={disabled || addingGroup}><span className="max-w-64 truncate">{tag.name}</span><Tag.RemoveButton aria-label={tag.remove} /></Tag>)}
            </TagGroup.List>
          </TagGroup>
        )}
        {!selection.allEmployees && selection.userIds.length > visibleCount && (
          <Button size="sm" variant="ghost" isDisabled={disabled || addingGroup} onPress={() => setVisibleCount(n => n + 50)}>
            {t("meetings.showMoreSelected").replace("{count}", String(selection.userIds.length - visibleCount))}
          </Button>
        )}
        <ComboBox fullWidth aria-label={t("meetings.participants")} menuTrigger="input" isDisabled={disabled || addingGroup || selection.allEmployees} allowsEmptyCollection allowsCustomValue items={options} inputValue={query} selectedKey={null}
          disabledKeys={options.filter(item => item.disabled).map(item => item.key)} defaultFilter={() => true}
          onInputChange={text => { setQuery(text); setError(null); }}
          onKeyDown={event => { if (event.key === "Escape") clearQuery(); }} onSelectionChange={key => { if (key !== null) void select(String(key)); }}>
          <CloseEmptySuggestions query={hasTagPrefix ? query : ""} ready={options.length > 0} />
          <ComboBox.InputGroup>
            <Input spellCheck={false} placeholder={t(isPhone ? "meetings.audiencePlaceholderShort" : "meetings.audiencePlaceholder")} />
            <ComboBox.Trigger aria-label={t("meetings.findPeople")} onPress={() => { if (!query.trim()) setQuery("@"); }} />
          </ComboBox.InputGroup>
          {hasTagPrefix && (
            <ComboBox.Popover className="meeting-audience-popover overflow-hidden">
              <Virtualizer layout={ListLayout} layoutOptions={{ rowSize: 56, loaderSize: 112, padding: 6 }}>
                <ListBox key={query} className="meeting-audience-list" disabledKeys={options.filter(item => item.disabled).map(item => item.key)}
                  renderEmptyState={() => loading ? <AudienceSkeleton /> : (
                    <div className="p-3 text-sm text-muted">
                      {suggestions.error ?? t("meetings.noResults")}
                      {suggestions.error && <Button size="sm" variant="tertiary" onPress={suggestions.retry}>{t("meetings.retryLoad")}</Button>}
                    </div>
                  )}>
                  <Collection items={options}>
                    {item => (
                      <ListBox.Item id={item.key} textValue={item.name} className="h-full min-h-0 gap-2 data-[disabled=true]:opacity-45">
                        {item.person
                          ? <UserAvatar fullName={item.name} avatarUrl={item.person.avatarUrl} className="shrink-0" />
                          : <Avatar size="sm" className="shrink-0" aria-hidden="true"><Avatar.Fallback><Persons className="size-4" /></Avatar.Fallback></Avatar>}
                        <div className="min-w-0">
                          <Label className="block truncate">{item.name}</Label>
                          <span className="block truncate text-xs text-muted">{item.description}{item.disabled ? ` · ${t("meetings.alreadyIn")}` : ""}</span>
                        </div>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    )}
                  </Collection>
                  {suggestions.hasMore && (
                    <ListBoxLoadMoreItem className="h-full w-full" isLoading={loading || !!suggestions.error} scrollOffset={0.5} onLoadMore={suggestions.loadMore}>
                      {suggestions.error
                        ? <div role="alert" className="p-2 text-sm text-danger">{t("meetings.nextPageFailed")} <Button size="sm" variant="tertiary" onPress={suggestions.retry}>{t("meetings.retryLoad")}</Button></div>
                        : loading ? <AudienceSkeleton /> : null}
                    </ListBoxLoadMoreItem>
                  )}
                </ListBox>
              </Virtualizer>
            </ComboBox.Popover>
          )}
        </ComboBox>
      </div>
      {addingGroup && <p role="status" className="text-xs text-muted">{t("meetings.checkingMembers")}</p>}
      {error && (
        <div role="alert" className="text-sm text-danger">
          {error} <Button size="sm" variant="tertiary" isDisabled={disabled || addingGroup} onPress={() => { if (!query) setQuery("/"); setRetry(n => n + 1); }}>{t("common.retry")}</Button>
        </div>
      )}
      {failed && <Button size="sm" variant="tertiary" isDisabled={disabled} onPress={retryProfiles}>{t("meetings.reloadNames")}</Button>}
    </div>
  );
}

function AudienceSkeleton() {
  const { t } = useLocale();
  return (
    <div role="status" aria-label={t("meetings.loadingPeople")} className="space-y-3 p-2">
      <span className="sr-only">{t("meetings.loadingPeople")}</span>
      {[0, 1].map(index => (
        <div key={index} aria-hidden="true" className="flex items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/4 rounded" /><Skeleton className="h-2 w-1/2 rounded" /></div>
        </div>
      ))}
    </div>
  );
}
