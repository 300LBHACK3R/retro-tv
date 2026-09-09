"use client";

import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalDialog } from "@/components/viewer/useModalDialog";

interface ViewerGuideDialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function ViewerGuideDialog({
  open,
  onClose,
  children,
}: ViewerGuideDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const mounted = useModalDialog({
    open,
    onClose,
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <section
      ref={dialogRef}
      className="ttv-guide-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ttv-live-guide-title"
      aria-describedby="ttv-live-guide-description"
      tabIndex={-1}
    >
      <header className="ttv-guide-dialog-header">
        <div className="ttv-guide-dialog-title">
          <span>Tate&apos;s TV</span>
          <strong id="ttv-live-guide-title">Live Guide</strong>
          <small id="ttv-live-guide-description">
            Browse what is on now and tune to any available channel.
          </small>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="ttv-guide-close"
          aria-label="Close live guide"
        >
          <span aria-hidden="true">×</span>
          <span>Close</span>
        </button>
      </header>

      <div className="ttv-guide-dialog-body">{children}</div>
    </section>,
    document.body,
  );
}
