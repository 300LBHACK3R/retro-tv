import type { Metadata } from "next";
import AdminWindowClient from "@/components/AdminWindowClient";

export const metadata: Metadata = {
  title: "Admin Control Centre | Tate's TV",
  description: "Protected programming and station controls for Tate's TV.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminWindowClient />;
}