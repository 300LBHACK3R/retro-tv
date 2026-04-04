export type MediaType = "show" | "commercial" | "movie" | "bumper";

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  duration: number;
  file: string; // object URL used by the app at runtime
  storageKey?: string; // IndexedDB key for restoring after reload
  mimeType?: string;
  originalName?: string;
}

export interface Channel {
  id: string;
  name: string;
  mediaIds: string[];
}