"use client";

import { Suspense } from "react";
import { MessagesPage } from "@/features/messages";

export default function Messages() {
  // The open conversation is kept in the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <MessagesPage />
    </Suspense>
  );
}
