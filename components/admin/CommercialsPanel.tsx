"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { applyEndBreaks, isCommercial, planEndBreaks } from "@/lib/commercialSetup";
import { buildSchedule } from "@/lib/scheduler";
import { getMediaForChannel, createBroadcastDayAnchor } from "@/lib/viewer";
import { kidsChannelReview } from "@/lib/audience";
import type { AdPlacement, BroadcastItem, Channel, MediaItem, Weekday } from "@/lib/types";

const UploadPanel = dynamic(() => import("./UploadPanel"), { loading: () => <p role="status">Opening upload tools…</p> });
const placements: { id: AdPlacement; label: string }[] = [
  { id: "filler", label: "End-of-slot breaks" },
  { id: "mid-roll", label: "Saved breaks inside shows" },
  { id: "between-programs", label: "Between music-video blocks" },
];
const days: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const toggle = <T,>(values: T[], value: T) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
const channelName = (channel: Channel) => `CH ${channel.number ?? channel.id} · ${channel.branding?.displayName ?? channel.name}`;
const runtime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
function localNow() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function CampaignEditor({ item, channels, onSaved }: { item: MediaItem; channels: Channel[]; onSaved: (text: string) => void }) {
  const [targets, setTargets] = useState(item.adChannelIds ?? []);
  const [mode, setMode] = useState(item.adChannelIds?.includes("all") ? "all" : "selected");
  const [allowed, setAllowed] = useState<AdPlacement[]>(item.adPlacements ?? ["between-programs", "filler"]);
  const [campaignDays, setCampaignDays] = useState<Weekday[]>(item.adDays ?? item.airDays ?? []);
  const [kids, setKids] = useState(item.kidsApproved === true);
  const [campaign, setCampaign] = useState(item.campaignName ?? "");
  const [advertiser, setAdvertiser] = useState(item.advertiserName ?? "");
  const [category, setCategory] = useState((item.adCategories?.length ? item.adCategories : [item.commercialCategory ?? "general"]).join(", "));
  return <form className="ttv-admin-card" onSubmit={event => {
    event.preventDefault();
    if (!allowed.length) { onSaved("Choose at least one placement. To pause an ad, remove all channel targets."); return; }
    const categories = [...new Set(category.split(",").map(value => value.trim().toLowerCase().replace(/[^a-z0-9-_\s]/g, "").replace(/\s+/g, "-")).filter(Boolean))];
    useStore.getState().updateMedia(item.id, {
      adChannelIds: mode === "all" ? ["all"] : targets.filter(id => channels.some(channel => channel.id === id)),
      adPlacements: allowed, adDays: campaignDays,
      advertiserName: advertiser.trim(), campaignName: campaign.trim(), kidsApproved: kids,
      adCategories: categories.length ? categories : ["general"], commercialCategory: categories[0] ?? "general",
    });
    onSaved("Campaign updated locally. Confirm Global saved before closing Admin.");
  }}>
    <h3>{item.title}</h3><p>{runtime(item.duration)} · {item.type === "bumper" ? "Station bumper" : "Commercial"} · {item.allowCommercialSlicing ? "Slicing enabled in Quick Edit" : "Whole ad only"}</p>
    <details><summary>Preview this commercial</summary><video controls preload="none" playsInline src={item.file} aria-label={`Preview ${item.title}`} /></details>
    <div className="ttv-admin-form-grid">
      <label>Advertiser<input value={advertiser} maxLength={140} onChange={e => setAdvertiser(e.target.value)} /></label>
      <label>Campaign name<input value={campaign} maxLength={140} onChange={e => setCampaign(e.target.value)} /></label>
    </div>
    <fieldset><legend>Where can this commercial run?</legend>
      <label><select aria-label="Commercial reach" value={mode} onChange={e => setMode(e.target.value)}><option value="selected">Selected channels</option><option value="all">All channels that accept network ads</option></select></label>
      {mode === "selected" ? <div className="ttv-admin-check-grid">{channels.map(channel => <label key={channel.id}><input type="checkbox" checked={targets.includes(channel.id)} onChange={() => setTargets(toggle(targets, channel.id))} />{channelName(channel)}{channel.kidsApproved ? " · Kids reviewed" : ""}</label>)}</div> : <p className="ttv-admin-notice">Network targeting also includes future channels that accept global ads. Unreviewed ads can remove an otherwise approved channel from Kids profiles.</p>}
      {mode === "selected" && !targets.length ? <p>No channel selected: this ad is paused. The video stays in your library.</p> : null}
    </fieldset>
    <fieldset><legend>Allowed breaks</legend><div className="ttv-admin-check-grid">{placements.map(placement => <label key={placement.id}><input type="checkbox" checked={allowed.includes(placement.id)} onChange={() => setAllowed(toggle(allowed, placement.id))} />{placement.label}</label>)}</div><p>The channel must allow the same placement and have a saved break with enough time.</p></fieldset>
    <details><summary>Campaign days & categories</summary>
      <div className="ttv-admin-check-grid">{days.map(day => <label key={day}><input type="checkbox" checked={campaignDays.includes(day)} onChange={() => setCampaignDays(toggle(campaignDays, day))} />{day}</label>)}</div>
      <p>No days selected means every day. The scheduler uses each viewer’s local broadcast day, not a single station timezone.</p>
      {item.adStartTime || item.adEndTime ? <p className="ttv-admin-notice">This ad has existing time restrictions. The live schedule evaluates them at the start of the broadcast day; they do not guarantee hour-by-hour rotation.</p> : null}
      <label>Categories, separated by commas<input value={category} maxLength={240} onChange={e => setCategory(e.target.value)} /></label>
    </details>
    <label className="ttv-admin-check"><input type="checkbox" checked={kids} onChange={e => setKids(e.target.checked)} />I have watched this entire commercial and approve it for Kids profiles.</label>
    <button className="ttv-action-button" type="submit">Save campaign</button>
  </form>;
}

function ChannelPolicyEditor({ channel, onSaved }: { channel: Channel; onSaved: (text: string) => void }) {
  const [enabled, setEnabled] = useState(channel.adPolicy?.enabled !== false);
  const [global, setGlobal] = useState(channel.adPolicy?.allowGlobalAds === true);
  const [targeted, setTargeted] = useState(channel.adPolicy?.allowChannelTargetedAds !== false);
  const [allowed, setAllowed] = useState<AdPlacement[]>(channel.adPolicy?.placements ?? placements.map(item => item.id));
  const [categories, setCategories] = useState((channel.adPolicy?.allowedCategories ?? []).join(", "));
  return <details className="ttv-admin-card"><summary>Channel commercial permissions</summary><form onSubmit={event => {
    event.preventDefault();
    if (enabled && !allowed.length) { onSaved("Choose a placement or turn commercials off for this channel."); return; }
    useStore.getState().updateChannelSettings(channel.id, { adPolicy: {
      enabled, allowGlobalAds: global, allowChannelTargetedAds: targeted, placements: allowed,
      allowedCategories: categories.split(",").map(value => value.trim()).filter(Boolean),
    } });
    onSaved("Channel permissions updated locally. Confirm Global saved before closing Admin.");
  }}>
    <label className="ttv-admin-check"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Allow commercials on this channel</label>
    <label className="ttv-admin-check"><input type="checkbox" checked={targeted} onChange={e => setTargeted(e.target.checked)} />Accept ads specifically assigned to this channel</label>
    <label className="ttv-admin-check"><input type="checkbox" checked={global} onChange={e => setGlobal(e.target.checked)} />Accept network-wide ads</label>
    <fieldset><legend>Channel placements</legend>{placements.map(placement => <label className="ttv-admin-check" key={placement.id}><input type="checkbox" checked={allowed.includes(placement.id)} onChange={() => setAllowed(toggle(allowed, placement.id))} />{placement.label}</label>)}</fieldset>
    <label>Allowed categories<input value={categories} maxLength={240} placeholder="Blank allows all categories" onChange={e => setCategories(e.target.value)} /></label>
    <button type="submit" className="ttv-action-button">Save channel permissions</button>
  </form></details>;
}

export default function CommercialsPanel() {
  const media = useStore(state => state.media);
  const channels = useStore(state => state.channels);
  const currentChannel = useStore(state => state.currentChannelId);
  const [channelId, setChannelId] = useState(currentChannel);
  const [adId, setAdId] = useState("");
  const [search, setSearch] = useState("");
  const [upload, setUpload] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [message, setMessage] = useState("");
  const [previewTime, setPreviewTime] = useState(localNow);
  const [preview, setPreview] = useState<{ items: BroadcastItem[]; media: MediaItem[]; channels: Channel[]; time: string } | null>(null);
  const ads = useMemo(() => media.filter(isCommercial), [media]);
  const filtered = ads.filter(item => `${item.title} ${item.advertiserName ?? ""} ${item.campaignName ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const selected = ads.find(item => item.id === adId) ?? filtered[0];
  const channel = channels.find(item => item.id === channelId) ?? channels[0];
  const plan = useMemo(() => channel ? planEndBreaks(media, channels, channel.id, seconds) : null, [media, channels, channel, seconds]);
  const kidsIssues = channel?.kidsApproved ? kidsChannelReview(channel, media) : [];
  const stalePreview = preview && (preview.media !== media || preview.channels !== channels || preview.time !== previewTime);
  return <section className="ttv-commercials" aria-label="Commercials workspace">
    <header className="ttv-admin-card"><span className="ttv-admin-eyebrow">Commercials & station promos</span><h2>Upload it. Assign it. See it on the schedule.</h2><p>Commercials live in a separate inventory. A matching channel, permitted placement, campaign window and available break are all required.</p>
      <ol className="ttv-admin-steps"><li><strong>1. Upload</strong><span>Choose Commercial, upload, confirm runtime, then Add Media.</span></li><li><strong>2. Assign</strong><span>Select channels and review Kids suitability.</span></li><li><strong>3. Schedule</strong><span>Create end breaks, then preview before leaving Admin.</span></li></ol>
      <button type="button" className="ttv-action-button" onClick={() => setUpload(!upload)}>{upload ? "Back to commercial inventory" : "Upload a commercial"}</button>
    </header>
    {upload ? <UploadPanel initialType="commercial" /> : <>
      <div className="ttv-admin-workspace-grid">
        <aside className="ttv-admin-card"><h3>Your commercial inventory</h3><p>{ads.length} commercial{ads.length === 1 ? "" : "s"} and bumper{ads.length === 1 ? "" : "s"}</p>
          <label>Find a commercial<input type="search" value={search} onChange={e => { setSearch(e.target.value); setAdId(""); }} placeholder="Title, advertiser or campaign" /></label>
          <label>Choose commercial<select size={Math.min(8, Math.max(2, filtered.length))} value={selected?.id ?? ""} onChange={e => setAdId(e.target.value)}>{filtered.map(item => <option key={item.id} value={item.id}>{item.title}{!item.adChannelIds?.length ? " · Paused" : ""}</option>)}</select></label>
          {!filtered.length ? <p>{ads.length ? "No matches. Try a different search." : "Upload your first commercial to get started."}</p> : null}
          <p>Save before choosing another commercial. Saving a campaign does not add it to a programme playlist or guarantee a paid impression.</p>
        </aside>
        {selected ? <CampaignEditor key={`${selected.id}:${selected.updatedAt ?? ""}`} item={selected} channels={channels} onSaved={setMessage} /> : <div className="ttv-admin-card"><h3>Ready for your first campaign</h3><p>Use Upload a commercial above. Existing videos can also be changed to Commercial in Quick Edit.</p></div>}
      </div>
      <div className="ttv-admin-card"><h3>Channel break setup</h3><label>Commercial channel<select value={channel?.id ?? ""} onChange={e => { setChannelId(e.target.value); setPreview(null); }}>{channels.map(item => <option key={item.id} value={item.id}>{channelName(item)}</option>)}</select></label>
        {channel ? <><p>{channel.isEnabled === false ? "This channel is off air." : "This channel is on air."} {channel.adPolicy?.enabled === false ? "Commercials are currently disabled." : "Commercials are allowed where configured."}</p>
          {kidsIssues.length ? <p className="ttv-admin-notice">Kids review needed: {kidsIssues.join("; ")}. Use Audience & Channels to review the lineup.</p> : null}
          <div className="ttv-admin-form-grid"><div><label>End-break target<select value={seconds} onChange={e => setSeconds(Number(e.target.value))}>{[15,30,60,90,120,180,300].map(value => <option key={value} value={value}>{runtime(value)}</option>)}</select></label><p>Adds up to this much ad time after unconfigured shows and movies. Whole ads must fit; unfilled time is not padded with a blank screen. Mid-show cuts stay under your control in Quick Edit.</p></div><div><h4>{plan?.updates.length ?? 0} programmes ready to configure</h4><p>{plan?.skipped.length ?? 0} skipped: existing timing, shared programmes or missing media.</p><button type="button" className="ttv-action-button" disabled={!plan?.updates.length} onClick={() => {
            const count = plan?.updates.length ?? 0;
            useStore.setState(state => applyEndBreaks(state.media, state.channels, channel.id, seconds));
            setMessage(`Configured ${count} programmes and enabled targeted end-break ads on ${channelName(channel)}. Confirm Global saved, then preview the schedule.`);
          }}>Apply end breaks & enable targeted ads</button></div></div>
          <details><summary>Review affected programmes before applying</summary><ul>{plan?.updates.map(item => <li key={item.id}>{item.title} · {runtime(item.duration)} → {runtime(item.slotLengthSeconds!)}</li>)}{plan?.skipped.map((item, index) => <li key={index}>{item.title} — {item.reason}</li>)}</ul><p>Existing settings are preserved. Shared titles must be edited individually because their timing also affects other channels. This changes upcoming schedule timing.</p></details>
        </> : <p>Create a channel first.</p>}
      </div>
      {channel ? <ChannelPolicyEditor key={JSON.stringify([channel.id, channel.adPolicy])} channel={channel} onSaved={setMessage} /> : null}
      <section className="ttv-admin-card" aria-label="Commercial schedule preview"><h3>Check what will actually air</h3><p>Uses the same playlist order and local broadcast-day anchor as the live player. It does not start playback or change the station.</p>
        <div className="ttv-admin-form-grid"><label>Preview broadcast date<input type="date" value={previewTime} onChange={e => setPreviewTime(e.target.value)} /></label><button type="button" className="ttv-action-button" disabled={!channel} onClick={() => {
          const now = createBroadcastDayAnchor(new Date(`${previewTime}T00:00:00`));
          if (!Number.isFinite(now.getTime()) || !channel) { setMessage("Choose a valid preview date."); return; }
          const programmes = getMediaForChannel(channel, new Map(media.map(item => [item.id, item])));
          setPreview({ items: buildSchedule(programmes, { channel, now, availableAds: ads }), media, channels, time: previewTime });
        }}>Generate schedule preview</button></div>
        {stalePreview ? <p className="ttv-admin-notice">Settings changed. Generate a fresh preview.</p> : null}
        {preview && !stalePreview ? <><p>{preview.items.filter(isCommercial).length} commercial segments in this schedule. Showing the first 60 entries from the schedule start, not a guarantee of the next live item.</p>
          {!preview.items.some(isCommercial) ? <p className="ttv-admin-notice">No commercials scheduled. Check channel permissions, ad targeting, placement, campaign days/window, categories and runtime. An ad longer than a break will not fit unless slicing is explicitly enabled in Quick Edit.</p> : null}
          <ol className="ttv-admin-preview">{preview.items.slice(0,60).map((item,index) => <li key={`${index}:${item.id}`} data-commercial={isCommercial(item)}><strong>{isCommercial(item) ? "AD" : "SHOW"}</strong><span>{item.title}</span><span>{runtime(item.duration)}</span></li>)}</ol>
        </> : null}
      </section>
    </>}
    <p className="ttv-admin-feedback" role="status" aria-live="polite">{message || "Changes save locally first. Global saved confirms the station received them."}</p>
  </section>;
}
