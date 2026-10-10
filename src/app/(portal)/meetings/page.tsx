import { MeetingCalendar } from "@/features/meetings";

export default function MeetingsPage() {
  return <section className="mx-auto w-full max-w-7xl"><div className="mb-5"><h1 className="text-2xl font-semibold">Lịch họp</h1><p className="text-sm text-muted">Thêm cuộc họp bằng nút bên dưới. Bấm lịch để xem chi tiết; kéo/thả cuộc họp do bạn tổ chức để đổi giờ.</p></div><MeetingCalendar /></section>;
}
