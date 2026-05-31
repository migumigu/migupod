# Mock Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add environment-variable-controlled mock services to enable frontend development and testing without requiring real Emby/Plex servers.

**Architecture:** Create a service factory layer that returns either real or mock implementations based on `VITE_USE_MOCK` environment variable.

**Tech Stack:** React 19, TypeScript, Vite

---

## Task 1: Create Mock Data and Service Implementation

**Files:**
- Create: `src/services/mock.ts`

### Step 1: Create Mock Service File

Create `src/services/mock.ts` with complete mock implementations matching the existing service interfaces:

```typescript
import { MediaConfig, MediaItem, LyricLine } from '../types';

// Sample audio URLs for testing
const MOCK_AUDIO_URLS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
];

// Generate mock albums
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

// Generate mock artists
const generateMockArtists = (): MediaItem[] => {
  return Array.from({ length: 10 }, (_, i) => ({
    Id: `mock-artist-${i + 1}`,
    Name: ['Mock Artist', 'Test Band', 'Demo Singer', 'Sample Group', 'Studio Project'][i % 5] + ` ${Math.floor(i / 5) + 1}`,
    Type: 'MusicArtist',
    DateCreated: new Date(2022, (i + 3) % 12, 10).toISOString(),
    ImageTags: { Primary: `https://picsum.photos/seed/artist${i + 1}/400/400` },
  }));
};

// Generate mock playlists
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

// Generate mock songs for an item
const generateMockSongs = (parentItem: MediaItem): MediaItem[] => {
  const songCount = parentItem.Type === 'Playlist' ? 20 : 10 + Math.floor(Math.random() * 5);
  return Array.from({ length: songCount }, (_, i) => ({
    Id: `mock-song-${parentItem.Id}-${i + 1}`,
    Name: `${parentItem.Name} - Track ${i + 1}`,
    AlbumArtist: parentItem.AlbumArtist || 'Mock Artist',
    Album: parentItem.Type === 'MusicAlbum' ? parentItem.Name : 'Mock Album',
    Type: 'Audio',
    RunTimeTicks: (180 + Math.floor(Math.random() * 120)) * 10000000, // 3-5 minutes
    IndexNumber: i + 1,
    AlbumId: parentItem.Type === 'MusicAlbum' ? parentItem.Id : `mock-album-${(i % 3) + 1}`,
    HasLyrics: Math.random() > 0.3,
    Thumb: `https://picsum.photos/seed/song${parentItem.Id}${i + 1}/400/400`,
    Key: `/mock/stream/${parentItem.Id}/${i + 1}`,
  }));
};

// Sample LRC lyrics
const MOCK_LYRICS = `[00:00.00]Welcome to MiguPod Mock
[00:03.50]This is a sample lyric line
[00:07.00]Testing the sync display
[00:10.50]Everything works great!
[00:14.00]Enjoy your music
[00:17.50]With smooth animations
[00:21.00]And beautiful covers
[00:24.50]In vertical flow
[00:28.00]...`;

export const getMockImageUrl = (_config: MediaConfig, itemId: string, _tag: string, _type: string = 'Primary') => {
  const seed = itemId.replace(/[^a-zA-Z0-9]/g, '');
  return `https://picsum.photos/seed/${seed}/400/400`;
};

export const getMockPlexImageUrl = (_config: MediaConfig, thumb: string) => {
  if (thumb && thumb.startsWith('http')) return thumb;
  const seed = thumb || 'default';
  return `https://picsum.photos/seed/${seed.replace(/[^a-zA-Z0-9]/g, '')}/400/400`;
};

export const fetchMockItems = async (_config: MediaConfig, type: 'MusicAlbum' | 'MusicArtist' | 'Playlist') => {
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200)); // Simulate network delay
  
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

export const fetchMockPlexLyrics = async (_config: MediaConfig, _itemId: string) => {
  await new Promise(resolve => setTimeout(resolve, 150));
  return MOCK_LYRICS;
};
```

### Step 2: Verify the file structure

Make sure `src/services/mock.ts` contains all the exported functions matching the signatures in `emby.ts` and `plex.ts`.

---

## Task 2: Create Service Factory Layer

**Files:**
- Create: `src/services/index.ts`

### Step 1: Create the Service Factory

Create `src/services/index.ts` to export the appropriate services based on environment variable:

```typescript
import { MediaConfig, MediaItem } from '../types';

// Determine if we should use mock services
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// Import real services
import * as embyReal from './emby';
import * as plexReal from './plex';

// Import mock services (conditionally to support tree-shaking)
let embyMock: typeof embyReal;
let plexMock: typeof plexReal;

if (USE_MOCK) {
  // Dynamic import for tree-shaking in production
  const mockModule = await import('./mock');
  embyMock = {
    getImageUrl: mockModule.getMockImageUrl,
    fetchEmbyItems: mockModule.fetchMockItems,
    getStreamUrl: mockModule.getMockStreamUrl,
    validateEmbyConnection: mockModule.validateMockConnection,
    fetchSongsForItem: mockModule.fetchMockSongsForItem,
    fetchEmbyLyrics: mockModule.fetchMockLyrics,
  };
  plexMock = {
    getPlexImageUrl: mockModule.getMockPlexImageUrl,
    fetchPlexItems: mockModule.fetchMockItems,
    getPlexStreamUrl: mockModule.getMockPlexStreamUrl,
    validatePlexConnection: mockModule.validateMockConnection,
    fetchPlexSongs: mockModule.fetchMockPlexSongs,
    fetchPlexLyrics: mockModule.fetchMockPlexLyrics,
  };
}

// Export the appropriate services
export const emby = USE_MOCK ? (embyMock as typeof embyReal) : embyReal;
export const plex = USE_MOCK ? (plexMock as typeof plexReal) : plexReal;

// Helper to check if we're in mock mode
export const isMockMode = () => USE_MOCK;
```

Wait - Vite doesn't support top-level await in service files. Let's revise to use static condition:

```typescript
import { MediaConfig, MediaItem } from '../types';

// Determine if we should use mock services
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// Import real services
import * as embyReal from './emby';
import * as plexReal from './plex';

// Import mock services unconditionally (tree-shaking will remove in production)
import * as mock from './mock';

// Create mock service adapters
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

// Export the appropriate services
export const emby = USE_MOCK ? embyMock : embyReal;
export const plex = USE_MOCK ? plexMock : plexReal;

// Helper to check if we're in mock mode
export const isMockMode = () => USE_MOCK;
```

---

## Task 3: Update Vite Configuration

**Files:**
- Modify: `vite.config.ts`
- Create/Modify: `.env.example`

### Step 1: Update vite.config.ts

Add proper environment variable handling to `vite.config.ts`:

```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
```

### Step 2: Update .env.example

Add the new environment variable to `.env.example`:

```env
# Emby/Plex configuration (for real mode)
# GEMINI_API_KEY=your_gemini_key_here

# Mock mode - set to "true" to use mock data without real servers
VITE_USE_MOCK=false
```

### Step 3: Create .env.local (gitignored)

Create a local env file for development (won't be committed):

```env
# Use mock services for frontend development
VITE_USE_MOCK=true
```

---

## Task 4: Update App.tsx to Use New Service Factory

**Files:**
- Modify: `src/App.tsx`

### Step 1: Update Imports

Replace the direct imports from emby.ts and plex.ts with imports from the new service factory:

Find lines ~11-12:
```typescript
import { fetchEmbyItems, getImageUrl as getEmbyImageUrl, validateEmbyConnection, fetchSongsForItem as fetchEmbySongs, getStreamUrl as getEmbyStreamUrl, fetchEmbyLyrics } from './services/emby';
import { fetchPlexItems, getPlexImageUrl, validatePlexConnection, fetchPlexSongs, getPlexStreamUrl, fetchPlexLyrics } from './services/plex';
```

Replace with:
```typescript
import { emby, plex } from './services';
```

### Step 2: Update All Usages

Update all function calls throughout `App.tsx`:

| Old Call | New Call |
|----------|----------|
| `fetchEmbyItems(...)` | `emby.fetchEmbyItems(...)` |
| `getEmbyImageUrl(...)` | `emby.getImageUrl(...)` |
| `validateEmbyConnection(...)` | `emby.validateEmbyConnection(...)` |
| `fetchEmbySongs(...)` | `emby.fetchSongsForItem(...)` |
| `getEmbyStreamUrl(...)` | `emby.getStreamUrl(...)` |
| `fetchEmbyLyrics(...)` | `emby.fetchEmbyLyrics(...)` |
| `fetchPlexItems(...)` | `plex.fetchPlexItems(...)` |
| `getPlexImageUrl(...)` | `plex.getPlexImageUrl(...)` |
| `validatePlexConnection(...)` | `plex.validatePlexConnection(...)` |
| `fetchPlexSongs(...)` | `plex.fetchPlexSongs(...)` |
| `getPlexStreamUrl(...)` | `plex.getPlexStreamUrl(...)` |
| `fetchPlexLyrics(...)` | `plex.fetchPlexLyrics(...)` |

The main changes are in:
- `getImageUrl` function (~line 176)
- `getStreamUrl` function (~line 276)
- `fetchItems` function (~line 284)
- `fetchSongs` function (~line 290)
- `fetchLyrics` function (~line 295)
- `handleSaveConfig` function (~line 604)

### Step 3: Add Mock Mode Indicator (Optional but helpful)

Add a small indicator to let users know when mock mode is active. Insert near the top of the App component:

```typescript
import { emby, plex, isMockMode } from './services';

// ... inside App component ...

// Add a small mock indicator in the header (optional but helpful)
```

---

## Task 5: Update .gitignore

**Files:**
- Modify: `.gitignore`

Ensure `.env.local` is gitignored (it should already be, but double-check):

```gitignore
# Environment variables
.env*
!.env.example
```

---

## Task 6: Test the Implementation

### Step 1: Test Mock Mode

1. Create `.env.local` with `VITE_USE_MOCK=true`
2. Start dev server: `npm run dev`
3. Verify:
   - App loads without needing server configuration
   - Albums/Artists/Playlists show mock data
   - Covers display images from picsum.photos
   - Clicking an album shows song list
   - Playing audio uses sample audio files
   - Lyrics work
   - All animations are smooth

### Step 2: Test Real Mode (Optional)

1. Set `VITE_USE_MOCK=false` (or remove the env var)
2. Verify app still works with real Emby/Plex servers as before

---

## Task 7: Add Documentation

**Files:**
- Modify: `README.md`

Add a section to README about using mock mode:

```markdown
## Development with Mock Data

For frontend development without needing a real Emby/Plex server:

1. Create a `.env.local` file:
   ```env
   VITE_USE_MOCK=true
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

3. The app will use mock data automatically - no server configuration needed!

To switch back to real server mode, remove the `VITE_USE_MOCK=true` line or set it to `false`.
```

---

## Final Checklist

- [ ] All files created/modified as per plan
- [ ] Mock services implement all required functions
- [ ] TypeScript types are correct
- [ ] Environment variable properly controls mock/real mode
- [ ] App works in mock mode
- [ ] App still works in real mode
- [ ] Documentation updated
