"use client";

export default function OpenAdminWindowButton() {
  const openAdminWindow = () => {
    const adminWindow = window.open(
      "/admin",
      "tatestv-admin",
      "popup=yes,width=1500,height=950,resizable=yes,scrollbars=yes",
    );

    if (!adminWindow) {
      window.location.assign("/admin");
      return;
    }

    adminWindow.focus();
  };

  return (
    <button
      type="button"
      onClick={openAdminWindow}
      className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em]"
    >
      Admin
    </button>
  );
}