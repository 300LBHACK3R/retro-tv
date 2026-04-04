"use client";

export default function ThemeButton() {
  const openThemes = () => {
    alert("Theme marketplace coming next. This is where users will switch and unlock themes.");
  };

  return (
    <button
      onClick={openThemes}
      className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
    >
      Themes
    </button>
  );
}