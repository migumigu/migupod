const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

import * as embyReal from './emby';
import * as plexReal from './plex';

import * as mock from './mock';

const embyMock = {
  getImageUrl: mock.getMockImageUrl,
  fetchEmbyItems: mock.fetchMockItems,
  getStreamUrl: mock.getMockStreamUrl,
  validateEmbyConnection: mock.validateMockConnection,
  fetchSongsForItem: mock.fetchMockSongsForItem,
  fetchEmbyLyrics: mock.fetchMockLyrics,
};

const plexMock = {
  getPlexImageUrl: mock.getMockPlexImageUrl,
  fetchPlexItems: mock.fetchMockItems,
  getPlexStreamUrl: mock.getMockPlexStreamUrl,
  validatePlexConnection: mock.validateMockConnection,
  fetchPlexSongs: mock.fetchMockPlexSongs,
  fetchPlexLyrics: mock.fetchMockPlexLyrics,
};

export const emby = USE_MOCK ? embyMock : embyReal;
export const plex = USE_MOCK ? plexMock : plexReal;

export const isMockMode = () => USE_MOCK;
