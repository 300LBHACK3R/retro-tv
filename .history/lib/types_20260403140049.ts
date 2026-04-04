export type MediaType = "show" | "commercial" | "movie" | "bumper";
export type AppMode = "viewer" | "admin";

export interface ChannelBranding {
  displayName: string;
  callsign: string;
  description: string;
  accentColor: string;
  logoText: string;
}

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  duration: number;
  file: string;
  storageKey?: string;
  mimeType?: string;
  originalName?: string;
  isBroken?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  mediaIds: string[];
  branding?: ChannelBranding;
}