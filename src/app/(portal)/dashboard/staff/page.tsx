import { redirect } from "next/navigation";

/** The staff statistics used to be a tab of the dashboard: old links land on the analytics page. */
export default function Page() {
  redirect("/dashboard");
}
