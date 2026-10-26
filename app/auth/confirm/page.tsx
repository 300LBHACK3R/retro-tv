import AccountPage from "@/components/account/AccountPage";
export const metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Page() {
  return <AccountPage confirmation />;
}
