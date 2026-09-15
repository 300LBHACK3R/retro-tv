"use client";
import { useEffect, useState } from "react";
import {
  analyticsOptedOut,
  setAnalyticsDisabled,
} from "@/lib/analyticsPrivacy";

export default function AnalyticsPreference() {
  const [disabled, setDisabled] = useState(true);
  useEffect(() => {
    setDisabled(analyticsOptedOut());
  }, []);
  return (
    <div>
      <button
        className="ttv-section-action"
        type="button"
        aria-pressed={disabled}
        onClick={() => {
          setAnalyticsDisabled(!disabled);
          setDisabled(analyticsOptedOut());
        }}
      >
        {disabled
          ? "Allow optional viewing analytics"
          : "Turn off optional viewing analytics"}
      </button>
      <p role="status">
        {disabled
          ? "Optional analytics are off for this browser."
          : "Optional analytics are on for full-lineup profiles."}{" "}
        Browser privacy signals are always respected.
      </p>
    </div>
  );
}
