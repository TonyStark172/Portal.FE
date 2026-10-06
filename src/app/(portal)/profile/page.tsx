import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hồ sơ | Portal" };

/** Placeholder until the profile feature (Portal.BE /api/Profiles/me) gets its screens. */
export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold">Hồ sơ của tôi</h1>
      <p className="text-muted">Chức năng đang được xây dựng.</p>
    </div>
  );
}
