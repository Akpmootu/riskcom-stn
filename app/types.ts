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
  uploadedBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  revisionCount?: number;
};

export type MediaResponse = {
  items: MediaItem[];
  source: "google" | "demo";
  message?: string;
};

export type MediaRevision = {
  id: string;
  mediaId: string;
  editedAt: string;
  editedBy: string;
  changedFields: string[];
  before: Partial<MediaItem>;
  after: Partial<MediaItem>;
};

export type VisitorStats = {
  totalViews: number;
  todayViews: number;
  updatedAt: string;
};
