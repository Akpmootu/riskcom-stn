export type IncidentPhase = "before" | "during" | "after";

export type MediaItem = {
  id: string;
  title: string;
  description: string;
  phase: IncidentPhase;
  category: string;
  eventDate: string;
  location: string;
  keywords: string[];
  altText: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  driveFileId?: string;
  fileName: string;
  fileType: string;
  status: "published" | "draft";
  createdAt: string;
};

export type MediaResponse = {
  items: MediaItem[];
  source: "google" | "demo";
  message?: string;
};
