"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshAccount } from "@/lib/accountSync";
import { accountRequest } from "@/lib/accountStore";
type Device = { id: string; name: string; kind: string; lastSeenAt: string; current: boolean };
export default function AccountDevices() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState("");
  const load = useCallback(async () => {
    try { const data = await accountRequest("/api/account/devices", undefined, "GET"); setDevices(data.devices); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Devices could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function change(id: string, action: "rename" | "revoke", name?: string) {
    setBusy(id); setError("");
    try {
      const result = await accountRequest("/api/account/devices", { id, action, name });
      if (result.signedOut) { await refreshAccount(true); router.replace("/account"); router.refresh(); return; }
      setConfirm(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "The device could not be updated."); }
    finally { setBusy(""); }
  }
  return <section id="your-devices" className="ttv-account-card">
    <p className="ttv-account-eyebrow">Connected screens</p><h2>Your devices</h2>
    <p>Name your screens so they’re easy to recognise. Signing out removes account access when that device next connects. An offline TV may keep playing until it reconnects.</p>
    {error ? <p role="alert">{error} <button onClick={() => void load()}>Refresh devices</button></p> : null}
    {loading ? <p role="status">Loading devices…</p> : devices.length === 0 ? <p>No connected devices were found.</p> : null}
    <ul className="ttv-device-list">{devices.map(device => <li key={device.id}>
      <form onSubmit={event => { event.preventDefault(); void change(device.id, "rename", String(new FormData(event.currentTarget).get("name"))); }}>
        <label>Device name <input name="name" defaultValue={device.name} maxLength={60} required aria-label={`Name for ${device.name}`} /></label>
        <p>{device.kind === "roku" ? "Roku" : "Web browser"}{device.current ? " · This device" : ""} · Last active <time dateTime={device.lastSeenAt}>{new Date(device.lastSeenAt).toLocaleString()}</time></p>
        <button disabled={!!busy}>Save name</button>{" "}
        <button type="button" disabled={!!busy} onClick={() => setConfirm(device.id)}>Sign out{device.current ? " this device" : ""}</button>
      </form>
      {confirm === device.id ? <div role="group" aria-label={`Sign out ${device.name}`}><p>Sign out {device.name}?</p><button disabled={!!busy} onClick={() => void change(device.id, "revoke")}>Confirm sign out</button>{" "}<button disabled={!!busy} onClick={() => setConfirm("")}>Keep signed in</button></div> : null}
    </li>)}</ul>
  </section>;
}
