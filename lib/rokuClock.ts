import { TZDateMini } from "@date-fns/tz";

const aliases: Record<string, string> = {
  "US/Puerto Rico-Virgin Islands": "America/Puerto_Rico",
  "US/Guam": "Pacific/Guam",
  "US/Samoa": "Pacific/Pago_Pago",
  "US/Aleutian": "America/Adak",
  "Canada/Mountain Standard": "America/Dawson_Creek",
  "Canada/Central Standard": "America/Regina",
  "Mexico/Pacific": "America/Tijuana",
  "Mexico/Mountain": "America/Mazatlan",
  "Mexico/Central": "America/Mexico_City",
  "Mexico/Eastern": "America/Cancun",
  "Europe/Iceland": "Atlantic/Reykjavik",
  "Europe/Ireland": "Europe/Dublin",
  "Europe/United Kingdom": "Europe/London",
  "Europe/Portugal": "Europe/Lisbon",
  "Europe/Central European Time": "Europe/Berlin",
  "Europe/France": "Europe/Paris",
  "Europe/Greece/Finland": "Europe/Helsinki",
  "Europe/Western European Time": "Europe/Lisbon",
  "Australia/Lord Howe": "Australia/Lord_Howe",
};

export function rokuClock(value: string | null, now = new Date()): Date | null {
  if (value === null) return new TZDateMini(now.getTime(), "UTC");
  if (value.length > 80) return null;
  const name = value.trim();
  const fixed = /^Other\/UTC([+-])(\d{1,2})$/.exec(name);
  if (fixed) {
    const hours = Number(fixed[2]);
    if (hours > 14) return null;
    return new TZDateMini(now.getTime(), `${fixed[1]}${String(hours).padStart(2, "0")}:00`);
  }
  const zone = Object.hasOwn(aliases, name) ? aliases[name]! : name;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return new TZDateMini(now.getTime(), zone);
  } catch {
    return null;
  }
}
