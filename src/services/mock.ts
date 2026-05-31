import type { MediaItem, Album, Artist, Song, Playlist } from '../types';

// Mock data
const MOCK_ALBUMS: Album[] = Array.from({ length: 12 }, (_, i) => ({
  Id: `mock-album-${i}`,
  Name: `Mock Album ${i + 1}`,
  AlbumArtist: `Mock Artist ${((i % 3) + 1)}`,
  ProductionYear: 2020 + (i % 5),
  ImageTags: {
    Primary: `https://picsum.photos/seed/album-${i + 1}/400/400`,
  },
  Type: 'MusicAlbum',
}));

const MOCK_ARTISTS: Artist[] = Array.from({ length: 10 }, (_, i) => ({
  Id: `mock-artist-${i}`,
  Name: `Mock Artist ${i + 1}`,
  ImageTags: {
    Primary: `https://picsum.photos/seed/artist-${i + 1}/400/400`,
  },
  Type: 'MusicArtist',
}));

const MOCK_PLAYLISTS: Playlist[] = Array.from({ length: 6 }, (_, i) => ({
  Id: `mock-playlist-${i}`,
  Name: `Mock Playlist ${i + 1}`,
  ImageTags: {
    Primary: `https://picsum.photos/seed/playlist-${i + 1}/400/400`,
  },
  Type: 'Playlist',
}));

// Generate songs for an album
const generateSongs = (albumId: string, count: number = 10): Song[] => {
  return Array.from({ length: count }, (_, i) => ({
    Id: `${albumId}-song-${i}`,
    Name: `Mock Song ${i + 1}`,
    Artists: ['Mock Artist'],
    Album: 'Mock Album',
    AlbumId: albumId,
    IndexNumber: i + 1,
    RunTimeTicks: 1800000000, // 3 minutes
    Type: 'Audio',
  }));
};

// Mock lyrics
const MOCK_LYRICS = `[00:00.00]Mock lyric line 1
[00:02.50]Mock lyric line 2
[00:05.00]Mock lyric line 3
[00:07.50]Mock lyric line 4
[00:10.00]Mock lyric line 5`;

// Simulate network delay
const delay = (ms: number = 300) =>
  new Promise(resolve => setTimeout(resolve, ms));

// Mock service implementation
export const mockService = {
  async testConnection() {
    await delay();
    return true;
  },

  async getAllAlbums() {
    await delay();
    return MOCK_ALBUMS;
  },

  async getAllArtists() {
    await delay();
    return MOCK_ARTISTS;
  },

  async getAllPlaylists() {
    await delay();
    return MOCK_PLAYLISTS;
  },

  async getSongs(itemId: string) {
    await delay();
    // If it's a playlist, return more songs
    const isPlaylist = itemId.startsWith('mock-playlist');
    return generateSongs(itemId, isPlaylist ? 20 : 10);
  },

  async getAudioStreamUrl(songId: string) {
    // Return a free audio sample
    return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  },

  async getLyrics(songId: string) {
    await delay(200);
    return MOCK_LYRICS;
  },
};
