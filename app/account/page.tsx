import AccountPage from "@/components/account/AccountPage";
import { pageMetadata } from "@/lib/metadata";
export const metadata = pageMetadata(
  "Your account",
  "Sign in, save your household and manage Tate’s TV themes and membership.",
  "/account",
  true,
);
export default function Page() {
  return <AccountPage />;
}
