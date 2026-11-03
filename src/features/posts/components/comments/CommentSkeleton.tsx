"use client";

import { Skeleton } from "@heroui/react";

/** Rows shaped like a comment (an avatar, the name and a line of text) while comments or replies load. */
export function CommentSkeleton({ count, label, className = "" }: { count: number; label: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={`flex flex-col gap-4 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-32 rounded-full" />
            <Skeleton className="h-3.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
