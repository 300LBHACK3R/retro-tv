"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useDialogViewport } from "@/components/viewer/useDialogViewport";
import { useModalDialog } from "@/components/viewer/useModalDialog";

interface ViewerGuideDialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  inlineDialogRef?: RefObject<HTMLElement | null>;
}

export default function ViewerGuideDialog({
  open,
  onClose,
  children,
  inlineDialogRef,
}: ViewerGuideDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const mounted = useModalDialog({
    open,
    onClose,
    dialogRef: inlineDialogRef ?? dialogRef,
    initialFocusRef: closeButtonRef,
  });

  useDialogViewport(inlineDialogRef ?? dialogRef, mounted && open);

  if (!mounted || !open) {
    return null;
  }

  const content = (
    <section
      ref={dialogRef}
      className={inlineDialogRef ? "ttv-guide-inline" : "ttv-guide-dialog"}
      role={inlineDialogRef ? undefined : "dialog"}
      aria-modal={inlineDialogRef ? undefined : true}
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
    </section>
  );
  return inlineDialogRef ? content : createPortal(content, document.body);
}
