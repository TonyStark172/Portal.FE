import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cài đặt | Portal" };

/** Placeholder until account settings get their screens. */
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold">Cài đặt</h1>
      <p className="text-muted">Chức năng đang được xây dựng.</p>
    </div>
  );
}
