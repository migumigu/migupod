import { MediaConfig, MediaItem } from '../types';

export const getImageUrl = (config: MediaConfig, itemId: string, tag: string, type: 'Primary' | 'Backdrop' = 'Primary') => {
  const baseUrl = config.serverUrl.replace(/\/$/, '');
  return `${baseUrl}/emby/Items/${itemId}/Images/${type}?tag=${tag}&maxWidth=1000&quality=100`;
};

export const fetchEmbyItems = async (config: MediaConfig, type: 'MusicAlbum' | 'MusicArtist' | 'Playlist') => {
  const baseUrl = config.serverUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    api_key: config.apiKey,
    IncludeItemTypes: type,
    Recursive: 'true',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    Fields: 'PrimaryImageTag,AlbumArtist,ProductionYear,DateCreated,ArtistId,AlbumArtists',
    Limit: '100',
    ...(type === 'Playlist' ? { MediaType: 'Audio' } : {}),
  });

  const response = await fetch(`${baseUrl}/emby/Users/${config.userId}/Items?${params}`);
  if (!response.ok) throw new Error('Failed to fetch from Emby');
  const data = await response.json();
  return data.Items as MediaItem[];
};

export const getStreamUrl = (config: MediaConfig, itemId: string) => {
  const baseUrl = config.serverUrl.replace(/\/$/, '');
  // Using universal endpoint for better compatibility and transcoding support
  return `${baseUrl}/emby/Audio/${itemId}/universal?api_key=${config.apiKey}&UserId=${config.userId}&DeviceId=emby-flow-web&MaxStreamingBitrate=140000000`;
};

export const validateEmbyConnection = async (serverUrl: string, apiKey: string) => {
  const baseUrl = serverUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/emby/Users?api_key=${apiKey}`);
  if (!response.ok) throw new Error('Invalid server URL or API Key');
  const users = await response.json();
  return users[0]?.Id; // Return first user ID for simplicity in this demo
};

export const fetchSongsForItem = async (config: MediaConfig, item: MediaItem) => {
  const baseUrl = config.serverUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    api_key: config.apiKey,
    Recursive: 'true',
    SortBy: 'ParentIndexNumber,IndexNumber,SortName',
    SortOrder: 'Ascending',
    Fields: 'PrimaryImageTag,AlbumArtist,RunTimeTicks,IndexNumber,AlbumId,Album,HasLyrics',
  });

  let url = '';
  
  if (item.Type === 'MusicAlbum') {
    params.append('ParentId', item.Id);
    params.append('IncludeItemTypes', 'Audio');
    url = `${baseUrl}/emby/Users/${config.userId}/Items?${params}`;
  } else if (item.Type === 'MusicArtist') {
    params.append('ArtistIds', item.Id);
    params.append('IncludeItemTypes', 'Audio');
    url = `${baseUrl}/emby/Users/${config.userId}/Items?${params}`;
  } else if (item.Type === 'Playlist') {
    url = `${baseUrl}/emby/Playlists/${item.Id}/Items?${params}`;
  } else {
    // Fallback for other types if any
    url = `${baseUrl}/emby/Users/${config.userId}/Items?${params}`;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch songs');
  const data = await response.json();
  return data.Items as MediaItem[];
};

export const fetchEmbyLyrics = async (config: MediaConfig, itemId: string) => {
  const baseUrl = config.serverUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/emby/Items/${itemId}/Lyrics?api_key=${config.apiKey}`);
  if (!response.ok) return null;
  const data = await response.json();
  if (data.Lyrics) {
    return data.Lyrics.map((l: any) => l.Text).join('\n');
  }
  return null;
};
