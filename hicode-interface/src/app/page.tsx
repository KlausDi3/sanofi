import { redirect } from "next/navigation";

/**
 * The app has no landing page of its own yet — Dashboard is still unbuilt —
 * so the root sends you to where the work happens.
 */
export default function RootPage() {
  redirect("/analysis");
}
