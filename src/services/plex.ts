import { MediaConfig, MediaItem } from '../types';

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

export const getPlexImageUrl = (config: MediaConfig, thumb: string, width = 600, height = 600) => {
  const baseUrl = normalizeUrl(config.serverUrl);
  return `${baseUrl}/photo/:/transcode?url=${encodeURIComponent(thumb)}&width=${width}&height=${height}&minSize=1&upscale=1&X-Plex-Token=${config.apiKey}`;
};

export const getPlexStreamUrl = (config: MediaConfig, key: string) => {
  const baseUrl = normalizeUrl(config.serverUrl);
  // Using universal transcoder for better compatibility
  return `${baseUrl}${key}?X-Plex-Token=${config.apiKey}`;
};

export const validatePlexConnection = async (serverUrl: string, apiKey: string) => {
  const baseUrl = normalizeUrl(serverUrl);
  const response = await fetch(`${baseUrl}/library/sections?X-Plex-Token=${apiKey}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) throw new Error('Invalid Plex Server URL or Token');
  const data = await response.json();
  const musicLibrary = data.MediaContainer.Directory.find((d: any) => d.type === 'artist');
  if (!musicLibrary) throw new Error('No Music Library found on this Plex server');
  return musicLibrary.key; // Return the section ID
};

export const fetchPlexItems = async (config: MediaConfig, type: 'MusicAlbum' | 'MusicArtist' | 'Playlist') => {
  const baseUrl = normalizeUrl(config.serverUrl);
  const sectionId = config.userId; // We store sectionId in userId field for Plex
  
  let endpoint = '';
  if (type === 'MusicAlbum') endpoint = `/library/sections/${sectionId}/all?type=9`; // 9 = Album
  else if (type === 'MusicArtist') endpoint = `/library/sections/${sectionId}/all?type=8`; // 8 = Artist
  else if (type === 'Playlist') endpoint = `/playlists/all?playlistType=audio`;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: { 'Accept': 'application/json', 'X-Plex-Token': config.apiKey }
  });
  
  if (!response.ok) throw new Error('Failed to fetch from Plex');
  const data = await response.json();
  const items = data.MediaContainer.Metadata || data.MediaContainer.Playlist || [];

  return items.map((item: any) => ({
    Id: item.ratingKey,
    Name: item.title,
    AlbumArtist: item.parentTitle || item.title,
    Type: type,
    Thumb: item.thumb,
    Key: item.key,
    DateCreated: item.addedAt ? new Date(item.addedAt * 1000).toISOString() : undefined,
    ProductionYear: item.year,
    ImageTags: { Primary: item.thumb }
  })) as MediaItem[];
};

export const fetchPlexSongs = async (config: MediaConfig, item: MediaItem) => {
  const baseUrl = normalizeUrl(config.serverUrl);
  
  let endpoint = '';
  if (item.Type === 'MusicAlbum') endpoint = `/library/metadata/${item.Id}/children`;
  else if (item.Type === 'MusicArtist') endpoint = `/library/metadata/${item.Id}/allLeaves`;
  else if (item.Type === 'Playlist') endpoint = item.Key!;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: { 'Accept': 'application/json', 'X-Plex-Token': config.apiKey }
  });

  if (!response.ok) throw new Error('Failed to fetch songs from Plex');
  const data = await response.json();
  const tracks = data.MediaContainer.Metadata || [];

  return tracks.map((track: any) => ({
    Id: track.ratingKey,
    Name: track.title,
    AlbumArtist: track.grandparentTitle || track.parentTitle,
    Type: 'Audio',
    Thumb: track.thumb || item.Thumb,
    RunTimeTicks: track.duration * 10000, // Plex is ms, Emby is ticks (100ns)
    IndexNumber: track.index,
    Key: track.Media?.[0]?.Part?.[0]?.key,
    ImageTags: { Primary: track.thumb || item.Thumb },
    HasLyrics: track.Media?.[0]?.Part?.[0]?.Stream?.some((s: any) => s.streamType === 4)
  })) as MediaItem[];
};

export const fetchPlexLyrics = async (config: MediaConfig, trackId: string) => {
  const baseUrl = normalizeUrl(config.serverUrl);
  // Plex lyrics are often served via the metadata children or a specific stream
  // This is a simplified attempt to find lyric streams
  const response = await fetch(`${baseUrl}/library/metadata/${trackId}?X-Plex-Token=${config.apiKey}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) return null;
  const data = await response.json();
  const track = data.MediaContainer.Metadata?.[0];
  const lyricStream = track?.Media?.[0]?.Part?.[0]?.Stream?.find((s: any) => s.streamType === 4);
  
  if (lyricStream && lyricStream.key) {
    const lyricRes = await fetch(`${baseUrl}${lyricStream.key}?X-Plex-Token=${config.apiKey}`);
    if (lyricRes.ok) return await lyricRes.text();
  }
  return null;
};
