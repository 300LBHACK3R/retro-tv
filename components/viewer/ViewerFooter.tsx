import Link from "next/link";

export default function ViewerFooter() {
  return (
    <footer className="ttv-premium-footer">
      <div>
        <strong>Tate&apos;s TV</strong>
        <span>Free TV, built like real television.</span>
      </div>

      <nav aria-label="Footer">
        <Link href="/help">Help</Link>
        <Link href="/compat">Compatibility</Link>
        <Link href="/submit">Submit</Link>
        <Link href="/install">Install</Link>
        <a
          href="https://lltechsolutions.ca"
          target="_blank"
          rel="noopener noreferrer"
        >
          L&amp;L Tech Solutions
        </a>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </footer>
  );
}
