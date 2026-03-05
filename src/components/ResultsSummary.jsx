import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProject } from '../hooks/useProject';
import { exportDecisionsCSV, exportProgressJSON } from '../lib/csvExport';
import db from '../lib/db';

export default function ResultsSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { project } = useProject(id);

  const decisions = useLiveQuery(
    () => db.decisions.where('projectId').equals(Number(id)).toArray(),
    [id]
  );

  const stats = useMemo(() => {
    if (!decisions || !project) return null;

    const included = decisions.filter(d => d.decision === 'include');
    const excluded = decisions.filter(d => d.decision === 'exclude');
    const maybe = decisions.filter(d => d.decision === 'maybe');

    // Exclusion reason breakdown
    const reasonCounts = {};
    excluded.forEach(d => {
      const reason = d.exclusionReason || 'Not specified';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    const reasonsSorted = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);

    // Time stats
    const times = decisions.map(d => d.timeOnCardMs).filter(t => t > 0);
    const totalTimeMs = times.reduce((a, b) => a + b, 0);
    const avgTimeMs = times.length > 0 ? totalTimeMs / times.length : 0;
    const sortedTimes = [...times].sort((a, b) => a - b);
    const medianTimeMs = sortedTimes.length > 0
      ? sortedTimes.length % 2 === 0
        ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
        : sortedTimes[Math.floor(sortedTimes.length / 2)]
      : 0;

    // Date range
    const timestamps = decisions.map(d => d.timestamp).filter(Boolean);
    const firstDate = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;
    const lastDate = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;

    return {
      total: decisions.length,
      included: included.length,
      excluded: excluded.length,
      maybe: maybe.length,
      reasonsSorted,
      totalTimeMs,
      avgTimeMs,
      medianTimeMs,
      firstDate,
      lastDate,
    };
  }, [decisions, project]);

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainSec = Math.round(seconds % 60);
    return `${minutes}m ${remainSec}s`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!project || !stats) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          &larr; Home
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Results</h1>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {project.name} &middot; {project.reviewerName} &middot;{' '}
        {project.screeningPhase === 'title' ? 'Title screening' : 'Abstract screening'}
      </p>

      {/* Decision counts */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.included}</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Included</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.maybe}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Maybe</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.excluded}</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">Excluded</p>
        </div>
      </div>

      {/* Exclusion reasons breakdown */}
      {stats.reasonsSorted.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Exclusion Reasons</h3>
          <div className="space-y-2">
            {stats.reasonsSorted.map(([reason, count]) => (
              <div key={reason} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{reason}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-300 dark:bg-red-700 rounded-full"
                      style={{ width: `${(count / stats.excluded) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Time</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total time</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatTime(stats.totalTimeMs)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg per card</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatTime(stats.avgTimeMs)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Median per card</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatTime(stats.medianTimeMs)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total screened</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{stats.total} / {project.totalArticles}</p>
          </div>
        </div>
        {stats.firstDate && stats.lastDate && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            {formatDate(stats.firstDate)} &mdash; {formatDate(stats.lastDate)}
          </p>
        )}
      </div>

      {/* Export buttons */}
      <div className="space-y-3">
        <button
          onClick={() => exportDecisionsCSV(Number(id))}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Download CSV
        </button>
        <button
          onClick={() => exportProgressJSON(Number(id))}
          className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Save Progress (JSON)
        </button>
        <button
          onClick={() => navigate(`/project/${id}/screen`)}
          className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {stats.total < project.totalArticles ? 'Continue screening' : 'Review cards'}
        </button>
      </div>
    </div>
  );
}
