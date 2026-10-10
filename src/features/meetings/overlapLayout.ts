export type OverlapInterval = {id:string;start:number;end:number};
export type OverlapPosition = {left:number;width:number;layer:number};
export function overlapLayout(events: OverlapInterval[]): Map<string, OverlapPosition> {
  const result = new Map<string, OverlapPosition>();
  const sorted = [...events].filter(event=>event.end>event.start).sort((a,b)=>a.start-b.start || b.end-a.end || a.id.localeCompare(b.id,undefined,{numeric:true}));
  let group: OverlapInterval[] = [];
  let groupEnd = -Infinity;
  const place = () => {
    const step = group.length > 1 ? Math.min(18,60/(group.length-1)) : 0;
    const width = 100-step*(group.length-1);
    group.forEach((event,index)=>result.set(event.id,{left:index*step,width,layer:index+1}));
  };
  for (const event of sorted) {
    if (event.start >= groupEnd) { place(); group=[]; groupEnd=-Infinity; }
    group.push(event);
    groupEnd=Math.max(groupEnd,event.end);
  }
  place();
  return result;
}
