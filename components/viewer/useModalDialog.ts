"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => {
    return (
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null
    );
  });
}

interface UseModalDialogOptions {
  open: boolean;
  onClose: () => void;
  dialogRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Shared client-side dialog lifecycle for Tate's TV viewer overlays.
 *
 * It prevents each dialog from reimplementing Escape handling, focus trapping,
 * initial focus, and focus restoration with subtly different behaviour.
 */
export function useModalDialog({
  open,
  onClose,
  dialogRef,
  initialFocusRef,
}: UseModalDialogOptions): boolean {
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !open) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;

      if (!dialog) {
        return;
      }

      const preferredTarget = initialFocusRef?.current;
      const fallbackTarget = getFocusableElements(dialog)[0] ?? dialog;

      (preferredTarget ?? fallbackTarget).focus({ preventScroll: true });
    }, 20);

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeDialog =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.closest('[role="dialog"]')
          : null;
      if (activeDialog && activeDialog !== dialogRef.current) return;
      if (
        event.key === "Escape" ||
        event.key === "BrowserBack" ||
        event.key === "GoBack" ||
        event.keyCode === 10009 ||
        event.keyCode === 461
      ) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;

      if (!dialog) {
        return;
      }

      const focusableElements = getFocusableElements(dialog);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!firstElement || !lastElement) return;
      if (!dialog.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      } else if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus({ preventScroll: true });
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);

      window.setTimeout(() => {
        const anotherOverlayIsOpen =
          document.body.dataset.ttvOverlayOpen === "true";

        if (!anotherOverlayIsOpen && previouslyFocused?.isConnected) {
          previouslyFocused.focus({ preventScroll: true });
        }
      }, 0);
    };
  }, [dialogRef, initialFocusRef, mounted, open]);

  return mounted;
}
