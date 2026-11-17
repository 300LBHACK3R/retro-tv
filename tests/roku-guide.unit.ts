import { test, expect } from "@playwright/test";
import { buildRokuGuide } from "../lib/rokuGuide";
import { rokuClock } from "../lib/rokuClock";
import { rokuPlayback } from "../lib/rokuCatalog";
import { programming } from "./programming-fixture";
import { serverModule } from "./server-harness";

function snapshot() {
  return { ...structuredClone(programming),
    media: programming.media.map(item => ({ ...item, duration: 1800, file: `https://media.example/${item.id}.mp4`, mimeType: "video/mp4", kidsApproved: true })),
    channels: programming.channels.map(channel => ({ ...channel, kidsApproved: true })),
  };
}
test("Roku timeline shares live programme timing and contains only bounded display data", () => {
  const data = snapshot();
  const clock = rokuClock("Other/UTC-7", new Date("2026-11-17T02:47:03Z"))!;
  const guide = buildRokuGuide(data, "all", clock);
  expect(guide.slots).toEqual(["7:30 pm", "8:00 pm", "8:30 pm", "9:00 pm", "9:30 pm", "10:00 pm"]);
  expect(guide.clock).toBe("7:47 pm");
  expect(guide.date).toBe("Mon, Nov 16");
  expect(guide.end - guide.start).toBe(10800);
  expect(guide.maxStart - guide.minStart).toBe(69 * 3600);
  const row = guide.channels[0]!;
  const current = row.cells.find(cell => cell.start <= guide.now && cell.end > guide.now)!;
  expect(current.title).toBe(rokuPlayback(data, "all", row.id, clock)!.title);
  for (const channel of guide.channels) {
    expect(channel.cells[0]!.start).toBe(guide.start);
    expect(channel.cells.at(-1)!.end).toBe(guide.end);
    channel.cells.forEach((cell, index) => {
      expect(cell.end).toBeGreaterThan(cell.start);
      if (index) expect(cell.start).toBe(channel.cells[index - 1]!.end);
    });
  }
  expect(JSON.stringify(guide)).not.toMatch(/https:|\.mp4|ownedPremiumThemes|adPolicy/);
  expect(buildRokuGuide(data, "all", clock, 1).start).toBe(guide.minStart);
  expect(buildRokuGuide(data, "all", clock, 9999999999).start).toBe(guide.maxStart);
});
test("guide enforces approved Kids channels and the release allowlist", () => {
  const data = snapshot();
  data.channels[1]!.kidsApproved = false;
  const clock = new Date("2026-11-17T02:47:03Z");
  expect(buildRokuGuide(data, "kids", clock).channels.map(c => c.id)).toEqual(["channel:24"]);
  expect(buildRokuGuide(data, "all", clock, 0, ["25"]).channels.map(c => c.id)).toEqual(["channel:25"]);
  expect(buildRokuGuide(data, "all", clock, 0, []).channels).toEqual([]);
});
for (const [iso, expected] of [["2026-03-08T04:40:00Z", 23], ["2026-11-01T03:40:00Z", 25]] as const) {
  test(`guide day tabs follow local midnight across a ${expected}-hour day`, () => {
    const data = snapshot();
    const clock = rokuClock("Canada/Eastern", new Date(iso))!;
    const guide = buildRokuGuide(data, "all", clock);
    expect(guide.days[2]!.start - guide.days[1]!.start).toBe(expected * 3600);
    expect(guide.slots[0]).toBe("11:30 pm");
    expect(guide.slots[1]).toBe("12:00 am");
    for (const row of guide.channels) {
      expect(row.cells[0]!.start).toBe(guide.start);
      expect(row.cells.at(-1)!.end).toBe(guide.end);
      row.cells.forEach((cell, i) => { if (i) expect(cell.start).toBe(row.cells[i - 1]!.end); });
    }
  });
}
test("guide folds commercials into listings without exposing ad titles or changing playback", () => {
  const data = snapshot();
  data.media.push({ ...data.media[0]!, id: "ad", title: "Private campaign", type: "commercial", duration: 30 });
  data.channels[0]!.commercialBreakMode = "end-only";
  const clock = new Date("2026-11-17T02:47:03Z");
  const guide = buildRokuGuide(data, "all", clock);
  expect(JSON.stringify(guide)).not.toContain("Private campaign");
  expect(guide.channels[0]!.cells.every(cell => cell.type !== "COMMERCIAL")).toBe(true);
});
test("guide endpoint validates before storage, limits data and masks outages", async () => {
  let calls = 0; let fail = false;
  const handler = serverModule("app/api/roku/guide/route.ts", {
    "@/lib/rokuGuide": { buildRokuGuide }, "@/lib/rokuClock": { rokuClock },
    "@/lib/server/http": serverModule("lib/server/http.ts"),
    "@/lib/server/rokuProgramming": { rokuChannelAllowlist: () => ["24"], rokuProgramming: async () => { calls++; if (fail) throw Error("private provider detail"); return snapshot(); } },
  });
  const get = (query: string) => handler.GET!(new Request(`https://www.tatestv.ca/api/roku/guide?${query}`));
  for (const query of ["audience=admin", "start=-1", "start=Infinity", "start=1.5", "start=999999999999", "tz=missing"]) expect((await get(query)).status).toBe(400);
  expect(calls).toBe(0);
  const response = await get("audience=kids&tz=Canada/Mountain");
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
  expect((await response.json()).channels.map((c: {id: string}) => c.id)).toEqual(["channel:24"]);
  fail = true; const outage = await get("");
  expect(outage.status).toBe(503); expect(await outage.text()).not.toContain("private provider detail");
});

// A short final calendar day still appears through the last three-hour window,
// but must not get a day button that points into the preceding date.
test("early-morning day tabs never claim the wrong calendar date at the horizon", () => {
  const clock = rokuClock("Other/UTC-7", new Date("2026-11-17T07:40:00Z"))!;
  const guide = buildRokuGuide(snapshot(), "all", clock);
  for (const day of guide.days.slice(1)) {
    const local = rokuClock("Other/UTC-7", new Date(day.start * 1000))!;
    expect(local.getHours()).toBe(0);
    expect(day.start).toBeLessThanOrEqual(guide.maxStart);
  }
  expect(buildRokuGuide(snapshot(), "all", clock, guide.maxStart).end).toBe(guide.minStart + 72 * 3600);
});
