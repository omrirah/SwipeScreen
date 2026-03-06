import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TinderCard from 'react-tinder-card';
import { useScreening } from '../hooks/useScreening';
import { useSwipe } from '../hooks/useSwipe';
import SwipeCard from './SwipeCard';
import ProgressBar from './ProgressBar';
import ExclusionReasonPicker from './ExclusionReasonPicker';
import KeyboardShortcuts from './KeyboardShortcuts';
import { exportProgressJSON } from '../lib/csvExport';
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
  const [excludedArticleTitle, setExcludedArticleTitle] = useState('');
  const [showCriteria, setShowCriteria] = useState(false);
  const [pendingExclude, setPendingExclude] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const isAbstractMode = project?.screeningPhase === 'abstract';

  // ── Screen-edge glows via refs (NO state = NO re-renders during drag) ──
  const leftGlowRef = useRef(null);
  const rightGlowRef = useRef(null);
  const topGlowRef = useRef(null);

  const showGlow = useCallback((direction) => {
    if (leftGlowRef.current)  leftGlowRef.current.style.opacity  = direction === 'left'  ? '1' : '0';
    if (rightGlowRef.current) rightGlowRef.current.style.opacity = direction === 'right' ? '1' : '0';
    if (topGlowRef.current)   topGlowRef.current.style.opacity   = direction === 'up'    ? '1' : '0';
  }, []);

  const hideGlows = useCallback(() => {
    if (leftGlowRef.current)  leftGlowRef.current.style.opacity  = '0';
    if (rightGlowRef.current) rightGlowRef.current.style.opacity = '0';
    if (topGlowRef.current)   topGlowRef.current.style.opacity   = '0';
  }, []);

  // ── Swipe action handler ──
  const handleSwipeAction = useCallback((direction) => {
    hideGlows();
    const timeOnCard = getTimeOnCard();

    if (direction === 'left') {
      if (isAbstractMode && project?.exclusionReasons?.length > 0) {
        // Abstract mode: defer saveDecision until reason is picked or skipped
        // The card has already animated off, but currentIndex hasn't advanced
        setExcludedArticleTitle(currentArticle?.title || 'Untitled');
        setPendingExclude({ timeOnCard });
        setShowExclusionPicker(true);
        setAnnouncement('Excluded. Select an exclusion reason or skip.');
      } else {
        // Title mode or no exclusion reasons: exclude immediately
        saveDecision('exclude', null, timeOnCard);
        setAnnouncement('Excluded.');
      }
    } else {
      const decision = direction === 'right' ? 'include' : 'maybe';
      saveDecision(decision, null, timeOnCard);
      setAnnouncement(direction === 'right' ? 'Included.' : 'Marked as maybe.');
    }
  }, [saveDecision, getTimeOnCard, isAbstractMode, currentArticle, project, hideGlows]);

  // ── Exclusion reason handling (atomic save) ──
  const handleExclusionReasonSelected = useCallback((reason) => {
    if (!pendingExclude) return;
    // Now save the decision atomically with the reason
    saveDecision('exclude', reason, pendingExclude.timeOnCard);
    setShowExclusionPicker(false);
    setPendingExclude(null);
  }, [pendingExclude, saveDecision]);

  const handleSkipExclusionReason = useCallback(() => {
    if (!pendingExclude) return;
    // Save with null reason
    saveDecision('exclude', null, pendingExclude.timeOnCard);
    setShowExclusionPicker(false);
    setPendingExclude(null);
  }, [pendingExclude, saveDecision]);

  const handleUndo = useCallback(() => {
    setShowExclusionPicker(false);
    setPendingExclude(null);
    hideGlows();
    undoLastDecision();
  }, [undoLastDecision, hideGlows]);

  const handleSaveProgress = useCallback(async () => {
    try {
      await exportProgressJSON(Number(id));
    } catch (err) {
      console.error('Save progress failed:', err);
    }
  }, [id]);

  const {
    cardRef,
    handleSwipe,
    triggerSwipe,
  } = useSwipe({
    currentIndex,
    canInteract: !loading && !!currentArticle && !showExclusionPicker,
    onSwipe: handleSwipeAction,
    onUndo: handleUndo,
  });

  // Handle escape key and number keys for exclusion reasons
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showExclusionPicker) {
          handleSkipExclusionReason();
        } else {
          navigate('/');
        }
      }
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
  }, [navigate, showExclusionPicker, project, handleExclusionReasonSelected, handleSkipExclusionReason]);

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

      {/* ── Screen-edge glows (outside card, ref-driven, no re-renders) ── */}
      <div
        ref={leftGlowRef}
        className="fixed left-0 top-0 bottom-0 w-20 pointer-events-none z-40"
        style={{
          opacity: 0,
          transition: 'opacity 120ms ease-out',
          background: 'linear-gradient(to right, rgba(239,68,68,0.3), transparent)',
        }}
      />
      <div
        ref={rightGlowRef}
        className="fixed right-0 top-0 bottom-0 w-20 pointer-events-none z-40"
        style={{
          opacity: 0,
          transition: 'opacity 120ms ease-out',
          background: 'linear-gradient(to left, rgba(34,197,94,0.3), transparent)',
        }}
      />
      <div
        ref={topGlowRef}
        className="fixed left-0 top-0 right-0 h-20 pointer-events-none z-40"
        style={{
          opacity: 0,
          transition: 'opacity 120ms ease-out',
          background: 'linear-gradient(to bottom, rgba(234,179,8,0.3), transparent)',
        }}
      />

      {/* ── Top bar ── */}
      <div className="px-4 pt-3 pb-2 max-w-[600px] w-full mx-auto shrink-0">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            &larr; {project.name}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveProgress}
              className="text-sm px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              aria-label="Save progress"
            >
              Save
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
        </div>

        {/* Article counter */}
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 mb-1">
          Article {currentIndex + 1} of {project.totalArticles}
        </p>

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

      {/* ── Card area ── */}
      <div className="flex-1 flex items-center justify-center px-4 pb-2 relative">
        <div className="relative w-full max-w-[600px]" style={{ minHeight: '200px' }}>
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
              <TinderCard
                ref={cardRef}
                key={`card-${currentArticle.id}`}
                onSwipe={(dir) => { hideGlows(); handleSwipe(dir); }}
                onSwipeRequirementFulfilled={showGlow}
                onSwipeRequirementUnfulfilled={hideGlows}
                preventSwipe={['down']}
                swipeRequirementType="position"
                swipeThreshold={40}
                flickOnSwipe={true}
              >
                <SwipeCard
                  article={currentArticle}
                  screeningPhase={project.screeningPhase}
                  index={currentIndex}
                />
              </TinderCard>
            </div>
          )}
        </div>
      </div>

      {/* ── Action buttons (Yes / No / Maybe) ── */}
      <div className="px-4 pb-6 flex items-center justify-center gap-4 max-w-[600px] w-full mx-auto shrink-0">
        <button
          onClick={() => triggerSwipe('left')}
          className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 flex flex-col items-center justify-center hover:bg-red-200 dark:hover:bg-red-800/60 transition-all active:scale-95 border-2 border-red-300 dark:border-red-600"
          aria-label="No (Exclude)"
        >
          <span className="text-2xl leading-none">&times;</span>
          <span className="text-[10px] font-semibold mt-0.5">No</span>
        </button>
        <button
          onClick={() => triggerSwipe('up')}
          className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 flex flex-col items-center justify-center hover:bg-amber-200 dark:hover:bg-amber-700/60 transition-all active:scale-95 border-2 border-amber-400 dark:border-amber-500"
          aria-label="Maybe"
        >
          <span className="text-lg leading-none">?</span>
          <span className="text-[9px] font-semibold">Maybe</span>
        </button>
        <button
          onClick={() => triggerSwipe('right')}
          className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300 flex flex-col items-center justify-center hover:bg-green-200 dark:hover:bg-green-800/60 transition-all active:scale-95 border-2 border-green-300 dark:border-green-600"
          aria-label="Yes (Include)"
        >
          <span className="text-2xl leading-none">&#10003;</span>
          <span className="text-[10px] font-semibold mt-0.5">Yes</span>
        </button>
      </div>

      {/* Exclusion reason picker (abstract mode only, blocks interaction) */}
      {showExclusionPicker && isAbstractMode && project.exclusionReasons?.length > 0 && (
        <ExclusionReasonPicker
          reasons={project.exclusionReasons}
          articleTitle={excludedArticleTitle}
          onSelect={handleExclusionReasonSelected}
          onSkip={handleSkipExclusionReason}
        />
      )}

      {/* Keyboard shortcuts help */}
      <KeyboardShortcuts />
    </div>
  );
}
