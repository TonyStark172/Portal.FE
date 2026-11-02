import { BirthdaysWidget, MeetingsWidget } from "@/features/home";
import { Feed } from "@/features/posts";

/**
 * The feed between the meetings and the birthdays on a wide screen, where their columns run its whole height so the
 * widgets can stick as it scrolls, and take the width the feed leaves; under them, side by side, on a narrower screen.
 */
export default function HomePage() {
  return (
    <div className="grid w-full items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1fr)_minmax(0,56rem)_minmax(18rem,1fr)]">
      <div className="min-w-0 xl:col-start-1 xl:row-start-1 xl:self-stretch"><MeetingsWidget /></div>
      <div className="min-w-0 xl:col-start-3 xl:row-start-1 xl:self-stretch"><BirthdaysWidget /></div>
      <div className="min-w-0 md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-1"><Feed /></div>
    </div>
  );
}
