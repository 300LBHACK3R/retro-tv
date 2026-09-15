"use client";

import { useEffect, type RefObject } from "react";

/** Keep mobile dialog controls above the keyboard without counteracting zoom. */
export function useDialogViewport(
  dialogRef: RefObject<HTMLElement | null>,
  open: boolean,
) {
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const dialog = dialogRef.current;
    if (!viewport || !dialog) return;
    const fitViewport = () => {
      if (viewport.scale !== 1) return;
      dialog.style.setProperty("--ttv-dialog-height", `${viewport.height}px`);
      dialog.style.setProperty("--ttv-dialog-top", `${viewport.offsetTop}px`);
    };
    fitViewport();
    viewport.addEventListener("resize", fitViewport);
    viewport.addEventListener("scroll", fitViewport);
    return () => {
      viewport.removeEventListener("resize", fitViewport);
      viewport.removeEventListener("scroll", fitViewport);
      dialog.style.removeProperty("--ttv-dialog-height");
      dialog.style.removeProperty("--ttv-dialog-top");
    };
  }, [dialogRef, open]);
}
