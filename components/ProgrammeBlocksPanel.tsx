"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  blocksOverlap,
  sanitizeProgrammeBlocks,
  WEEKDAYS,
} from "@/lib/programmeBlocks";
import { cleanDisplayText } from "@/lib/textClean";
import type { ProgrammeBlock, Weekday } from "@/lib/types";

export default function ProgrammeBlocksPanel() {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const current = useStore((state) => state.currentChannelId);
  const update = useStore((state) => state.updateChannelSettings);
  const [channelId, setChannelId] = useState(current);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("20:00");
  const [duration, setDuration] = useState(120);
  const [days, setDays] = useState<Weekday[]>(["friday"]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const channel = channels.find((item) => item.id === channelId) ?? channels[0];
  const blocks = useMemo(
    () => sanitizeProgrammeBlocks(channel?.programmeBlocks),
    [channel],
  );
  const choices = media.filter(
    (item) =>
      channel?.mediaIds.includes(item.id) &&
      item.type !== "commercial" &&
      item.type !== "bumper",
  );
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!channel) return;
    const candidate: ProgrammeBlock = {
      id: crypto.randomUUID(),
      title,
      startTime,
      durationMinutes: duration,
      days,
      mediaIds: selected,
    };
    if (!sanitizeProgrammeBlocks([candidate]).length) {
      setMessage(
        "Add a title, at least one day and programme, and a 15–720 minute window ending before midnight.",
      );
      return;
    }
    if (blocks.length >= 24) {
      setMessage(
        "This channel already has 24 blocks. Remove one before adding another.",
      );
      return;
    }
    if (blocks.some((block) => blocksOverlap(block, candidate))) {
      setMessage(
        "That time overlaps another block on this channel. Choose a different time or day.",
      );
      return;
    }
    update(channel.id, { programmeBlocks: [...blocks, candidate] });
    setTitle("");
    setSelected([]);
    setMessage(
      "Block added to your station programming. Publish with Save to Cloud when ready.",
    );
  }
  return (
    <section className="ttv-station-panel">
      <span className="ttv-section-kicker">Make it a regular thing</span>
      <h2>Signature programming</h2>
      <p>
        Give viewers a reason to tune in each week. Blocks appear in the live
        guide and daily picks. Times follow the same local broadcast clock as
        the guide.
      </p>
      <div className="ttv-section-actions" style={{ marginTop: "1rem" }}>
        {[
          ["Saturday Morning Cartoons", "09:00", "saturday"],
          ["Friday Night Movies", "20:00", "friday"],
          ["Late Night Throwbacks", "22:00", "saturday"],
        ].map(([name = "", time = "20:00", day = "friday"]) => (
          <button
            type="button"
            className="ttv-section-action"
            key={name}
            onClick={() => {
              setTitle(name);
              setStartTime(time);
              setDays([day as Weekday]);
              setDuration(120);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <form className="ttv-station-form" onSubmit={save}>
        <label>
          Channel
          <select
            value={channel?.id ?? ""}
            onChange={(event) => {
              setChannelId(event.target.value);
              setSelected([]);
              setMessage("");
            }}
          >
            {channels.map((item) => (
              <option key={item.id} value={item.id}>
                CH {item.number ?? item.id} ·{" "}
                {item.branding?.displayName || item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Block title
          <input
            value={title}
            maxLength={100}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Friday Night Movies"
            required
          />
        </label>
        <div className="ttv-block-time-fields">
          <label>
            Starts at
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </label>
          <label>
            Length in minutes
            <input
              type="number"
              min={15}
              max={720}
              step={1}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              required
            />
          </label>
        </div>
        <div className="ttv-station-days" role="group" aria-label="Airing days">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              className="ttv-section-action"
              aria-pressed={days.includes(day)}
              onClick={() =>
                setDays(
                  days.includes(day)
                    ? days.filter((value) => value !== day)
                    : [...days, day],
                )
              }
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
        <label>
          Choose programmes in playback order
          <input
            type="search"
            placeholder="Search this channel"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="ttv-block-programmes">
          {choices
            .filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase()),
            )
            .map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() =>
                    setSelected(
                      selected.includes(item.id)
                        ? selected.filter((id) => id !== item.id)
                        : [...selected, item.id],
                    )
                  }
                />
                <span>
                  {selected.includes(item.id)
                    ? `${selected.indexOf(item.id) + 1}. `
                    : ""}
                  {cleanDisplayText(item.title)}
                </span>
              </label>
            ))}
          {!choices.length && (
            <p>Assign programmes to this channel in Playlist first.</p>
          )}
        </div>
        <p>
          {selected.length} selected. Programmes and the channel’s commercial
          policy repeat within the window. Playback returns to the regular
          lineup at the end; a programme may be cut short at that boundary.
        </p>
        <button type="submit" className="ttv-section-action">
          Add recurring block
        </button>
        {message && <p role="status">{message}</p>}
      </form>
      {blocks.map((block) => (
        <article key={block.id} className="ttv-station-block">
          <h3>{block.title}</h3>
          <p>
            {block.days.map((day) => day.slice(0, 3)).join(" · ")} /{" "}
            {block.startTime} / {block.durationMinutes} minutes /{" "}
            {block.mediaIds.length} programmes
          </p>
          <button
            type="button"
            className="ttv-section-action"
            onClick={() =>
              channel &&
              update(channel.id, {
                programmeBlocks: blocks.filter((item) => item.id !== block.id),
              })
            }
          >
            Remove {block.title}
          </button>
        </article>
      ))}
      {!blocks.length && (
        <p>
          No recurring blocks on this channel yet. Its existing schedule
          continues normally.
        </p>
      )}
    </section>
  );
}
