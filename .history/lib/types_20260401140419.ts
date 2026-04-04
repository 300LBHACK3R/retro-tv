export type MediaType = "show" | "commercial" | "movie" | "bumper";

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  duration: number;
  file: string;
}

export interface Channel {
  id: string;
  name: string;
  mediaIds: string[];
}