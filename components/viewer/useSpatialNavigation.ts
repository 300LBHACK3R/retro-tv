"use client";

import { useEffect } from "react";

const FOCUSABLE =
  'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]';

/** Directional keys navigate the visible TV controls and guide. PageUp/PageDown
 * remain channel shortcuts. Native text fields and selects retain their keys. */
export function useSpatialNavigation(tvMode: boolean) {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]'))
        return;
      const dialog = target?.closest<HTMLElement>('[role="dialog"]');
      if (!tvMode && !dialog?.classList.contains("ttv-guide-dialog")) return;
      const container =
        dialog ?? document.querySelector<HTMLElement>(".ttv-profile-screen, .ttv-tv-mode");
      if (
        !container ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      const controls = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          !element.closest('[inert],[aria-hidden="true"]')
        );
      });
      if (!controls.length) return;
      const current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const rect = current?.getBoundingClientRect();
      let next = controls[0];
      if (rect && current && controls.includes(current)) {
        const horizontal =
          event.key === "ArrowLeft" || event.key === "ArrowRight";
        const sign =
          event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const cx = rect.left + rect.width / 2,
          cy = rect.top + rect.height / 2;
        next = controls
          .filter((element) => element !== current)
          .map((element) => {
            const candidate = element.getBoundingClientRect();
            const dx = candidate.left + candidate.width / 2 - cx,
              dy = candidate.top + candidate.height / 2 - cy;
            const primary = (horizontal ? dx : dy) * sign;
            const secondary = Math.abs(horizontal ? dy : dx);
            return {
              element,
              score: primary > 2 ? primary + secondary * 4 : Infinity,
            };
          })
          .sort((a, b) => a.score - b.score)
          .find((candidate) => Number.isFinite(candidate.score))?.element;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (next) {
        next.focus({ preventScroll: true });
        next.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "auto",
        });
      } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        container
          .querySelector('[data-ttv-guide-scroll="true"]')
          ?.scrollBy({
            left: event.key === "ArrowRight" ? 352 : -352,
            behavior: "auto",
          });
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, [tvMode]);
}
