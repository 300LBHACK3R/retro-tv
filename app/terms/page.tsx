import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
export const metadata = pageMetadata(
  "Accounts & purchases",
  "How free viewing, optional themes and membership work on Tate’s TV.",
  "/terms",
);
export default function TermsPage() {
  return (
    <main className="ttv-policy-page">
      <Link href="/">← Back to free TV</Link>
      <h1>Accounts & purchases</h1>
      <p>
        Live channels, the guide and the on-demand library remain free. An
        account, theme purchase or membership is optional. Adults create and
        manage household accounts, including profiles used by children. Keep
        your sign-in details private.
      </p>
      <h2>Individual themes</h2>
      <p>
        A one-time theme purchase belongs to the account used at checkout and
        can be used on its signed-in devices. The current price and any
        applicable taxes are shown before you pay. These purchases do not renew.
        A refunded purchase or unresolved payment dispute can remove access to
        that theme.
      </p>
      <h2>Tate’s TV Membership</h2>
      <p>
        Membership renews monthly at the price shown at checkout. While active,
        it includes all premium themes, up to ten household profiles and an
        optional member badge. Membership does not remove ads or change access
        to programmes.
      </p>
      <p>
        Use Account → Manage billing to cancel future renewals. Access continues
        through the paid period unless a refund, payment dispute or payment
        failure changes that entitlement. Individually purchased themes remain
        yours after membership ends. Extra household profiles and their saved
        items are kept; using profiles beyond the free limit requires an active
        membership.
      </p>
      <h2>Payment problems and account deletion</h2>
      <p>
        Check Account → Manage billing for receipts and payment information. If
        a successful payment has not appeared, refresh your purchases or use the
        support information on our <Link href="/help">Help page</Link>.
        Cancellation and account deletion do not automatically refund completed
        payments. Nothing here removes rights available under applicable
        consumer law.
      </p>
      <p>
        Deleting an account removes its synced household data and access to its
        purchases and cancels its membership. Guest profiles remain on the
        device. Read the <Link href="/privacy">privacy information</Link> for
        details about saved data.
      </p>
    </main>
  );
}
