/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, User, Settings, Loader2, ChevronRight, Search, Play, X, Server, Key, Volume2, Heart, Shuffle, Repeat, Repeat1, Pause, ListMusic, Clock, Mic2, Maximize2 } from 'lucide-react';
import { cn } from './lib/utils';
import { MediaConfig, MediaItem, MediaProvider, LyricLine } from './types';
import { fetchEmbyItems, getImageUrl as getEmbyImageUrl, validateEmbyConnection, fetchSongsForItem as fetchEmbySongs, getStreamUrl as getEmbyStreamUrl, fetchEmbyLyrics } from './services/emby';
import { fetchPlexItems, getPlexImageUrl, validatePlexConnection, fetchPlexSongs, getPlexStreamUrl, fetchPlexLyrics } from './services/plex';
import VerticalCoverFlow from './components/VerticalCoverFlow';

type NavTab = 'Albums' | 'Artists' | 'Playlists';
type SortBy = 'Name' | 'Date' | 'Random';
type PlayMode = 'Sequence' | 'Random' | 'RepeatOne';

interface SortConfig {
  Albums: SortBy;
  Artists: SortBy;
  Playlists: SortBy;
}

const formatTicks = (ticks: number) => {
  const seconds = Math.floor(ticks / 10000000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Simple click sound generator using Web Audio API
const playClickSound = (() => {
  let audioCtx: AudioContext | null = null;
  return () => {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.03);

      gainNode.gain.setValueAtTime(0.015, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.03);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.03);
    } catch (e) {
      console.warn('Audio feedback failed', e);
    }
  };
})();

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const parseLyrics = (lrc: string): LyricLine[] => {
  const lines = lrc.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  lines.forEach(line => {
    let match;
    const times: number[] = [];
    let lastIndex = 0;
    
    // Reset regex state for each line
    timeRegex.lastIndex = 0;
    
    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const msPart = match[3];
      const milliseconds = parseInt(msPart);
      const time = minutes * 60 + seconds + milliseconds / (msPart.length === 3 ? 1000 : 100);
      times.push(time);
      lastIndex = timeRegex.lastIndex;
    }
    
    const text = line.substring(lastIndex).trim();
    if (text && times.length > 0) {
      times.forEach(time => {
        result.push({ time, text });
      });
    } else if (text && times.length === 0) {
      // Handle lines without time tags as metadata or static text
      // We don't add them to result for synced view to avoid confusion
    }
  });
  return result.sort((a, b) => a.time - b.time);
};

export default function App() {
  const [config, setConfig] = useState<MediaConfig | null>(() => {
    const saved = localStorage.getItem('media_config') || localStorage.getItem('emby_config');
    const initialConfig = saved ? JSON.parse(saved) : null;
    return initialConfig;
  });
  const [activeTab, setActiveTab] = useState<NavTab>('Albums');
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const saved = localStorage.getItem('media_sort_config') || localStorage.getItem('emby_sort_config');
    const initialConfig = saved ? JSON.parse(saved) : { Albums: 'Name', Artists: 'Name', Playlists: 'Name' };
    return initialConfig;
  });
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('Sequence');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // 用于跟踪是否正在加载，防止重复调用loadItems
  const isLoadingRef = useRef(false);
  
  // Playback state
  const [currentTrack, setCurrentTrack] = useState<MediaItem | null>(null);
  const [queue, setQueue] = useState<MediaItem[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Song list view state
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [songs, setSongs] = useState<MediaItem[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [panelPage, setPanelPage] = useState<'songs' | 'lyrics'>('songs');
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [rawLyrics, setRawLyrics] = useState<string | null>(null);
  
  // Display state for left controls (avatar)
  const [displayedItem, setDisplayedItem] = useState<MediaItem | null>(null);
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  const activeLyricIndex = lyrics ? lyrics.findIndex((line, index) => {
    const nextLine = lyrics[index + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  }) : -1;

  // Update displayed item (for avatar) only when scrolling ends
  useEffect(() => {
    // Clear any existing timeout
    const timeoutId = setTimeout(() => {
      if (items[activeIndex]) {
        setDisplayedItem(items[activeIndex]);
      }
    }, 300); // Wait 300ms after last scroll event

    return () => clearTimeout(timeoutId);
  }, [activeIndex, items]);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Provider specific helpers
  const getImageUrl = useCallback((item: MediaItem) => {
    if (!config) return '';
    if (config.provider === 'Plex') {
      return getPlexImageUrl(config, item.Thumb || item.ImageTags?.Primary || '');
    }
    // For Emby: use AlbumId for songs if available, otherwise use item's own Id
    // Songs may not have their own image, use album image instead
    const imageId = item.AlbumId || item.Id;
    const imageTag = item.ImageTags?.Primary || '';
    return getEmbyImageUrl(config, imageId, imageTag);
  }, [config]);

  // Extract dominant color from image
  const extractDominantColor = useCallback((imageUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 100, 100);
          const imageData = ctx.getImageData(0, 0, 100, 100);
          const data = imageData.data;
          const colorMap = new Map<string, number>();

          // Simplify colors and count occurrences
          for (let i = 0; i < data.length; i += 4) {
            const r = Math.floor(data[i] / 32) * 32;
            const g = Math.floor(data[i + 1] / 32) * 32;
            const b = Math.floor(data[i + 2] / 32) * 32;
            const color = `rgb(${r}, ${g}, ${b})`;
            colorMap.set(color, (colorMap.get(color) || 0) + 1);
          }

          // Find dominant color
          let dominantColor = 'rgb(0, 0, 0)';
          let maxCount = 0;
          colorMap.forEach((count, color) => {
            if (count > maxCount) {
              maxCount = count;
              dominantColor = color;
            }
          });

          resolve(dominantColor);
        } else {
          resolve('rgb(0, 0, 0)');
        }
      };
      img.onerror = () => {
        resolve('rgb(0, 0, 0)');
      };
      img.src = imageUrl;
    });
  }, []);

  // Update Media Session metadata when current track changes
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      const artist = currentTrack.AlbumArtist || currentTrack.ArtistNames?.join(', ') || 'Unknown Artist';
      const title = currentTrack.Name;
      const album = currentTrack.Album || '';
      const artwork = currentTrack.Thumb ? [{
        src: getImageUrl(currentTrack),
        sizes: '128x128',
        type: 'image/jpeg'
      }, {
        src: getImageUrl(currentTrack),
        sizes: '512x512',
        type: 'image/jpeg'
      }, {
        src: getImageUrl(currentTrack),
        sizes: '1024x1024',
        type: 'image/jpeg'
      }] : [];

      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork
      });

      // Update playback state
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      // Update background color based on album art
      if (currentTrack.Thumb) {
        extractDominantColor(getImageUrl(currentTrack)).then((color) => {
          // Set the background color for the media session
          // Note: This is limited by browser support
          document.body.style.setProperty('--media-session-bg', color);
        });
      }
    }
  }, [currentTrack, isPlaying, getImageUrl, extractDominantColor]);

  const getStreamUrl = useCallback((item: MediaItem) => {
    if (!config) return '';
    if (config.provider === 'Plex') {
      return getPlexStreamUrl(config, item.Key || '');
    }
    return getEmbyStreamUrl(config, item.Id);
  }, [config]);

  const fetchItems = (type: NavTab) => {
    if (!config) return Promise.resolve([]);
    const mediaType = type === 'Albums' ? 'MusicAlbum' : type === 'Artists' ? 'MusicArtist' : 'Playlist';
    return config.provider === 'Plex' ? fetchPlexItems(config, mediaType) : fetchEmbyItems(config, mediaType);
  };

  const fetchSongs = (item: MediaItem) => {
    if (!config) return Promise.resolve([]);
    return config.provider === 'Plex' ? fetchPlexSongs(config, item) : fetchEmbySongs(config, item);
  };

  const fetchLyrics = async (item: MediaItem) => {
    if (!config) return null;
    try {
      setLoadingLyrics(true);
      const result = config.provider === 'Plex' 
        ? await fetchPlexLyrics(config, item.Id) 
        : await fetchEmbyLyrics(config, item.Id);
      
      if (result) {
        setRawLyrics(result);
        const parsed = parseLyrics(result);
        setLyrics(parsed.length > 0 ? parsed : null);
      } else {
        setRawLyrics(null);
        setLyrics(null);
      }
      return result;
    } catch (err) {
      console.error("Failed to fetch lyrics:", err);
      setRawLyrics(null);
      setLyrics(null);
      return null;
    } finally {
      setLoadingLyrics(false);
    }
  };

  useEffect(() => {
    if (config) {
      loadItems();
    }
  }, [config, activeTab, sortConfig]);

  const togglePlay = async () => {
    if (!currentTrack && items[activeIndex]) {
      // If no track is selected, fetch songs for the active item and play the first one
      setLoadingSongs(true);
      try {
        const fetchedSongs = await fetchSongs(items[activeIndex]);
        if (fetchedSongs.length > 0) {
          playSong(fetchedSongs[0], fetchedSongs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSongs(false);
      }
    } else {
      setIsPlaying(prev => !prev);
    }
    playClickSound();
  };

  const playSong = (song: MediaItem, songList: MediaItem[]) => {
    setQueue(songList);
    setCurrentTrack(song);
    setIsPlaying(true);
    fetchLyrics(song);
    playClickSound();
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    playClickSound();
  };

  const nextMode = () => {
    const modes: PlayMode[] = ['Sequence', 'Random', 'RepeatOne'];
    const currentIndex = modes.indexOf(playMode);
    setPlayMode(modes[(currentIndex + 1) % modes.length]);
    playClickSound();
  };

  const handlePrev = useCallback(() => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.Id === currentTrack?.Id);
    let nextIdx = (currentIndex - 1 + queue.length) % queue.length;
    const prevTrack = queue[nextIdx];
    setCurrentTrack(prevTrack);
    fetchLyrics(prevTrack);
    playClickSound();
  }, [queue, currentTrack]);

  const handleNext = useCallback(() => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.Id === currentTrack?.Id);
    let nextIdx = (currentIndex + 1) % queue.length;
    
    if (playMode === 'Random') {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else if (playMode === 'RepeatOne') {
      nextIdx = currentIndex;
    }

    const nextTrack = queue[nextIdx];
    setCurrentTrack(nextTrack);
    fetchLyrics(nextTrack);
    playClickSound();
  }, [queue, currentTrack, playMode]);

  // Audio effect
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      // Throttle function to limit updates to 1 per second
      let lastUpdateTime = 0;
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          const now = Date.now();
          // Only update every 1000ms (1 second)
          if (now - lastUpdateTime >= 1000) {
            setCurrentTime(audioRef.current.currentTime);
            lastUpdateTime = now;
          }
        }
      };
      
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) setDuration(audioRef.current.duration);
      };
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error:", e);
        const error = audioRef.current?.error;
        let message = "Unknown playback error";
        if (error) {
          switch (error.code) {
            case 1: message = "Playback aborted"; break;
            case 2: message = "Network error"; break;
            case 3: message = "Decoding error"; break;
            case 4: message = "Source not supported (Mixed content or invalid URL?)"; break;
          }
        }
        setError(`Playback failed: ${message}`);
        setIsPlaying(false);
      };
    }
    audioRef.current.onended = handleNext;

    // Setup Media Session API for background playback controls
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        handlePrev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleNext();
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - skipTime);
          // Update currentTime immediately after seeking
          setCurrentTime(audioRef.current.currentTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + skipTime);
          // Update currentTime immediately after seeking
          setCurrentTime(audioRef.current.currentTime);
        }
      });
      
      // Try to add like action if supported
      try {
        navigator.mediaSession.setActionHandler('like' as MediaSessionAction, () => {
          if (currentTrack) {
            toggleFavorite(currentTrack.Id);
          }
        });
      } catch (e) {
        console.log('Like action not supported');
      }
    }

    // Handle page visibility change to preserve playback state
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is going to background, save playback state
        const playbackState = {
          currentTrack: currentTrack,
          currentTime: currentTime,
          isPlaying: isPlaying,
          queue: queue
        };
        sessionStorage.setItem('playbackState', JSON.stringify(playbackState));
      } else {
        // Page is coming to foreground, restore playback state
        const savedState = sessionStorage.getItem('playbackState');
        if (savedState) {
          try {
            const playbackState = JSON.parse(savedState);
            if (playbackState.currentTrack) {
              setCurrentTrack(playbackState.currentTrack);
              setQueue(playbackState.queue);
              setIsPlaying(playbackState.isPlaying);
              // Don't restore currentTime - let audio continue from current position
              setTimeout(() => {
                if (audioRef.current) {
                  if (playbackState.isPlaying) {
                    audioRef.current.play().catch(console.error);
                  }
                  // Update currentTime immediately to reflect actual position
                  setCurrentTime(audioRef.current.currentTime);
                }
              }, 100);
            }
          } catch (error) {
            console.error('Error restoring playback state:', error);
          }
        }
      }
    };

    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleNext, currentTrack, currentTime, isPlaying, queue, handlePrev]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack && config) {
      const url = getStreamUrl(currentTrack);
      if (audio.src !== url) {
        audio.src = url;
        if (isPlaying) audio.play().catch(console.error);
      }
    }
  }, [currentTrack, config, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const handleItemClick = useCallback(async (item: MediaItem) => {
    setSelectedItem(item);
    setLoadingSongs(true);
    try {
      const fetchedSongs = await fetchSongs(item);
      setSongs(fetchedSongs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSongs(false);
    }
    playClickSound();
  }, [config]);

  const loadItems = async () => {
    if (!config || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      let data = await fetchItems(activeTab);
      
      const sortBy = sortConfig[activeTab];
      if (sortBy === 'Date') {
        data.sort((a, b) => new Date(b.DateCreated || 0).getTime() - new Date(a.DateCreated || 0).getTime());
      } else if (sortBy === 'Random') {
        data.sort(() => Math.random() - 0.5);
      } else {
        data.sort((a, b) => a.Name.localeCompare(b.Name));
      }
      
      setItems(data);
      setActiveIndex(0);
    } catch (err) {
      setError('Failed to load media library. Please check your connection.');
      console.error(err);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  };

  const updateSort = (tab: NavTab, sortBy: SortBy) => {
    const newConfig = { ...sortConfig, [tab]: sortBy };
    setSortConfig(newConfig);
    localStorage.setItem('media_sort_config', JSON.stringify(newConfig));
  };

  const handleSaveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const provider = formData.get('provider') as MediaProvider;
    const serverUrl = formData.get('serverUrl') as string;
    const apiKey = formData.get('apiKey') as string;

    setLoading(true);
    setError(null);
    try {
      let userId = '';
      if (provider === 'Plex') {
        userId = await validatePlexConnection(serverUrl, apiKey);
      } else {
        userId = await validateEmbyConnection(serverUrl, apiKey);
      }
      
      const newConfig: MediaConfig = { provider, serverUrl, apiKey, userId };
      setConfig(newConfig);
      localStorage.setItem('media_config', JSON.stringify(newConfig));
      setShowSidebar(false);
    } catch (err) {
      setError(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden bg-black font-sans">
      {/* Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[120px] rounded-full" />
      </div>

      {/* Fullscreen Top Bar - Shows when in fullscreen mode with current track info */}
      {isFullscreen && currentTrack && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            height: 'calc(3.5rem + env(safe-area-inset-top))'
          }}
        >
          <div className="h-full flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <img
                src={getImageUrl(currentTrack)}
                alt=""
                className="w-9 h-9 rounded-lg object-cover border border-white/20 shadow-lg"
                referrerPolicy="no-referrer"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white line-clamp-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
                  {currentTrack.Name}
                </span>
                <span className="text-[10px] text-white/60" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                  {currentTrack.AlbumArtist || 'Unknown Artist'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Progress bar */}
              <div className="hidden sm:flex items-center gap-2 bg-black/30 rounded-full px-3 py-1.5 backdrop-blur-md">
                <span className="text-[10px] text-white/70 font-mono">{formatTime(currentTime)}</span>
                <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white/80 rounded-full transition-all duration-300"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/70 font-mono">{formatTime(duration)}</span>
              </div>
              
              {/* Play/Pause indicator */}
              <div className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full backdrop-blur-md">
                {isPlaying ? (
                  <div className="flex gap-0.5 items-end h-4">
                    <motion.div
                      animate={{ height: [4, 12, 4] }}
                      transition={{ repeat: Infinity, duration: 0.5 }}
                      className="w-1 bg-white rounded-full"
                    />
                    <motion.div
                      animate={{ height: [8, 4, 8] }}
                      transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }}
                      className="w-1 bg-white rounded-full"
                    />
                    <motion.div
                      animate={{ height: [6, 14, 6] }}
                      transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }}
                      className="w-1 bg-white rounded-full"
                    />
                  </div>
                ) : (
                  <Pause className="w-4 h-4 text-white/80" />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 pt-6 pb-6 pointer-events-none">
        <div className="max-w-md mx-auto flex items-center justify-between pointer-events-auto">
          <button 
            onClick={() => setShowSidebar(true)}
            className="p-3 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 hover:bg-white/10 transition-all active:scale-90"
          >
            <Settings className="w-5 h-5 opacity-60" />
          </button>

          <nav className="flex items-center gap-6 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-2 shadow-2xl">
            {(['Albums', 'Artists', 'Playlists'] as NavTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  playClickSound();
                }}
                className={cn(
                  "relative text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 py-1",
                  activeTab === tab ? "text-white" : "text-white/30 hover:text-white/50"
                )}
              >
                {tab === 'Albums' ? '专辑' : tab === 'Artists' ? '歌手' : '歌单'}
                {activeTab === tab && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white rounded-full"
                  />
                )}
              </button>
            ))}
          </nav>

          <div className="w-11" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 overflow-hidden">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin opacity-40" />
            <p className="text-[10px] uppercase tracking-widest opacity-40">Syncing {config?.provider || 'Media'}...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-6">
            <p className="text-red-400/80 text-sm font-medium">{error}</p>
            <button 
              onClick={() => setShowSidebar(true)}
              className="px-8 py-3 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors"
            >
              Update Config
            </button>
          </div>
        ) : items.length > 0 ? (
          <>
            <VerticalCoverFlow
              items={items}
              config={config!}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
              onItemClick={handleItemClick}
              getImageUrl={getImageUrl}
              playClickSound={playClickSound}
            />
            
              {/* Left Controls (Avatar) */}
            <LeftControls 
              currentItem={currentTrack || displayedItem || items[activeIndex]} 
              isPlaying={isPlaying}
              setIsPlaying={togglePlay}
              getImageUrl={getImageUrl}
            />

            {/* Right Controls (Favorite, Mode, Navigation, Playlist, Lyrics) */}
            <RightControls
              isFavorite={favorites.has(currentTrack?.Id || (displayedItem || items[activeIndex]).Id)}
              onToggleFavorite={() => toggleFavorite(currentTrack?.Id || (displayedItem || items[activeIndex]).Id)}
              playMode={playMode}
              onNextMode={nextMode}
              onNext={handleNext}
              hasCurrentTrack={!!currentTrack}
              onOpenPlaylist={() => {
                if (currentTrack) {
                  // If playing, show the current queue
                  setSelectedItem(currentTrack);
                  setSongs(queue);
                  setLoadingSongs(false);
                } else {
                  // If not playing, show the songs of the focused item
                  handleItemClick(displayedItem || items[activeIndex]);
                }
                playClickSound();
              }}
              onOpenLyrics={() => {
                if (currentTrack) {
                  setSelectedItem(currentTrack);
                  setSongs(queue);
                  setPanelPage('lyrics');
                  fetchLyrics(currentTrack);
                  playClickSound();
                }
              }}
            />
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
            <Music className="w-12 h-12 stroke-1" />
            <p className="text-[10px] uppercase tracking-widest">Library is empty</p>
          </div>
        )}
      </main>

      {/* Song List Panel */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white/[0.08] backdrop-blur-3xl z-50 border-l border-white/20 flex flex-col overflow-y-auto"
          >
            {/* Glass Background - Dynamic cover with current track */}
            <div className="absolute inset-0 z-[-1] overflow-hidden">
              {/* Dynamic cover background - updates with current track */}
              <img 
                src={getImageUrl(currentTrack || selectedItem)} 
                className="absolute inset-0 w-full h-full object-cover scale-110"
                alt=""
                referrerPolicy="no-referrer"
              />
              {/* Light frosted glass overlay */}
              <div className="absolute inset-0 bg-white/20 backdrop-blur-md" />
              {/* Subtle gradient for depth */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-black/30" />
            </div>

            <div className="p-6 flex items-center justify-between border-b border-white/5 pt-12 md:pt-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shadow-2xl">
                  <img 
                    src={getImageUrl(currentTrack || selectedItem)} 
                    alt="" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0">
                  <h2 
                    className="text-lg font-serif italic line-clamp-1"
                    style={{
                      textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.6)'
                    }}
                  >
                    {(currentTrack || selectedItem).Name}
                  </h2>
                  <p 
                    className="text-[10px] uppercase tracking-widest opacity-70 truncate"
                    style={{
                      textShadow: '0 2px 6px rgba(0,0,0,0.8), 0 2px 12px rgba(0,0,0,0.5)'
                    }}
                  >
                    {(currentTrack || selectedItem).AlbumArtist || 'Artist'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setPanelPage(prev => prev === 'songs' ? 'lyrics' : 'songs');
                    playClickSound();
                  }}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all border",
                    panelPage === 'lyrics' ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  )}
                  title={panelPage === 'songs' ? "Show Lyrics" : "Show Songs"}
                >
                  <Mic2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setSelectedItem(null);
                    setPanelPage('songs');
                    playClickSound();
                  }}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative z-10">
              <AnimatePresence mode="wait">
                {panelPage === 'songs' ? (
                  <motion.div 
                    key="songs"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full overflow-y-auto p-4 space-y-2 custom-scrollbar"
                  >
                    {loadingSongs ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin opacity-20" />
                      </div>
                    ) : songs.length > 0 ? (
                      songs.map((song, idx) => (
                        <motion.div
                          key={song.Id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          onClick={() => playSong(song, songs)}
                          className={cn(
                            "group p-3 rounded-xl flex items-center gap-4 cursor-pointer transition-all",
                            currentTrack?.Id === song.Id ? "bg-white/10" : "hover:bg-white/5"
                          )}
                        >
                          <div className="w-8 text-xs opacity-30 font-mono text-center group-hover:opacity-0 transition-opacity">
                            {song.IndexNumber || idx + 1}
                          </div>
                          <div className="relative w-8 h-8 flex items-center justify-center -ml-12 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-4 h-4 fill-white" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className={cn(
                              "text-sm font-medium truncate",
                              currentTrack?.Id === song.Id ? "text-emerald-400" : "text-white/90"
                            )}>
                              {song.Name}
                            </h4>
                            <p className="text-[10px] opacity-40 truncate">{song.AlbumArtist || selectedItem.AlbumArtist}</p>
                          </div>

                          <div className="text-[10px] font-mono opacity-30">
                            {song.RunTimeTicks ? formatTicks(song.RunTimeTicks) : '--:--'}
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 gap-2">
                        <ListMusic className="w-12 h-12" />
                        <p className="text-sm">No songs found</p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="flex-1 p-8 overflow-hidden">
                      <div
                        ref={lyricsContainerRef}
                        className="h-full overflow-y-auto"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                          WebkitOverflowScrolling: 'touch',
                          marginRight: '-17px',
                          paddingRight: '17px'
                        }}
                      >
                        <div className="max-w-md mx-auto text-center">
                          {/* Lyrics Content with glass effect */}
                          <div className="space-y-6" style={{ minHeight: '100%' }}>
                          {loadingLyrics ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                              <Loader2 className="w-8 h-8 animate-spin opacity-40" />
                              <p className="text-[10px] uppercase tracking-widest opacity-40">Searching for lyrics...</p>
                            </div>
                          ) : lyrics && lyrics.length > 0 ? (
                            <div style={{
                              minHeight: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              position: 'relative'
                            }}>
                              {/* Lyrics container with transform for scrolling */}
                              <div
                                style={{
                                  transform: `translateY(-${activeLyricIndex * 48}px)`,
                                  transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                              >
                                {lyrics.map((line, i) => {
                                  const isActive = i === activeLyricIndex;
                                  return (
                                    <div key={i} className="relative py-3">
                                      <motion.p
                                        initial={false}
                                        animate={{
                                          scale: isActive ? 1.15 : 1,
                                          opacity: isActive ? 1 : 0.5,
                                        }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        className={cn(
                                          "text-xl font-medium leading-relaxed transition-all duration-300 font-serif italic tracking-wide",
                                          isActive ? "text-white" : "text-white/70"
                                        )}
                                        style={{
                                          textShadow: isActive 
                                            ? '0 2px 10px rgba(0,0,0,0.8), 0 4px 20px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.4)' 
                                            : '0 2px 8px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)'
                                        }}
                                      >
                                        {line.text}
                                      </motion.p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : rawLyrics ? (
                            // Fallback for non-timed lyrics
                            <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              {rawLyrics.split('\n').map((line, i) => (
                                <p 
                                  key={i} 
                                  className="text-lg font-medium text-white/80 leading-relaxed py-2 font-serif italic tracking-wide"
                                  style={{
                                    textShadow: '0 2px 8px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5)'
                                  }}
                                >{line}</p>
                              ))}
                            </div>
                          ) : (
                            <div className="py-20 space-y-4">
                              <p className="text-lg font-medium text-white/30 leading-relaxed italic">No lyrics found for this track</p>
                              <p className="text-[10px] uppercase tracking-widest opacity-30">
                                {config?.provider === 'Plex' ? 'Plex Pass may be required for automatic lyrics' : 'Check your media server settings'}
                              </p>
                            </div>
                          )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 z-[60] w-80 bg-[#0a0a0a] border-r border-white/10 p-8 flex flex-col gap-10"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-serif italic">Settings</h2>
                <button 
                  onClick={() => setShowSidebar(false)}
                  className="p-2 rounded-full hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5 opacity-60" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-12 pr-2 custom-scrollbar">
                <section className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-4 bg-white rounded-full" />
                    <h3 className="text-[11px] uppercase tracking-[0.3em] font-black text-white/80">Display Rules</h3>
                  </div>
                  
                  <div className="space-y-8">
                    {(['Albums', 'Artists', 'Playlists'] as NavTab[]).map((tab) => (
                      <div key={tab} className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40">
                            {tab === 'Albums' ? '专辑' : tab === 'Artists' ? '歌手' : '歌单'}
                          </span>
                          <span className="text-[9px] text-white/20 font-mono">SORT_BY</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
                          {(['Name', 'Date', 'Random'] as SortBy[]).map((sort) => (
                            <button
                              key={sort}
                              onClick={() => updateSort(tab, sort)}
                              className={cn(
                                "py-2.5 rounded-xl text-[9px] uppercase tracking-widest transition-all duration-300",
                                sortConfig[tab] === sort 
                                  ? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.2)] font-bold" 
                                  : "text-white/30 hover:text-white/60 hover:bg-white/5"
                              )}
                            >
                              {sort === 'Name' ? '名称' : sort === 'Date' ? '时间' : '随机'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-4 bg-white/20 rounded-full" />
                    <h3 className="text-[11px] uppercase tracking-[0.3em] font-black text-white/40">Connection</h3>
                  </div>
                  <form onSubmit={handleSaveConfig} className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-50 ml-1">
                        <Music className="w-3 h-3" />
                        <span>Provider</span>
                      </div>
                      <select
                        name="provider"
                        defaultValue={config?.provider || 'Emby'}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-colors appearance-none"
                      >
                        <option value="Emby" className="bg-[#0a0a0a]">Emby</option>
                        <option value="Plex" className="bg-[#0a0a0a]">Plex</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-50 ml-1">
                        <Server className="w-3 h-3" />
                        <span>Server URL</span>
                      </div>
                      <input
                        name="serverUrl"
                        type="url"
                        required
                        defaultValue={config?.serverUrl}
                        placeholder="https://emby.example.com"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-colors"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-50 ml-1">
                        <Key className="w-3 h-3" />
                        <span>API Key / Token</span>
                      </div>
                      <input
                        name="apiKey"
                        type="password"
                        required
                        defaultValue={config?.apiKey}
                        placeholder="Your API Key or Plex Token"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-white text-black font-bold rounded-2xl py-4 text-sm hover:bg-white/90 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Validating...' : 'Save Configuration'}
                    </button>
                  </form>
                </section>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const LeftControls = React.memo(({
  currentItem,
  isPlaying,
  setIsPlaying,
  getImageUrl
}: {
  currentItem: MediaItem,
  isPlaying: boolean,
  setIsPlaying: () => void,
  getImageUrl: (item: MediaItem) => string
}) => {
  const artistImageUrl = getImageUrl(currentItem);

  return (
    <div className="fixed bottom-6 left-6 z-30 flex items-center gap-4">
      <motion.div
        className="relative cursor-pointer group"
        onClick={() => setIsPlaying()}
      >
        <div className="relative w-24 h-24 rounded-2xl border border-white/20 p-1 bg-black overflow-hidden shadow-2xl">
          <img
            src={artistImageUrl}
            alt="Artist"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-xl"
          />
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {!isPlaying ? (
            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
              <Pause className="w-5 h-5 fill-white text-white" />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
});

const RightControls = React.memo(({
  isFavorite,
  onToggleFavorite,
  playMode,
  onNextMode,
  onNext,
  onOpenPlaylist,
  onOpenLyrics,
  hasCurrentTrack
}: {
  isFavorite: boolean,
  onToggleFavorite: () => void,
  playMode: PlayMode,
  onNextMode: () => void,
  onNext: () => void,
  onOpenPlaylist: () => void,
  onOpenLyrics: () => void,
  hasCurrentTrack: boolean
}) => {
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col items-center gap-6">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggleFavorite}
        className="flex flex-col items-center gap-1 group"
      >
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
          isFavorite ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "bg-white/5 backdrop-blur-2xl border border-white/10"
        )}>
          <Heart className={cn("w-5 h-5 transition-colors", isFavorite ? "fill-white text-white" : "text-white/40 group-hover:text-white/60")} />
        </div>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onNextMode}
        className="flex flex-col items-center gap-1"
      >
        <div className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-2xl flex items-center justify-center border border-white/10">
          {playMode === 'Sequence' && <Repeat className="w-5 h-5 text-white/70" />}
          {playMode === 'Random' && <Shuffle className="w-5 h-5 text-white/70" />}
          {playMode === 'RepeatOne' && <Repeat1 className="w-5 h-5 text-white/70" />}
        </div>
      </motion.button>

      {/* Lyrics Button */}
      <motion.button
        whileHover={hasCurrentTrack ? { scale: 1.1 } : {}}
        whileTap={hasCurrentTrack ? { scale: 0.9 } : {}}
        onClick={onOpenLyrics}
        disabled={!hasCurrentTrack}
        className="flex flex-col items-center gap-1 group"
      >
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all",
          hasCurrentTrack
            ? "bg-white/5 backdrop-blur-2xl border border-white/10 hover:bg-white/10"
            : "bg-white/5 border border-white/5 opacity-30 cursor-not-allowed"
        )}>
          <span className={cn(
            "text-sm font-bold",
            hasCurrentTrack ? "text-white/60 group-hover:text-white" : "text-white/30"
          )}>词</span>
        </div>
      </motion.button>

      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-col gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-2xl flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all"
          >
            <Maximize2 className="w-5 h-5 text-white/60" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onNext}
            className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-2xl flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all"
          >
            <ChevronRight className="w-5 h-5 text-white/60" />
          </motion.button>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onOpenPlaylist}
        className="flex flex-col items-center gap-1 group"
      >
        <div className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-2xl flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all">
          <ListMusic className="w-5 h-5 text-white/60 group-hover:text-white" />
        </div>
      </motion.button>
    </div>
  );
});
