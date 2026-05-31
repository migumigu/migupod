import { embyService } from './emby';
import { plexService } from './plex';
import { mockService } from './mock';
import type { MediaItem, Album, Artist, Song, Playlist } from '../types';

// Define the unified service interface
export interface MediaService {
  testConnection: () => Promise<boolean>;
  getAllAlbums: () => Promise<Album[]>;
  getAllArtists: () => Promise<Artist[]>;
  getAllPlaylists: () => Promise<Playlist[]>;
  getSongs: (itemId: string) => Promise<Song[]>;
  getAudioStreamUrl: (songId: string) => Promise<string>;
  getLyrics: (songId: string) => Promise<string>;
}

// Determine which service to use based on environment
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// Export the service
export const service: MediaService = USE_MOCK 
  ? mockService 
  : (() => {
      // Use the configured service type from localStorage
      const config = JSON.parse(localStorage.getItem('serverConfig') || '{"type":"emby"}');
      return config.type === 'plex' ? plexService : embyService;
    })();
