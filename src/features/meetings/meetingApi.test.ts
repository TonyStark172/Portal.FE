import { afterEach, expect, test, vi } from "vitest";
import * as api from "./meetingApi";
import { mutationKey } from "./meetingApi";
afterEach(()=>vi.restoreAllMocks());
test("retry keeps the mutation id, but a changed draft receives a fresh id",()=>{
  const first=mutationKey(null,{title:"A",scope:"series",expectedVersion:2});
  expect(mutationKey(first,{title:"A",scope:"series",expectedVersion:2}).id).toBe(first.id);
  expect(mutationKey(first,{title:"B",scope:"series",expectedVersion:2}).id).not.toBe(first.id);
});
test("drag updates only one occurrence with versions and preserves audience",()=>{
  const request=api.occurrenceUpdate({id:"7",start:new Date("2030-01-07T09:15:00Z"),end:new Date("2030-01-07T10:00:00Z"),allDay:false,extendedProps:{version:4,seriesVersion:9,title:"A",kind:"Nội bộ",location:"503",participantIds:[1,2]}},"m");
  expect(request).toMatchObject({scope:"occurrence",expectedVersion:4,expectedSeriesVersion:9,details:{mutationId:"m",participantIds:null,audience:null,schedule:{recurrence:null,startUtc:"2030-01-07T02:15:00.000Z",endUtc:"2030-01-07T03:00:00.000Z"}}});
});
test("an ambiguous drag retry retains its complete mutation across token refresh",async()=>{
  const requests:{details:{mutationId:string};expectedVersion:number}[]=[];
  vi.spyOn(window,"fetch").mockImplementation(async(_url,init)=>{requests.push(JSON.parse(String(init?.body)));throw new TypeError("Failed to fetch");});
  const save=api.createOccurrenceSaver();
  const event={id:"7",start:new Date("2030-01-07T09:15:00Z"),end:new Date("2030-01-07T10:00:00Z"),allDay:false,extendedProps:{version:4,seriesVersion:9,title:"A",kind:"Nội bộ",location:"503"}};
  await expect(save(event,"old-token")).rejects.toThrow();
  await expect(save(event,"new-token")).rejects.toThrow();
  expect(requests[0]).toEqual(requests[1]);
  await expect(save({...event,end:new Date("2030-01-07T11:00:00Z")},"new-token")).rejects.toThrow();
  expect(requests[2].details.mutationId).not.toBe(requests[0].details.mutationId);
});
