import { useState, useEffect, useRef, useCallback } from 'react';

export function useSwipe({ screeningPhase, currentIndex, canInteract = true, onSwipe, onUndo }) {
  const cardRef = useRef(null);
  const [canSwipe, setCanSwipe] = useState(false);
  const [stampDirection, setStampDirection] = useState(null);
  const [timeProgress, setTimeProgress] = useState(0);
  const timerRef = useRef(null);
  const progressRef = useRef(null);

  const minTime = screeningPhase === 'title' ? 1500 : 4000;

  // Minimum display time enforcement
  useEffect(() => {
    setCanSwipe(false);
    setStampDirection(null);
    setTimeProgress(0);

    const startTime = Date.now();

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / minTime, 1);
      setTimeProgress(progress);
      if (progress >= 1) {
        clearInterval(progressRef.current);
      }
    }, 50);

    timerRef.current = setTimeout(() => {
      setCanSwipe(true);
    }, minTime);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(progressRef.current);
    };
  }, [currentIndex, minTime]);

  const triggerSwipe = useCallback((direction) => {
    if (!canSwipe || !canInteract) return;
    if (cardRef.current) {
      cardRef.current.swipe(direction);
    }
  }, [canSwipe, canInteract]);

  const handleSwipe = useCallback((direction) => {
    if (onSwipe) onSwipe(direction);
  }, [onSwipe]);

  const handleSwipeFulfilled = useCallback((direction) => {
    setStampDirection(direction);
  }, []);

  const handleSwipeUnfulfilled = useCallback(() => {
    setStampDirection(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'k':
        case 'K':
          e.preventDefault();
          triggerSwipe('right');
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          triggerSwipe('left');
          break;
        case 'ArrowUp':
        case 'm':
        case 'M':
          e.preventDefault();
          triggerSwipe('up');
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (onUndo) onUndo();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSwipe, onUndo]);

  return {
    cardRef,
    canSwipe,
    stampDirection,
    timeProgress,
    minTime,
    handleSwipe,
    handleSwipeFulfilled,
    handleSwipeUnfulfilled,
    triggerSwipe,
  };
}
