"use client";

import { useMemo, useRef, useState } from "react";
import { channelCategory, kidsChannelReview } from "@/lib/audience";
import { HALLOWEEN_CHANNELS, sortChannelLineup } from "@/lib/channelLineup";
import { useStore } from "@/lib/store";
import { getChannelDisplayName } from "@/lib/viewer";

type Destination = "quick-edit" | "programming" | "blocks" | "audience";

export default function ChannelLineupPanel({ onOpen }: {
  onOpen: (destination: Destination, channelId?: string) => void;
}) {
  const channels = useStore(state => state.channels);
  const media = useStore(state => state.media);
  const moveChannelTo = useStore(state => state.moveChannelTo);
  const updateChannel = useStore(state => state.updateChannelSettings);
  const addHalloween = useStore(state => state.addHalloweenChannels);
  const assignMedia = useStore(state => state.assignMediaToChannel);
  const ordered = useMemo(() => sortChannelLineup(channels), [channels]);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const [notice, setNotice] = useState("");
  const [pickerId, setPickerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const pickerChannel = channels.find(channel => channel.id === pickerId);
  const choices = useMemo(() => media.filter(item =>
    item.type !== "commercial" && item.type !== "bumper" &&
    !pickerChannel?.mediaIds.includes(item.id) &&
    item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ), [media, pickerChannel, query]);
  const missingSeasonal = HALLOWEEN_CHANNELS.filter(preset => !channels.some(channel => channel.id === preset.id));

  function move(id: string, position: number) {
    const channel = channels.find(item => item.id === id);
    if (!channel) return;
    moveChannelTo(id, position);
    setNotice(`${getChannelDisplayName(channel)} is now Channel ${position}. Check the cloud status for confirmation that your changes saved.`);
    requestAnimationFrame(() => rows.current.get(id)?.scrollIntoView({ block: "nearest" }));
  }

  return (
    <section className="ttv-lineup-panel" aria-labelledby="lineup-heading">
      <header>
        <span className="ttv-section-kicker">Your station, your order</span>
        <h2 id="lineup-heading">Channel lineup</h2>
        <p>Use Up, Down, or Move to. Channel numbers update automatically; shows, logos, schedules and favourites stay with their channel.</p>
        <p>Changes save automatically to your station. Check the cloud status in the admin toolbar before leaving; you can also use <strong>Save</strong> there.</p>
      </header>

      <aside className="ttv-lineup-seasonal" aria-label="Halloween channels">
        <div>
          <h3>A season of scares</h3>
          <p><strong>Friday Night Horror</strong> for adult viewers, and <strong>Halloween Kids</strong> for reviewed children’s specials.</p>
          <p>Add your shows and movies first, then turn the channels on. Review Halloween Kids in Audience before publishing it to Kids profiles.</p>
        </div>
        <button type="button" disabled={!missingSeasonal.length} onClick={() => {
          addHalloween();
          setNotice("Halloween channels added, off air. Use Add shows to assign programmes, then turn them on when ready. Check the cloud status to confirm they saved.");
        }}>{missingSeasonal.length ? "Add Halloween channels" : "Halloween channels added"}</button>
      </aside>

      <p className="ttv-lineup-status" role="status">{notice || `${channels.length} channels. Moving Channel 3 down makes it Channel 4 and moves the previous Channel 4 to 3.`}</p>
      <ol className="ttv-lineup-list" aria-label="Station channel order">
        {ordered.map((channel, index) => {
          const name = getChannelDisplayName(channel);
          const ids = new Set([...channel.mediaIds, ...(channel.programmeBlocks ?? []).flatMap(block => block.mediaIds)]);
          const programmeCount = media.filter(item => ids.has(item.id) && item.type !== "commercial" && item.type !== "bumper").length;
          const readyForKids = kidsChannelReview(channel, media).length === 0;
          return (
            <li key={channel.id} data-channel-id={channel.id} aria-label={`${name} channel`}
              ref={element => { if (element) rows.current.set(channel.id, element); else rows.current.delete(channel.id); }}>
              <div className="ttv-lineup-identity">
                <span className="ttv-lineup-number">CH {channel.number ?? index + 1}</span>
                <div>
                  <h3>{name}</h3>
                  <p>{channelCategory(channel)} · {programmeCount} programme{programmeCount === 1 ? "" : "s"}</p>
                  <small>{channel.isEnabled === false ? "Off air" : "On air"} · {channel.adultOnly ? "Adults only" : readyForKids ? "Kids approved" : "Not approved for Kids"}</small>
                </div>
              </div>
              <div className="ttv-lineup-move" role="group" aria-label={`Reorder ${name}`}>
                <button type="button" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => move(channel.id, index)}>↑ Up</button>
                <button type="button" aria-label={`Move ${name} down`} disabled={index === ordered.length - 1} onClick={() => move(channel.id, index + 2)}>↓ Down</button>
                <label>Move to
                  <select aria-label={`Move ${name} to channel`} value={index + 1} onChange={event => move(channel.id, Number(event.target.value))}>
                    {ordered.map((item, target) => <option key={item.id} value={target + 1}>CH {target + 1}</option>)}
                  </select>
                </label>
              </div>
              <div className="ttv-lineup-settings">
                <label><input type="checkbox" checked={channel.isEnabled !== false}
                  disabled={channel.isEnabled === false && programmeCount === 0}
                  onChange={event => { updateChannel(channel.id, { isEnabled: event.target.checked }); setNotice(`${name} ${event.target.checked ? "enabled" : "taken off air"}. Check the cloud status to confirm the change saved.`); }} />On air</label>
                <label><input type="checkbox" checked={channel.adultOnly === true}
                  onChange={event => { updateChannel(channel.id, { adultOnly: event.target.checked, kidsApproved: false }); setNotice(`${name}: audience setting updated. Kids approval must be reviewed separately.`); }} />Adults only</label>
                <button type="button" aria-expanded={pickerId === channel.id} aria-controls={`lineup-shows-${channel.id}`} onClick={() => {
                  setPickerId(pickerId === channel.id ? null : channel.id);
                  setQuery(""); setSelected([]);
                }}>Add shows<span className="sr-only"> to {name}</span></button>
                <button type="button" onClick={() => onOpen("programming", channel.id)}>Playlist<span className="sr-only"> for {name}</span></button>
                <button type="button" onClick={() => onOpen("blocks", channel.id)}>Schedule blocks<span className="sr-only"> for {name}</span></button>
                {!channel.adultOnly && <button type="button" onClick={() => onOpen("audience", channel.id)}>Review for Kids<span className="sr-only">: {name}</span></button>}
              </div>
              {pickerId === channel.id && <div id={`lineup-shows-${channel.id}`} className="ttv-lineup-picker" role="group" aria-label={`Add programmes to ${name}`}>
                <p>Choose from your media library. These programmes will also stay on their existing channels. Use Add Media in the admin tabs to upload something new.</p>
                <label>Find a show or movie
                  <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
                </label>
                <div className="ttv-lineup-choices">
                  {choices.map(item => <label key={item.id}>
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(values => event.target.checked ? [...values, item.id] : values.filter(id => id !== item.id))} />
                    <span>{item.title}<small>{item.type} · {item.kidsApproved ? "Kids reviewed" : "Needs Kids review"}</small></span>
                  </label>)}
                  {!choices.length && <p>No matching programmes to add.</p>}
                </div>
                <button type="button" disabled={!selected.length} onClick={() => {
                  const available = selected.filter(id => media.some(item => item.id === id && item.type !== "commercial" && item.type !== "bumper") && !channel.mediaIds.includes(id));
                  available.forEach(id => assignMedia(channel.id, id));
                  setSelected([]);
                  setNotice(`${available.length} programme(s) added to ${name}. Review all programming before making this channel available to Kids.`);
                }}>Add selected ({selected.length})</button>
              </div>}
              {channel.isEnabled === false && !programmeCount && <p className="ttv-lineup-hint">Add shows before turning this channel on.</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
