import type { NumericTuneState } from "@/components/viewer/useNumericChannelTune";

export default function ChannelTuneOverlay({
  value,
  message,
  visible,
}: NumericTuneState) {
  if (!visible) {
    return null;
  }

  return (
    <div className="ttv-channel-tune-overlay" role="status" aria-live="polite">
      <span>CH</span>
      <strong>{value || "--"}</strong>
      <small>{message}</small>
    </div>
  );
}
