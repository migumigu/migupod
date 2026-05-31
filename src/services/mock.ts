import { MediaConfig, MediaItem } from '../types';

const MOCK_AUDIO_URLS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
];

const generateMockAlbums = (): MediaItem[] => {
  return Array.from({ length: 12 }, (_, i) => ({
    Id: `mock-album-${i + 1}`,
    Name: `Mock Album ${i + 1}`,
    AlbumArtist: ['Mock Artist', 'Test Band', 'Demo Singer'][i % 3],
    Type: 'MusicAlbum',
    ProductionYear: 2020 + (i % 5),
    DateCreated: new Date(2023, i % 12, 15).toISOString(),
    ImageTags: { Primary: `https://picsum.photos/seed/album${i + 1}/400/400` },
  }));
};

const generateMockArtists = (): MediaItem[] => {
  return Array.from({ length: 10 }, (_, i) => ({
    Id: `mock-artist-${i + 1}`,
    Name: ['Mock Artist', 'Test Band', 'Demo Singer', 'Sample Group', 'Studio Project'][i % 5] + ` ${Math.floor(i / 5) + 1}`,
    Type: 'MusicArtist',
    DateCreated: new Date(2022, (i + 3) % 12, 10).toISOString(),
    ImageTags: { Primary: `https://picsum.photos/seed/artist${i + 1}/400/400` },
  }));
};

const generateMockPlaylists = (): MediaItem[] => {
  return Array.from({ length: 6 }, (_, i) => ({
    Id: `mock-playlist-${i + 1}`,
    Name: ['Favorites', 'Workout Mix', 'Chill Vibes', 'Party Hits', 'Focus', 'Night Drive'][i % 6],
    AlbumArtist: 'You',
    Type: 'Playlist',
    DateCreated: new Date(2024, i, 1).toISOString(),
    ImageTags: { Primary: `https://picsum.photos/seed/playlist${i + 1}/400/400` },
  }));
};

const generateMockSongs = (parentItem: MediaItem): MediaItem[] => {
  const songCount = parentItem.Type === 'Playlist' ? 20 : 10 + Math.floor(Math.random() * 5);
  return Array.from({ length: songCount }, (_, i) => ({
    Id: `mock-song-${parentItem.Id}-${i + 1}`,
    Name: `${parentItem.Name} - Track ${i + 1}`,
    AlbumArtist: parentItem.AlbumArtist || 'Mock Artist',
    Album: parentItem.Type === 'MusicAlbum' ? parentItem.Name : 'Mock Album',
    Type: 'Audio',
    RunTimeTicks: (180 + Math.floor(Math.random() * 120)) * 10000000,
    IndexNumber: i + 1,
    AlbumId: parentItem.Type === 'MusicAlbum' ? parentItem.Id : `mock-album-${(i % 3) + 1}`,
    HasLyrics: Math.random() > 0.3,
    Thumb: `https://picsum.photos/seed/song${parentItem.Id}${i + 1}/400/400`,
    Key: `/mock/stream/${parentItem.Id}/${i + 1}`,
    ImageTags: { Primary: `https://picsum.photos/seed/song${parentItem.Id}${i + 1}/400/400` },
  }));
};

const MOCK_LYRICS = `[00:00.00]Welcome to MiguPod Mock
[00:03.50]This is a sample lyric line
[00:07.00]Testing the sync display
[00:10.50]Everything works great!
[00:14.00]Enjoy your music
[00:17.50]With smooth animations
[00:21.00]And beautiful covers
[00:24.50]In vertical flow
[00:28.00]...`;

export const getMockImageUrl = (_config: MediaConfig, itemId: string, _tag: string, _type: 'Primary' | 'Backdrop' = 'Primary') => {
  const seed = itemId.replace(/[^a-zA-Z0-9]/g, '');
  return `https://picsum.photos/seed/${seed}/400/400`;
};

export const getMockPlexImageUrl = (_config: MediaConfig, thumb: string, _width = 600, _height = 600) => {
  if (thumb && thumb.startsWith('http')) return thumb;
  const seed = thumb || 'default';
  return `https://picsum.photos/seed/${seed.replace(/[^a-zA-Z0-9]/g, '')}/400/400`;
};

export const fetchMockItems = async (_config: MediaConfig, type: 'MusicAlbum' | 'MusicArtist' | 'Playlist') => {
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
  
  if (type === 'MusicAlbum') return generateMockAlbums();
  if (type === 'MusicArtist') return generateMockArtists();
  if (type === 'Playlist') return generateMockPlaylists();
  return [];
};

export const getMockStreamUrl = (_config: MediaConfig, itemId: string) => {
  const index = parseInt(itemId.match(/\d+/)?.[0] || '0') % MOCK_AUDIO_URLS.length;
  return MOCK_AUDIO_URLS[index];
};

export const getMockPlexStreamUrl = (_config: MediaConfig, _key: string) => {
  return MOCK_AUDIO_URLS[0];
};

export const validateMockConnection = async (_serverUrl: string, _apiKey: string) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return 'mock-user-id';
};

export const fetchMockSongsForItem = async (_config: MediaConfig, item: MediaItem) => {
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  return generateMockSongs(item);
};

export const fetchMockPlexSongs = async (_config: MediaConfig, item: MediaItem) => {
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  return generateMockSongs(item);
};

export const fetchMockLyrics = async (_config: MediaConfig, _itemId: string) => {
  await new Promise(resolve => setTimeout(resolve, 150));
  return MOCK_LYRICS;
};

export const fetchMockPlexLyrics = async (_config: MediaConfig, _trackId: string) => {
  await new Promise(resolve => setTimeout(resolve, 150));
  return MOCK_LYRICS;
};
