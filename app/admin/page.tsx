import { pageMetadata } from "@/lib/metadata";
import AdminWindowClient from "@/components/AdminWindowClient";

export const metadata = pageMetadata(
  "Station administration",
  "Manage Tate’s TV programming and station settings.",
  "/admin",
  false,
);

export default function AdminPage() {
  return <AdminWindowClient />;
}
