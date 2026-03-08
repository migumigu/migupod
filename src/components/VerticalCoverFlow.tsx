import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValueEvent } from 'framer-motion';
import { MediaConfig, MediaItem } from '../types';

interface CoverItemProps {
  item: MediaItem;
  index: number;
  config: MediaConfig;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isActive: boolean;
  onItemClick: (item: MediaItem) => void;
  getImageUrl: (item: MediaItem) => string;
}

const CoverItem = React.memo(({ 
  item, 
  index, 
  config, 
  containerRef,
  isActive,
  onItemClick,
  getImageUrl
}: CoverItemProps) => {
  // Use a separate ref for the scroll target to avoid feedback loops
  const scrollTargetRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: scrollTargetRef,
    container: containerRef as React.RefObject<HTMLElement>,
    offset: ["center end", "center start"]
  });

  // Very stable spring settings for large elements
  const springConfig = { stiffness: 120, damping: 30, mass: 1.2 };
  const smoothProgress = useSpring(scrollYProgress, springConfig);

  // Smoother iPod style transformations with edge stacking
  const y = useTransform(smoothProgress, [0, 0.2, 0.5, 0.8, 1], [240, 180, 0, -180, -240]);
  const rotateX = useTransform(smoothProgress, [0, 0.2, 0.5, 0.8, 1], [65, 45, 0, -45, -65]);
  const scale = useTransform(smoothProgress, [0, 0.4, 0.5, 0.6, 1], [0.5, 0.9, 1.3, 0.9, 0.5]);
  const opacity = useTransform(smoothProgress, [0, 0.1, 0.5, 0.9, 1], [0, 0.8, 1, 0.8, 0]);
  
  // Calculate z-index based on distance from center
  // The closer to center (0.5), the higher the z-index
  // This creates proper stacking: center on top, edges below
  const zIndex = useTransform(smoothProgress, [0, 0.3, 0.5, 0.7, 1], [10, 50, 100, 50, 10]);

  const imageUrl = getImageUrl(item);

  return (
    <div 
      ref={scrollTargetRef} 
      className="relative w-80 h-80 flex items-center justify-center snap-center snap-always"
    >
      <motion.div
        style={{
          y,
          scale,
          rotateX,
          opacity,
          zIndex,
          willChange: 'transform, opacity'
        }}
        onClick={() => onItemClick(item)}
        className="relative w-full h-full preserve-3d group cursor-pointer"
      >
        {/* CD Case Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-3xl z-10 pointer-events-none border border-white/20 shadow-inner" />
        
        {/* Image */}
        <img
          src={imageUrl}
          alt={item.Name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover rounded-3xl shadow-[0_40px_80px_rgba(0,0,0,0.8)]"
          loading="lazy"
        />

        {/* Reflection */}
        <div className="absolute top-[102%] left-0 right-0 h-32 bg-gradient-to-b from-white/20 to-transparent opacity-30 blur-3xl -scale-y-100 pointer-events-none rounded-3xl" />

        {/* Info Overlay (visible when centered) */}
        <motion.div 
          style={{ 
            opacity: useTransform(smoothProgress, [0.49, 0.5, 0.51], [0, 1, 0]),
            y: useTransform(smoothProgress, [0.49, 0.5, 0.51], [40, 0, -40])
          }}
          className="absolute -bottom-32 left-0 right-0 text-center flex flex-col items-center gap-3 pointer-events-none px-4"
        >
          <h3 className="text-3xl font-serif italic line-clamp-1 text-white drop-shadow-[0_4px_20px_rgba(0,0,0,1)]">{item.Name}</h3>
          <p className="text-[11px] uppercase tracking-[0.5em] opacity-70 line-clamp-1 font-bold text-white/90">
            {item.AlbumArtist || item.ArtistNames?.join(', ') || 'Unknown Artist'}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
});

interface VerticalCoverFlowProps {
  items: MediaItem[];
  config: MediaConfig;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onItemClick: (item: MediaItem) => void;
  getImageUrl: (item: MediaItem) => string;
  playClickSound?: () => void;
}

const VerticalCoverFlow = React.memo(({
  items,
  config,
  activeIndex,
  setActiveIndex,
  onItemClick,
  getImageUrl,
  playClickSound = () => {}
}: VerticalCoverFlowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastIndex = useRef(activeIndex);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isLongPress = useRef<boolean>(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Touch start handler
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isLongPress.current = false;
    
    // Set long press timer
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
    }, 300); // 300ms threshold for long press
  };

  // Touch end handler - enforce one item per swipe (like scroll-snap-stop: always)
  const handleTouchEnd = (e: React.TouchEvent) => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const touchEndY = e.changedTouches[0].clientY;
    const touchDistance = touchStartY.current - touchEndY;
    
    // Always scroll only 1 item, regardless of swipe speed or distance
    // This mimics the behavior of CSS scroll-snap-stop: always
    if (Math.abs(touchDistance) > 30) { // Minimum threshold to detect intentional swipe
      const scrollDirection = touchDistance > 0 ? -1 : 1; // -1 for upward, 1 for downward
      const newIndex = Math.max(0, Math.min(items.length - 1, activeIndex - scrollDirection));
      
      if (newIndex !== activeIndex) {
        setActiveIndex(newIndex);
        playClickSound();
        
        // Scroll to the new index
        if (containerRef.current) {
          const totalItems = items.length;
          const scrollPosition = (newIndex / (totalItems - 1)) * containerRef.current.scrollHeight;
          containerRef.current.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
        }
      }
    }
  };

  const { scrollYProgress } = useScroll({
    container: containerRef,
  });

  // Precise index tracking for sound and active state
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const totalItems = items.length;
    if (totalItems <= 1) return;
    
    // Map 0-1 scroll progress to 0-(totalItems-1) index
    const rawIndex = latest * (totalItems - 1);
    const index = Math.round(rawIndex);
    
    // Only update and play sound if the index actually changes
    if (index !== lastIndex.current && index >= 0 && index < totalItems) {
      const distanceToInteger = Math.abs(rawIndex - index);
      if (distanceToInteger < 0.2) { // Slightly wider window for more responsive feedback
        playClickSound();
        lastIndex.current = index;
        setActiveIndex(index);
      }
    }
  });

  return (
    <div 
      ref={containerRef}
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory perspective-1000"
      style={{ 
        scrollbarWidth: 'none', 
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch' 
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex flex-col items-center py-[50vh] -space-y-64">
        {items.map((item, index) => (
          <CoverItem 
            key={item.Id} 
            item={item} 
            index={index} 
            config={config}
            containerRef={containerRef}
            isActive={index === activeIndex}
            onItemClick={onItemClick}
            getImageUrl={getImageUrl}
          />
        ))}
      </div>
    </div>
  );
});

export default VerticalCoverFlow;