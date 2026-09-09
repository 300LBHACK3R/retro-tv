"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  findChannelByNumber,
  getChannelDisplayName,
  getChannelLabel,
  isTypingTarget,
} from "@/lib/viewer";
import type { Channel } from "@/lib/types";

const COMMIT_DELAY_MS = 950;
const CLEAR_DELAY_MS = 1_700;
const MAX_DIGITS = 3;

export interface NumericTuneState {
  value: string;
  message: string;
  visible: boolean;
}

/**
 * Preserves classic numeric channel tuning without keeping the large Quick
 * Tune form in the public layout. It is intentionally disabled while a dialog
 * is open or the user is typing into a form field.
 */
export function useNumericChannelTune(
  channels: readonly Channel[],
  onTune: (channelId: string) => void,
  disabled: boolean,
): NumericTuneState {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  const bufferRef = useRef("");
  const commitTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  const clearDisplayLater = useCallback(() => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }

    clearTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setValue("");
      setMessage("");
      bufferRef.current = "";
      clearTimerRef.current = null;
    }, CLEAR_DELAY_MS);
  }, []);

  const commitValue = useCallback(
    (nextValue: string) => {
      const channel = findChannelByNumber(channels, nextValue);

      // A committed number must not leak into the next tuning attempt while
      // the confirmation overlay is still visible.
      bufferRef.current = "";

      if (!channel) {
        setMessage(`No channel ${nextValue}`);
        clearDisplayLater();
        return;
      }

      onTune(channel.id);
      setMessage(
        `${getChannelLabel(channel)} · ${getChannelDisplayName(channel)}`,
      );
      clearDisplayLater();
    },
    [channels, clearDisplayLater, onTune],
  );

  useEffect(() => {
    if (disabled) {
      clearTimers();
      setVisible(false);
      setValue("");
      setMessage("");
      bufferRef.current = "";
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey ||
        isTypingTarget(event.target) ||
        Boolean((event.target as HTMLElement | null)?.closest("button, a, [role=dialog]")) ||
        document.body.dataset.ttvOverlayOpen === "true"
      ) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        clearTimers();

        const nextValue = `${bufferRef.current}${event.key}`.slice(-MAX_DIGITS);
        bufferRef.current = nextValue;

        setValue(nextValue);
        setMessage("Enter channel");
        setVisible(true);

        commitTimerRef.current = window.setTimeout(() => {
          commitValue(bufferRef.current);
          commitTimerRef.current = null;
        }, COMMIT_DELAY_MS);
        return;
      }

      if (event.key === "Enter" && bufferRef.current) {
        event.preventDefault();
        clearTimers();
        commitValue(bufferRef.current);
        return;
      }

      if (event.key === "Escape" && bufferRef.current) {
        event.preventDefault();
        clearTimers();
        bufferRef.current = "";
        setValue("");
        setMessage("");
        setVisible(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimers();
    };
  }, [clearTimers, commitValue, disabled]);

  return { value, message, visible };
}
