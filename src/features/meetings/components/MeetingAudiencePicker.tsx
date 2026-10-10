"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, Collection, ComboBox, Input, Label, ListBox, ListBoxLoadMoreItem, ListLayout, Skeleton, Tag, TagGroup, Virtualizer } from "@heroui/react";
import { Persons } from "@gravity-ui/icons";
import type { AudiencePage, AudiencePerson, AudienceSelection } from "../meetingTypes";
import { meetingRequest } from "../calendarEvents";
import { CloseEmptySuggestions, useParticipantProfiles } from "./ParticipantPicker";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { usePagedAudienceSuggestions } from "./usePagedAudienceSuggestions";

type Department = { id: number; name: string };
type Suggestion = { key: string; name: string; description: string; disabled?: boolean; person?: AudiencePerson; departmentId?: number };
const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

export function MeetingAudiencePicker({ snapshotIds, selection, organizerId, onChange, onSnapshotChange, token, disabled, onBusyChange }: { snapshotIds: number[]; selection: AudienceSelection | null; organizerId?: number; onChange: (value: AudienceSelection | null) => void; onSnapshotChange: (ids: number[]) => void; token: string | null; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const source = selection ?? { userIds: snapshotIds, departmentIds: [], allEmployees: false, excludedUserIds: [] };
  const [query, setQuery] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentError, setDepartmentError] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [visibleCount, setVisibleCount] = useState(50);
  const lifetime = useRef<AbortController | null>(null);
  const groupRequest = useRef<AbortController | null>(null);
  const visibleIds = source.allEmployees ? [] : source.userIds.slice(0, visibleCount);
  const { profiles, failed, retry: retryProfiles, remember } = useParticipantProfiles(visibleIds, token);
  const sourceKey = JSON.stringify(source);
  useEffect(() => () => groupRequest.current?.abort(), [sourceKey, token, disabled, organizerId]);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    meetingRequest<Department[]>("/api/Meetings/audience/departments", token, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setDepartments(Array.isArray(result) ? result : []); setDepartmentError(false); } })
      .catch(() => { if (!controller.signal.aborted) setDepartmentError(true); });
    return () => controller.abort();
  }, [token, retry]);

  // Check only candidate IDs against group membership. Do not expand groups into tags or freeze them here.
  const coveredIds = useCallback(async (ids: number[], groups: AudienceSelection, signal: AbortSignal) => {
    const covered = new Set<number>();
    for (let offset = 0; offset < ids.length; offset += 50) {
      const candidateIds = ids.slice(offset, offset + 50);
      const page = await meetingRequest<AudiencePage>("/api/Meetings/audience/preview", token, {
        method: "POST", signal, body: JSON.stringify({ selection: { ...groups, userIds: [], excludedUserIds: [] }, candidateIds, pageSize: 50 }),
      });
      if (page.totalCount > candidateIds.length || page.items.some(person => !candidateIds.includes(person.userId)))
        throw new Error("Backend chưa hỗ trợ kiểm tra thành viên. Vui lòng cập nhật backend.");
      page.items.forEach(person => covered.add(person.userId));
    }
    return covered;
  }, [token]);

  const loadSuggestions = useCallback(async (pageNumber: number, signal: AbortSignal) => {
    const current: AudienceSelection = JSON.parse(sourceKey);
        const tagQuery = query.trimStart();
        const search = tagQuery.replace(/^[@/]/, "").trim();
        let next: Suggestion[];
        let hasMore = false;
        if (tagQuery.startsWith("/")) {
          if (departmentError) throw new Error("Không tải được phòng ban.");
          next = departments.filter(department => normalize(department.name).includes(normalize(search))).map(department => ({
            key: `department:${department.id}`, name: department.name, description: "Phòng ban", departmentId: department.id,
            disabled: current.departmentIds.includes(department.id),
          }));
        } else {
          const page = await meetingRequest<AudiencePage>(`/api/Meetings/audience/users?PageSize=30&PageNumber=${pageNumber}&Search=${encodeURIComponent(search)}`, token, { signal });
          const covered = current.departmentIds.length ? await coveredIds(page.items.map(p => p.userId), current, signal) : new Set<number>();
          hasMore = page.items.length > 0 && pageNumber * 30 < page.totalCount;
          next = page.items.map(person => ({ key: `user:${person.userId}`, name: person.fullName,
            description: [person.employeeCode, person.positionName].filter(Boolean).join(" · ") || "Nhân sự", person,
            disabled: current.userIds.includes(person.userId) || covered.has(person.userId) && !current.excludedUserIds.includes(person.userId),
          }));
          if (pageNumber === 1 && (!search || normalize("Tất cả nhân viên").includes(normalize(search)) || normalize("mọi người").includes(normalize(search)) || "all".includes(normalize(search))))
            next.unshift({ key: "all", name: "Tất cả nhân viên", description: "Mời toàn bộ nhân viên" });
        }
        return { items: next, hasMore };
  }, [query, sourceKey, departments, departmentError, token, organizerId, coveredIds]);
  const hasTagPrefix = /^[@/]/.test(query.trimStart());
  const suggestions = usePagedAudienceSuggestions(hasTagPrefix && !source.allEmployees && !disabled && !addingGroup, loadSuggestions);
  const options = hasTagPrefix ? suggestions.items : [];
  const loading = suggestions.loading;

  const clearQuery = () => { setQuery(""); setError(null); };
  const select = async (key: string) => {
    const option = options.find(item => item.key === key);
    if (!option || option.disabled || disabled || addingGroup || source.allEmployees) return;
    if (key === "all") {
      onChange({ userIds: [], departmentIds: [], allEmployees: true, excludedUserIds: [] });
      clearQuery();
    } else if (option.person) {
      remember(option.person);
      const userIds = [...new Set([...source.userIds, option.person.userId])];
      if (selection) onChange({ ...source, userIds, excludedUserIds: source.excludedUserIds.filter(id => id !== option.person!.userId) });
      else onSnapshotChange(userIds);
      clearQuery();
    } else if (option.departmentId) {
      const controller = new AbortController();
      groupRequest.current = controller;
      clearQuery();
      setAddingGroup(true);
      onBusyChange?.(true);
      try {
        const next = { ...source, departmentIds: [...new Set([...source.departmentIds, option.departmentId])] };
        const covered = await coveredIds(source.userIds, next, controller.signal);
        if (lifetime.current?.signal.aborted || controller.signal.aborted) return;
        onChange({ ...next, userIds: source.userIds.filter(id => !covered.has(id) || source.excludedUserIds.includes(id)) });
        clearQuery();
      } catch (e) { if (!lifetime.current?.signal.aborted && !controller.signal.aborted) setError(e instanceof Error ? e.message : "Không kiểm tra được phòng ban."); }
      finally { if (!lifetime.current?.signal.aborted) { setAddingGroup(false); onBusyChange?.(false); } }
    }
  };
  const tags = source.allEmployees ? [{ key: "all", name: "@Tất cả nhân viên", remove: "Bỏ tất cả nhân viên" }] : [
    ...source.departmentIds.map(id => ({ key: `department:${id}`, name: `/${departments.find(d => d.id === id)?.name ?? "Đang tải phòng ban…"}`, remove: `Bỏ phòng ban ${departments.find(d => d.id === id)?.name ?? id}` })),
    ...visibleIds.map(id => ({ key: `user:${id}`, name: profiles[id] ? `@${profiles[id].fullName}` : failed ? "Không tải được tên" : "Đang tải tên…", remove: `Bỏ ${profiles[id]?.fullName ?? "người tham gia"}` })),
  ];
  return <div className="min-w-0 space-y-2">
    <p className="text-sm font-medium">Người tham gia</p>
      <div className="rounded-xl border border-separator bg-surface p-2">
        {!!tags.length && <TagGroup aria-label="Người đã chọn" className="mb-2 max-h-40 overflow-y-auto" onRemove={keys => {
          if (disabled || addingGroup) return;
          if (keys.has("all")) { onChange({ userIds: [], departmentIds: [], allEmployees: false, excludedUserIds: [] }); return; }
          const userIds = source.userIds.filter(id => !keys.has(`user:${id}`));
          if (selection) onChange({ ...source, userIds, departmentIds: source.departmentIds.filter(id => !keys.has(`department:${id}`)) });
          else onSnapshotChange(userIds);
        }}><TagGroup.List>{tags.map(tag => <Tag key={tag.key} id={tag.key} textValue={tag.name} isDisabled={disabled || addingGroup}><span className="max-w-64 truncate">{tag.name}</span><Tag.RemoveButton aria-label={tag.remove} /></Tag>)}</TagGroup.List></TagGroup>}
        {!source.allEmployees && source.userIds.length > visibleCount && <Button size="sm" variant="ghost" isDisabled={disabled || addingGroup} onPress={() => setVisibleCount(n => n + 50)}>Hiện thêm người đã chọn ({source.userIds.length - visibleCount})</Button>}
        <ComboBox fullWidth aria-label="Người tham gia" menuTrigger="input" isDisabled={disabled || addingGroup || source.allEmployees} allowsEmptyCollection allowsCustomValue items={options} inputValue={query} selectedKey={null}
          disabledKeys={options.filter(item => item.disabled).map(item => item.key)} defaultFilter={() => true}
          onInputChange={text => { setQuery(text); setError(null); }}
          onKeyDown={event => { if (event.key === "Escape") clearQuery(); }} onSelectionChange={key => { if (key !== null) void select(String(key)); }}>
          <CloseEmptySuggestions query={hasTagPrefix ? query : ""} ready={options.length>0} />
        <ComboBox.InputGroup><Input spellCheck={false} placeholder="@ người hoặc tất cả · / phòng ban" /><ComboBox.Trigger aria-label="Tìm người tham gia" onPress={() => { if (!query.trim()) setQuery("@"); }} /></ComboBox.InputGroup>
      {hasTagPrefix && <ComboBox.Popover className="meeting-audience-popover overflow-hidden">
        <Virtualizer layout={ListLayout} layoutOptions={{ rowSize: 56, loaderSize: 112, padding: 6 }}>
          <ListBox key={query} className="meeting-audience-list" disabledKeys={options.filter(item => item.disabled).map(item => item.key)} renderEmptyState={() => loading ? <AudienceSkeleton /> : <div className="p-3 text-sm text-muted">{suggestions.error ?? "Không tìm thấy kết quả"}{suggestions.error && <Button size="sm" variant="tertiary" onPress={suggestions.retry}>Thử tải lại</Button>}</div>}>
            <Collection items={options}>{item => <ListBox.Item id={item.key} textValue={item.name} className="h-full min-h-0 gap-2 data-[disabled=true]:opacity-45">{item.person ? <UserAvatar fullName={item.name} avatarUrl={item.person.avatarUrl} className="shrink-0" /> : <Avatar size="sm" className="shrink-0" aria-hidden="true"><Avatar.Fallback><Persons className="size-4" /></Avatar.Fallback></Avatar>}<div className="min-w-0"><Label className="block truncate">{item.name}</Label><span className="block truncate text-xs text-muted">{item.description}{item.disabled ? " · Đã tham gia" : ""}</span></div><ListBox.ItemIndicator /></ListBox.Item>}</Collection>
            {suggestions.hasMore && <ListBoxLoadMoreItem className="h-full w-full" isLoading={loading || !!suggestions.error} scrollOffset={0.5} onLoadMore={suggestions.loadMore}>{suggestions.error ? <div role="alert" className="p-2 text-sm text-danger">Không tải được trang tiếp. <Button size="sm" variant="tertiary" onPress={suggestions.retry}>Thử tải lại</Button></div> : loading ? <AudienceSkeleton /> : null}</ListBoxLoadMoreItem>}
          </ListBox>
        </Virtualizer>
      </ComboBox.Popover>}
    </ComboBox>
      </div>
    {addingGroup && <p role="status" className="text-xs text-muted">Đang kiểm tra thành viên…</p>}
    {error && <div role="alert" className="text-sm text-danger">{error} <Button size="sm" variant="tertiary" isDisabled={disabled || addingGroup} onPress={() => { if(!query)setQuery("/"); setRetry(n => n + 1); }}>Thử lại</Button></div>}
    {failed && <Button size="sm" variant="tertiary" isDisabled={disabled} onPress={retryProfiles}>Tải lại tên</Button>}
  </div>;
}

function AudienceSkeleton() {
  return <div role="status" aria-label="Đang tải nhân viên" className="space-y-3 p-2"><span className="sr-only">Đang tải nhân viên</span>{[0, 1].map(index => <div key={index} aria-hidden="true" className="flex items-center gap-2"><Skeleton className="size-8 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/4 rounded" /><Skeleton className="h-2 w-1/2 rounded" /></div></div>)}</div>;
}
