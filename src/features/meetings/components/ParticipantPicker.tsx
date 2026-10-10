"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ComboBoxStateContext } from "react-aria-components/ComboBox";
import { Button, ComboBox, Input, Label, ListBox, Tag, TagGroup } from "@heroui/react";
import type { AudiencePerson, AudiencePage } from "../meetingTypes";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { meetingRequest } from "../calendarEvents";

export function CloseEmptySuggestions({ query, ready = false }: { query: string; ready?: boolean }) {
  const state = useContext(ComboBoxStateContext);
  useEffect(() => { if (!query) state?.close(); }, [query, state]);
  useEffect(() => {
    // Async results may arrive after scrolling the modal closed an empty popover.
    // Reopen only on a new result batch, and only while the input still has focus.
    if (query && ready && state?.isFocused) state.open(null, "manual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ready]);
  return null;
}

export function useParticipantProfiles(ids: number[], token: string | null) {
  const [profiles, setProfiles] = useState<Record<number, AudiencePerson>>({});
  const cache = useRef(profiles);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const key = ids.join(",");
  useEffect(() => {
    const controller = new AbortController();
    const missing = key.split(",").filter(Boolean).map(Number).filter((id) => !cache.current[id]);
    if (!missing.length) return;
    const batches = Array.from({length:Math.ceil(missing.length/50)}, (_,index) => missing.slice(index*50,index*50+50));
    Promise.allSettled(batches.map(ids => meetingRequest<AudiencePage>(`/api/Meetings/audience/users?Ids=${ids.join(",")}&PageSize=50`, token, { signal: controller.signal }))).then((results) => {
      if (controller.signal.aborted) return;
      const loaded = Object.fromEntries(results.flatMap((r) => r.status === "fulfilled" ? (r.value.items ?? []).map(p => [p.userId,p]) : []));
      cache.current = { ...cache.current, ...loaded };
      setProfiles(cache.current);
      setFailed(results.some((r) => r.status === "rejected") || missing.some(id=>!cache.current[id]));
    });
    return () => controller.abort();
  }, [key, token, retry]);
  return { profiles, failed, retry: () => setRetry((n) => n + 1), remember: (p: AudiencePerson) => {
    cache.current = { ...cache.current, [p.userId]: p }; setProfiles(cache.current);
  } };
}

export function ParticipantNames({ ids, token }: { ids: number[]; token: string | null }) {
  const visible = ids.slice(0,50);
  const { profiles, failed, retry } = useParticipantProfiles(visible, token);
  return <div className="flex flex-wrap items-center gap-2">{ids.length ? visible.map((id) => <span key={id}>{profiles[id] ? `@${profiles[id].fullName}` : failed ? "Không tải được tên" : "Đang tải tên…"}</span>) : "Chưa có người tham gia"}{ids.length > 50 && <span className="text-muted">và {ids.length-50} người khác</span>}{failed && <Button size="sm" variant="tertiary" onPress={retry}>Tải lại tên</Button>}</div>;
}

export function ParticipantPicker({ value, onChange, token, isDisabled }: { value: number[]; onChange: (ids: number[]) => void; token: string | null; isDisabled?: boolean; organizerId?: number }) {
  const { profiles, failed, retry, remember } = useParticipantProfiles(value, token);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AudiencePerson[]>([]);
  const [searchState, setSearchState] = useState("idle");
  const [searchRetry, setSearchRetry] = useState(0);
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchState("loading");
      try {
        const search = query.replace(/^@/, "").trim();
        const page = await meetingRequest<AudiencePage>(`/api/Meetings/audience/users?PageSize=8&Search=${encodeURIComponent(search)}`, token, { signal: controller.signal });
        if (!controller.signal.aborted) { setResults(page.items); setSearchState("ready"); }
      } catch { if (!controller.signal.aborted) { setResults([]); setSearchState("error"); } }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, token, searchRetry]);
  const selectedKey=value.join(",");
  const options = useMemo(()=>{
    const selected=new Set(selectedKey.split(",").map(Number));
    return results.filter(p=>!selected.has(p.userId));
  },[results,selectedKey]);
  return <div className="min-w-0 space-y-2">
    <ComboBox fullWidth menuTrigger="input" isDisabled={isDisabled} allowsEmptyCollection allowsCustomValue items={options} inputValue={query} selectedKey={null}
      onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }}
      onInputChange={(text) => { setQuery(text); setResults([]); setSearchState(text ? "loading" : "idle"); }}
      onSelectionChange={(key) => {
        const person = results.find((p) => p.userId === Number(key));
        if (person && !value.includes(person.userId)) { remember(person); onChange([...value, person.userId]); setQuery(""); setResults([]); }
      }}>
      <Label>Người tham gia</Label>
      <CloseEmptySuggestions query={query} />
      <ComboBox.InputGroup><Input spellCheck={false} placeholder="Gõ @ để tìm và chọn người" /><ComboBox.Trigger aria-label="Tìm người tham gia" onPress={() => { if (!query) setQuery("@"); }} /></ComboBox.InputGroup>
      <ComboBox.Popover className="max-h-64 overflow-y-auto"><ListBox items={options} renderEmptyState={() => <p className="p-3 text-sm text-muted">{searchState === "error" ? "Không tải được danh sách nhân sự" : searchState === "loading" ? "Đang tìm…" : "Không tìm thấy người phù hợp hoặc đã chọn"}</p>}>
        {(person) => <ListBox.Item id={person.userId} textValue={person.fullName} className="gap-2"><UserAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} /><div className="min-w-0"><Label>{person.fullName}</Label><span className="block truncate text-xs text-muted">{[person.employeeCode,person.positionName].filter(Boolean).join(" · ") || "Nhân sự"}</span></div><ListBox.ItemIndicator /></ListBox.Item>}
      </ListBox></ComboBox.Popover>
    </ComboBox>
    {!!value.length && <TagGroup aria-label="Người đã chọn" onRemove={(keys) => { if (!isDisabled) onChange(value.filter((id) => !keys.has(id))); }}><TagGroup.List>
      {value.map((id) => <Tag key={id} id={id} isDisabled={isDisabled} textValue={profiles[id]?.fullName ?? "Người tham gia"}><span className="max-w-full truncate">{profiles[id] ? `@${profiles[id].fullName}` : failed ? "Không tải được tên" : "Đang tải tên…"}</span><Tag.RemoveButton aria-label={`Bỏ ${profiles[id]?.fullName ?? "người tham gia"}`} /></Tag>)}
    </TagGroup.List></TagGroup>}
    {failed && <Button size="sm" variant="tertiary" isDisabled={isDisabled} onPress={retry}>Tải lại tên</Button>}
    {searchState === "error" && <Button size="sm" variant="tertiary" isDisabled={isDisabled} onPress={() => setSearchRetry((n) => n + 1)}>Thử lại tìm kiếm</Button>}
  </div>;
}
