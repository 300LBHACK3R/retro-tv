import { TZDateMini } from "@date-fns/tz";
import { buildDisplayCellsForWindow, getDisplayTitle, getDisplayType } from "./guideTimeline";
import { BROADCAST_EPOCH_MS } from "./liveEngine";
import { rokuLineup, rokuSchedule, type RokuAudience } from "./rokuCatalog";
import type { ProgrammingSnapshot } from "./programmingSnapshot";

const WINDOW = 3 * 3600;
const HORIZON = 72 * 3600;
// Keep the device's broadcast timezone across midnight and DST. Date(date)
// would discard TZDateMini's zone and silently use the server's timezone.
function at(date: Date, seconds: number): Date {
  return date instanceof TZDateMini
    ? new TZDateMini(seconds * 1000, date.timeZone) : new Date(seconds * 1000);
}
function clock(date: Date) {
  return `${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${date.getHours() < 12 ? "am" : "pm"}`;
}
function dayLabel(date: Date) {
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()]}, ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()]} ${date.getDate()}`;
}

/** Bounded, public display metadata only; playback always resolves live separately. */
export function buildRokuGuide(snapshot: ProgrammingSnapshot, audience: RokuAudience,
  now: Date, requestedStart = 0, channelIds?: readonly string[]) {
  const nowSec = Math.floor(now.getTime() / 1000);
  const base = at(now, nowSec);
  base.setMinutes(base.getMinutes() < 30 ? 0 : 30, 0, 0);
  const minStart = base.getTime() / 1000;
  const maxStart = minStart + HORIZON - WINDOW;
  const start = Math.max(minStart, Math.min(maxStart, requestedStart || minStart));
  const end = start + WINDOW;
  const days = [{ label: "Now", date: dayLabel(base), start: minStart }];
  const midnight = at(now, minStart);
  midnight.setHours(24, 0, 0, 0);
  while (midnight.getTime() / 1000 <= maxStart && days.length < 4) {
    days.push({ label: days.length === 1 ? "Tomorrow" : dayLabel(midnight).split(",")[0]!,
      date: dayLabel(midnight), start: midnight.getTime() / 1000 });
    midnight.setDate(midnight.getDate() + 1);
  }
  const lineup = rokuLineup(snapshot, audience, channelIds);
  const channels = lineup.channels.map(channel => {
    const cells: { title: string; type: string; start: number; end: number; minutes: number }[] = [];
    let cursor = start;
    while (cursor < end) {
      const local = at(now, cursor);
      const nextDay = at(now, cursor);
      nextDay.setHours(24, 0, 0, 0);
      const sliceEnd = Math.min(end, nextDay.getTime() / 1000);
      const schedule = rokuSchedule(channel, lineup.media, local);
      const anchor = (schedule[0]?.scheduleAnchorMs ?? BROADCAST_EPOCH_MS) / 1000;
      for (const cell of buildDisplayCellsForWindow(schedule, cursor - anchor, sliceEnd - cursor)) {
        cells.push({ title: getDisplayTitle(cell.item), type: getDisplayType(cell.item),
          start: cursor + cell.startSec, end: cursor + cell.endSec,
          minutes: Math.max(1, Math.round((cell.item.guideDuration || cell.item.duration) / 60)) });
      }
      cursor = sliceEnd;
    }
    return { id: `channel:${channel.id}`, cells };
  });
  return { ok: true, version: 1, audience, now: nowSec, start, end, minStart, maxStart,
    clock: clock(now), date: dayLabel(at(now, start)), days,
    slots: Array.from({ length: 6 }, (_, index) => clock(at(now, start + index * 1800))), channels };
}
