import { pageMetadata } from "@/lib/metadata";
import RewindRoom from "@/components/rewind/RewindRoom";

export const metadata = pageMetadata(
  "The Rewind Room",
  "Movie night, the old-school way. Browse Tate’s TV’s VHS-inspired movie shelf, pick a tape and press play.",
  "/rewind-room",
  true,
);

export default function RewindRoomPage() { return <RewindRoom />; }
