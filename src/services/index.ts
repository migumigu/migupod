import { mockService } from './mock';
import type { MediaItem, Album, Artist, Song, Playlist } from '../types';

export interface MediaService {
  testConnection: () => Promise<boolean>;
  getAllAlbums: () => Promise<Album[]>;
  getAllArtists: () => Promise<Artist[]>;
  getAllPlaylists: () => Promise<Playlist[]>;
  getSongs: (itemId: string) => Promise<Song[]>;
  getAudioStreamUrl: (songId: string) => Promise<string>;
  getLyrics: (songId: string) => Promise<string>;
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const service: MediaService = USE_MOCK 
  ? mockService 
  : {
      testConnection: async () => false,
      getAllAlbums: async () => [],
      getAllArtists: async () => [],
      getAllPlaylists: async () => [],
      getSongs: async () => [],
      getAudioStreamUrl: async () => '',
      getLyrics: async () => '',
    };
