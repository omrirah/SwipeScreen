import { useRef, useCallback, useEffect } from 'react';

export function useSwipe({ currentIndex, canInteract = true, onSwipe, onUndo }) {
  const cardRef = useRef(null);

  const triggerSwipe = useCallback((direction) => {
    if (!canInteract) return;
    if (cardRef.current) {
      cardRef.current.swipe(direction);
    }
  }, [canInteract]);

  const handleSwipe = useCallback((direction) => {
    if (onSwipe) onSwipe(direction);
  }, [onSwipe]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
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
    handleSwipe,
    triggerSwipe,
  };
}
