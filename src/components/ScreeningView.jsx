import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TinderCard from 'react-tinder-card';
import { useScreening } from '../hooks/useScreening';
import { useSwipe } from '../hooks/useSwipe';
import SwipeCard from './SwipeCard';
import ProgressBar from './ProgressBar';
import ExclusionReasonPicker from './ExclusionReasonPicker';
import KeyboardShortcuts from './KeyboardShortcuts';
import db from '../lib/db';

export default function ScreeningView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    project,
    currentArticle,
    nextArticle,
    currentIndex,
    isComplete,
    loading,
    undoStack,
    decisionCounts,
    saveDecision,
    undoLastDecision,
    getTimeOnCard,
  } = useScreening(id);

  const [showExclusionPicker, setShowExclusionPicker] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);
  const [pendingExclude, setPendingExclude] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const handleSwipeAction = useCallback((direction) => {
    const timeOnCard = getTimeOnCard();

    if (direction === 'left') {
      setPendingExclude({ timeOnCard });
      setShowExclusionPicker(true);
      saveDecision('exclude', null, timeOnCard);
      setAnnouncement('Excluded. Select an exclusion reason or swipe next card to skip.');
    } else {
      const decision = direction === 'right' ? 'include' : 'maybe';
      setShowExclusionPicker(false);
      setPendingExclude(null);
      saveDecision(decision, null, timeOnCard);
      setAnnouncement(direction === 'right' ? 'Included.' : 'Marked as maybe.');
    }
  }, [saveDecision, getTimeOnCard]);

  const handleExclusionReasonSelected = useCallback((reason) => {
    if (!pendingExclude) return;

    // Update the most recent decision with the reason
    (async () => {
      const articleId = undoStack.length > 0 ? undoStack[undoStack.length - 1].articleId : -1;
      const decisions = await db.decisions
        .where('[projectId+articleId]')
        .equals([Number(id), articleId])
        .toArray();

      if (decisions.length > 0) {
        const latest = decisions[decisions.length - 1];
        await db.decisions.update(latest.id, { exclusionReason: reason });
      }
    })();

    setShowExclusionPicker(false);
    setPendingExclude(null);
  }, [pendingExclude, id, undoStack]);

  const handleUndo = useCallback(() => {
    setShowExclusionPicker(false);
    setPendingExclude(null);
    undoLastDecision();
  }, [undoLastDecision]);

  const {
    cardRef,
    canSwipe,
    stampDirection,
    timeProgress,
    minTime,
    handleSwipe,
    handleSwipeFulfilled,
    handleSwipeUnfulfilled,
    triggerSwipe,
  } = useSwipe({
    screeningPhase: project?.screeningPhase || 'title',
    currentIndex,
    canInteract: !loading && !!currentArticle,
    onSwipe: handleSwipeAction,
    onUndo: handleUndo,
  });

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
      // Number keys for exclusion reasons
      if (showExclusionPicker && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        const reasons = project?.exclusionReasons || [];
        if (index < reasons.length) {
          handleExclusionReasonSelected(reasons[index]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, showExclusionPicker, project, handleExclusionReasonSelected]);

  // Navigate to results when complete
  useEffect(() => {
    if (isComplete && !loading) {
      navigate(`/project/${id}/results`);
    }
  }, [isComplete, loading, id, navigate]);

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-gray-400 dark:text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!currentArticle && !isComplete) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-gray-400 dark:text-gray-500">No articles found.</p>
      </div>
    );
  }

  const hasCriteria =
    (project.inclusionCriteria && project.inclusionCriteria.length > 0) ||
    (project.exclusionCriteria && project.exclusionCriteria.length > 0);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Top bar */}
      <div className="px-4 pt-4 pb-2 max-w-[600px] w-full mx-auto">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            &larr; {project.name}
          </button>
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="text-sm px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Undo last decision"
          >
            Undo
          </button>
        </div>

        <ProgressBar
          current={decisionCounts.total}
          total={project.totalArticles}
          included={decisionCounts.include}
          maybe={decisionCounts.maybe}
          excluded={decisionCounts.exclude}
        />

        {/* Collapsible criteria banner */}
        {hasCriteria && (
          <div className="mt-2">
            <button
              onClick={() => setShowCriteria(!showCriteria)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              aria-expanded={showCriteria}
              aria-controls="criteria-panel"
            >
              {showCriteria ? 'Hide criteria' : 'Criteria'}
            </button>
            {showCriteria && (
              <div id="criteria-panel" className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs space-y-2">
                {project.inclusionCriteria?.length > 0 && (
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400 mb-0.5">Include if:</p>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-0.5">
                      {project.inclusionCriteria.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {project.exclusionCriteria?.length > 0 && (
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400 mb-0.5">Exclude if:</p>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-0.5">
                      {project.exclusionCriteria.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-4 pb-4 relative">
        <div className="relative w-full max-w-[600px]" style={{ minHeight: '300px' }}>
          {/* Next card (behind) */}
          {nextArticle && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'scale(0.95)', zIndex: 0 }} aria-hidden="true">
              <SwipeCard
                article={nextArticle}
                screeningPhase={project.screeningPhase}
                index={currentIndex + 1}
              />
            </div>
          )}

          {/* Current card */}
          {currentArticle && (
            <div className="relative" style={{ zIndex: 1 }}>
              {/* Min-time progress bar */}
              {!canSwipe && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-t-2xl overflow-hidden z-20">
                  <div
                    className="h-full bg-blue-400 dark:bg-blue-500 transition-all"
                    style={{
                      width: `${timeProgress * 100}%`,
                      transition: 'width 50ms linear',
                    }}
                  />
                </div>
              )}

              <TinderCard
                ref={cardRef}
                key={`card-${currentArticle.id}`}
                onSwipe={handleSwipe}
                onSwipeRequirementFulfilled={handleSwipeFulfilled}
                onSwipeRequirementUnfulfilled={handleSwipeUnfulfilled}
                preventSwipe={canSwipe ? ['down'] : ['left', 'right', 'up', 'down']}
                swipeRequirementType="position"
                swipeThreshold={100}
                flickOnSwipe={true}
              >
                <SwipeCard
                  article={currentArticle}
                  screeningPhase={project.screeningPhase}
                  stampDirection={stampDirection}
                  index={currentIndex}
                />
              </TinderCard>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-8 flex items-center justify-center gap-4 max-w-[600px] w-full mx-auto">
        <button
          onClick={() => triggerSwipe('left')}
          disabled={!canSwipe}
          className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 flex items-center justify-center text-2xl hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-30 transition-all active:scale-95 border-2 border-red-200 dark:border-red-800"
          aria-label="Exclude"
        >
          &times;
        </button>
        <button
          onClick={() => triggerSwipe('up')}
          disabled={!canSwipe}
          className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center text-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/60 disabled:opacity-30 transition-all active:scale-95 border-2 border-yellow-200 dark:border-yellow-800"
          aria-label="Maybe"
        >
          ?
        </button>
        <button
          onClick={() => triggerSwipe('right')}
          disabled={!canSwipe}
          className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 text-green-500 dark:text-green-400 flex items-center justify-center text-2xl hover:bg-green-200 dark:hover:bg-green-900/60 disabled:opacity-30 transition-all active:scale-95 border-2 border-green-200 dark:border-green-800"
          aria-label="Include"
        >
          &#10003;
        </button>
      </div>

      {/* Exclusion reason picker */}
      {showExclusionPicker && project.exclusionReasons?.length > 0 && (
        <ExclusionReasonPicker
          reasons={project.exclusionReasons}
          onSelect={handleExclusionReasonSelected}
        />
      )}

      {/* Keyboard shortcuts help */}
      <KeyboardShortcuts />
    </div>
  );
}
