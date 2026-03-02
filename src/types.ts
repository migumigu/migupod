export type MediaProvider = 'Emby' | 'Plex';

export interface MediaConfig {
  provider: MediaProvider;
  serverUrl: string;
  apiKey: string;
  userId?: string;
}

export interface MediaItem {
  Id: string;
  Name: string;
  AlbumArtist?: string;
  ArtistNames?: string[];
  ImageTags?: {
    Primary?: string;
  };
  Type: string;
  ProductionYear?: number;
  DateCreated?: string;
  ArtistId?: string;
  RunTimeTicks?: number;
  IndexNumber?: number;
  AlbumId?: string;
  Album?: string;
  HasLyrics?: boolean;
  // Plex specific
  RatingKey?: string;
  Thumb?: string;
  Key?: string;
}

export interface LyricLine {
  time: number;
  text: string;
}
