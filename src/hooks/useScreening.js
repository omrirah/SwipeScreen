import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../lib/db';

const MAX_UNDO = 10;

export function useScreening(projectId) {
  const id = Number(projectId);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [currentArticle, setCurrentArticle] = useState(null);
  const [nextArticle, setNextArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const cardShownAtRef = useRef(Date.now());

  const project = useLiveQuery(() => db.projects.get(id), [id]);

  // Count decisions for progress
  const decisionCounts = useLiveQuery(async () => {
    if (!id) return { include: 0, exclude: 0, maybe: 0, total: 0 };
    const all = await db.decisions.where('projectId').equals(id).toArray();
    const include = all.filter(d => d.decision === 'include').length;
    const exclude = all.filter(d => d.decision === 'exclude').length;
    const maybe = all.filter(d => d.decision === 'maybe').length;
    return { include, exclude, maybe, total: all.length };
  }, [id]);

  // Initialize session from saved position
  useEffect(() => {
    if (project && currentIndex === null) {
      setCurrentIndex(project.currentIndex || 0);
    }
  }, [project, currentIndex]);

  // Fetch current and next articles
  useEffect(() => {
    if (currentIndex === null || !id) return;

    const fetchArticles = async () => {
      setLoading(true);

      const current = await db.articles
        .where('[projectId+screeningOrder]')
        .equals([id, currentIndex])
        .first();

      const next = await db.articles
        .where('[projectId+screeningOrder]')
        .equals([id, currentIndex + 1])
        .first();

      setCurrentArticle(current || null);
      setNextArticle(next || null);
      setLoading(false);
      cardShownAtRef.current = Date.now();
    };

    fetchArticles();
  }, [id, currentIndex]);

  const isComplete = project && currentIndex !== null && currentIndex >= (project.totalArticles || 0);

  const saveDecision = useCallback(async (decision, exclusionReason, timeOnCardMs) => {
    if (!project || !currentArticle) return;

    const decisionRecord = {
      projectId: id,
      articleId: currentArticle.id,
      decision,
      exclusionReason: exclusionReason || null,
      reviewer: project.reviewerName,
      screeningPhase: project.screeningPhase,
      timestamp: Date.now(),
      timeOnCardMs: timeOnCardMs || (Date.now() - cardShownAtRef.current),
    };

    await db.transaction('rw', [db.decisions, db.projects], async () => {
      const decisionId = await db.decisions.add(decisionRecord);
      await db.projects.update(id, {
        currentIndex: currentIndex + 1,
        updatedAt: Date.now(),
      });

      setUndoStack(prev => {
        const stack = [...prev, { decisionId, articleId: currentArticle.id, index: currentIndex }];
        return stack.slice(-MAX_UNDO);
      });
    });

    setCurrentIndex(prev => prev + 1);
  }, [project, currentArticle, id, currentIndex]);

  const undoLastDecision = useCallback(async () => {
    if (undoStack.length === 0) return;

    const last = undoStack[undoStack.length - 1];

    await db.transaction('rw', [db.decisions, db.projects], async () => {
      await db.decisions.delete(last.decisionId);
      await db.projects.update(id, {
        currentIndex: last.index,
        updatedAt: Date.now(),
      });
    });

    setUndoStack(prev => prev.slice(0, -1));
    setCurrentIndex(last.index);
  }, [undoStack, id]);

  const getTimeOnCard = useCallback(() => {
    return Date.now() - cardShownAtRef.current;
  }, []);

  return {
    project,
    currentArticle,
    nextArticle,
    currentIndex: currentIndex ?? 0,
    isComplete,
    loading,
    undoStack,
    decisionCounts: decisionCounts || { include: 0, exclude: 0, maybe: 0, total: 0 },
    saveDecision,
    undoLastDecision,
    getTimeOnCard,
    cardShownAtRef,
  };
}
