import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type { AccountView, Household } from "../accountModel";
import { defaults } from "../profiles";
import { buildLibrary } from "../libraryCatalog";
import { viewerCatalog } from "../audience";
import { isThemeId } from "../themes";
import { accountView } from "./accountData";
import { createSupabaseAdminClient } from "./supabaseAdmin";
import { readStationProgramming } from "./stationHealth";
import { UUID, verifiedSessionId } from "./accountDevices";

export class ViewingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function viewingProfiles(view: AccountView) {
  return (view.household?.profiles ?? defaults.filter(p => !p.kids)).slice(0, view.profileLimit);
}
function mac(value: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!).update(`viewing:${value}`).digest("hex");
}
export function viewingGrant(view: AccountView, token: string, profileId: string) {
  const session = verifiedSessionId(token, view.user!.id);
  if (!session) throw new ViewingError("Please sign in again.", 401);
  const payload = Buffer.from(JSON.stringify({ user: view.user!.id, session, profileId, kids: !!profileIn(view, profileId).kids,
    pin: mac(JSON.stringify(view.household?.pin ?? null)), expires: Date.now() + 43_200_000 })).toString("base64url");
  return `${payload}.${mac(payload)}`;
}
export function validViewingGrant(value: unknown, view: AccountView, token: string, profileId: string) {
  if (typeof value !== "string" || value.length > 2000) return false;
  const [payload, signature, extra] = value.split(".");
  if (extra || !payload || !/^[a-f0-9]{64}$/.test(signature ?? "")) return false;
  if (!timingSafeEqual(Buffer.from(signature!, "hex"), Buffer.from(mac(payload), "hex"))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.user === view.user?.id && data.session === verifiedSessionId(token, view.user!.id)
      && data.profileId === profileId && data.kids === !!profileIn(view, profileId).kids && data.pin === mac(JSON.stringify(view.household?.pin ?? null)) && data.expires > Date.now();
  } catch { return false; }
}
function profileIn(view: AccountView, id: unknown) {
  const profile = viewingProfiles(view).find(p => p.id === id);
  if (!profile) throw new ViewingError("Choose an available household profile.", 403);
  return profile;
}
async function readProfileProgress(userId: string, profileId: string) {
  const db = createSupabaseAdminClient();
  const pageSize = 300;
  const rows: { media_id: string; position: number; duration: number; revision: number; updated_at: string }[] = [];
  let after = "";
  while (true) {
    // Use a stable key so a concurrent bookmark update cannot move a row between pages.
    const query = db.from("ttv_profile_progress").select("media_id,position,duration,revision,updated_at")
      .eq("user_id", userId).eq("profile_id", profileId).order("media_id").limit(pageSize);
    const { data, error } = await (after ? query.gt("media_id", after) : query);
    if (error) throw new ViewingError("Saved viewing is temporarily unavailable.", 503);
    rows.push(...data);
    if (data.length < pageSize) return rows;
    after = data[data.length - 1]!.media_id;
  }
}
export async function readViewing(view: AccountView, profileId: string) {
  const profile = profileIn(view, profileId);
  const [progressRows, snapshot] = await Promise.all([
    readProfileProgress(view.user!.id, profile.id),
    readStationProgramming(),
  ]);
  if (!snapshot) throw new ViewingError("Saved viewing is temporarily unavailable.", 503);
  const visible = viewerCatalog(snapshot.channels, snapshot.media, !!profile.kids);
  const groups = buildLibrary(visible.media, snapshot.libraryArtwork, !!profile.kids);
  const media = new Set(groups.flatMap(g => g.items.map(i => i.media.id)));
  const channels = new Set(visible.channels.filter(c => c.isEnabled !== false).map(c => c.id));
  const keys = new Set(groups.flatMap(g => [g.key, ...g.aliasKeys]));
  const saved = view.household?.library[profile.id];
  const progress = Object.fromEntries(progressRows.filter(r => media.has(r.media_id)).map(r => [r.media_id, {
    position: r.position, duration: r.duration, revision: Number(r.revision), updatedAt: Date.parse(r.updated_at),
  }]));
  return { progress, favouriteChannels: (saved?.favouriteChannels ?? []).filter(id => channels.has(id)),
    watchlist: groups.filter(group => (saved?.watchlist ?? []).some(id => keys.has(id) && (group.key === id || group.aliasKeys.includes(id)))).map(group => group.key), revision: view.revision, profileId: profile.id };
}
export async function mutateViewing(user: User, input: Record<string, unknown>, initial: AccountView) {
  const profile = profileIn(initial, input.profileId);
  const db = createSupabaseAdminClient();
  if (input.action === "progress") {
    const { mediaId, position, duration, revision, playbackId, sequence } = input;
    if (typeof mediaId !== "string" || mediaId.length > 240 ||
      typeof position !== "number" || !Number.isFinite(position) || position < 0 ||
      typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0 || duration > 604800 || position > duration ||
      !Number.isSafeInteger(revision) || Number(revision) < 0 || !Number.isSafeInteger(sequence) || Number(sequence) < 0 || Number(sequence) > 2147483647 ||
      typeof playbackId !== "string" || !UUID.test(playbackId)) throw new ViewingError("Invalid viewing progress.");
    const snapshot = await readStationProgramming();
    if (!snapshot) throw new ViewingError("The library is temporarily unavailable.", 503);
    const media = buildLibrary(snapshot.media, snapshot.libraryArtwork, !!profile.kids).flatMap(g => g.items).find(i => i.media.id === mediaId);
    if (!media) throw new ViewingError("This title is not available for that profile.", 404);
    const { data, error } = await db.rpc("ttv_save_progress", { p_user: user.id, p_profile: profile.id,
      p_media: mediaId, p_position: position, p_duration: duration, p_revision: revision, p_playback: playbackId, p_sequence: sequence });
    if (error) throw new ViewingError("Your progress could not be saved. Try again shortly.", 503);
    if (!data.accepted) throw new ViewingError("Another screen saved newer progress. Reload before continuing.", 409);
    return { revision: Number(data.entry.revision), updatedAt: Date.parse(data.entry.updated_at) };
  }
  if (input.action !== "saved" && input.action !== "theme") throw new ViewingError("Choose a supported viewing action.");
  if (input.action === "saved" && (!['watchlist', 'favouriteChannels'].includes(String(input.kind)) ||
    typeof input.id !== "string" || input.id.length > 240 || typeof input.saved !== "boolean")) throw new ViewingError("Invalid saved item.");
  for (let attempt = 0; attempt < 3; attempt++) {
    const view = attempt ? await accountView(user) : initial;
    const currentProfile = profileIn(view, profile.id);
    const household: Household = view.household ?? { profiles: viewingProfiles(view), pin: null, library: {}, showMemberBadge: false };
    if (input.action === "theme") {
      if (!isThemeId(input.themeId) || !view.ownedThemeIds.includes(input.themeId)) throw new ViewingError("This theme isn't available on your account.", 403);
      household.profiles = household.profiles.map(p => p.id === profile.id ? { ...p, theme: input.themeId as typeof p.theme } : p);
    } else {
      const snapshot = await readStationProgramming();
      if (!snapshot) throw new ViewingError("The library is temporarily unavailable.", 503);
      const visible = viewerCatalog(snapshot.channels, snapshot.media, !!currentProfile.kids);
      const group = input.kind === "watchlist" ? buildLibrary(visible.media, snapshot.libraryArtwork, !!currentProfile.kids).find(g => g.key === input.id || g.aliasKeys.includes(String(input.id))) : undefined;
      const channel = input.kind === "favouriteChannels" ? visible.channels.find(c => c.id === input.id && c.isEnabled !== false) : undefined;
      if (input.saved && !group && !channel) throw new ViewingError("This item isn't available for that profile.", 404);
      const key = group?.key ?? String(input.id);
      const kind = input.kind as "watchlist" | "favouriteChannels";
      const saved = household.library[profile.id] ?? { watchlist: [], favouriteChannels: [] };
      const aliases = new Set([key, ...(group?.aliasKeys ?? [])]);
      const ids = saved[kind].filter(id => !aliases.has(id));
      saved[kind] = input.saved ? [key, ...ids].slice(0, 500) : ids;
      household.library = { ...household.library, [profile.id]: saved };
    }
    const result = await db.from("ttv_accounts").update({ household, revision: view.revision + 1 })
      .eq("user_id", user.id).eq("revision", view.revision).select("revision").maybeSingle();
    if (result.error) throw new ViewingError("Your preferences could not be saved.", 503);
    if (result.data) return { revision: Number(result.data.revision) };
  }
  throw new ViewingError("Another screen is updating this profile. Try again.", 409);
}
