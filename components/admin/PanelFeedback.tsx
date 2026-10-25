export type PanelStat = {
  label: string;
  value: string | number;
  helper: string;
  tone?: "default" | "good" | "warn" | "danger";
};

function getStatStyles(tone: PanelStat["tone"] = "default") {
  if (tone === "good") {
    return {
      borderColor: "rgba(34, 197, 94, 0.32)",
      background: "rgba(34, 197, 94, 0.08)",
      valueColor: "#86efac",
    };
  }

  if (tone === "warn") {
    return {
      borderColor: "rgba(250, 204, 21, 0.32)",
      background: "rgba(250, 204, 21, 0.08)",
      valueColor: "#fde68a",
    };
  }

  if (tone === "danger") {
    return {
      borderColor: "rgba(248, 113, 113, 0.35)",
      background: "rgba(248, 113, 113, 0.09)",
      valueColor: "#fecaca",
    };
  }

  return {
    borderColor: "var(--border)",
    background: "var(--panel-bg)",
    valueColor: "var(--text)",
  };
}

export function StatCard({ stat }: { stat: PanelStat }) {
  const styles = getStatStyles(stat.tone);

  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        background: styles.background,
        borderColor: styles.borderColor,
      }}
    >
      <div className="text-lg font-black tracking-tight" style={{ color: styles.valueColor }}>
        {stat.value}
      </div>

      <div
        className="mt-1 text-[10px] font-black uppercase tracking-[0.14em]"
        style={{ color: "var(--text-muted)" }}
      >
        {stat.label}
      </div>

      <div
        className="mt-2 line-clamp-2 text-[11px] leading-4"
        style={{ color: "var(--text-muted)" }}
      >
        {stat.helper}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl border px-3 py-8 text-center text-xs"
      style={{
        background: "var(--panel-alt-bg)",
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      }}
    >
      {message}
    </div>
  );
}
