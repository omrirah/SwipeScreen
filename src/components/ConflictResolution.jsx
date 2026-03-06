import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../lib/db';
import Papa from 'papaparse';

const DECISION_COLORS = {
  include: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  exclude: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  maybe: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
};

export default function ConflictResolution() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  const synthesis = useLiveQuery(
    () => db.synthesisProjects.get(Number(id)),
    [id]
  );

  if (!synthesis) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-gray-400 dark:text-gray-500">Loading...</p>
      </div>
    );
  }

  const conflicts = synthesis.conflicts || [];
  const resolvedCount = conflicts.filter(c => c.resolvedDecision).length;
  const isComplete = resolvedCount === conflicts.length;
  const currentConflict = conflicts[currentIndex];

  const handleResolve = async (decision) => {
    const updatedConflicts = [...conflicts];
    updatedConflicts[currentIndex] = {
      ...updatedConflicts[currentIndex],
      resolvedDecision: decision,
      resolvedAt: Date.now(),
    };

    await db.synthesisProjects.update(Number(id), { conflicts: updatedConflicts });

    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleExportReconciled = () => {
    if (!synthesis.matched) return;

    const rows = synthesis.matched.map(m => {
      const row = { ...(m.rawRows?.[0] || {}) };

      // Clean existing screening columns
      delete row.screening_decision;
      delete row.exclusion_reason;
      delete row.reviewer;
      delete row.screening_phase;
      delete row.screening_timestamp;
      delete row.time_on_card_seconds;

      m.decisions.forEach((d, i) => {
        row[`reviewer${i + 1}_name`] = d.reviewer;
        row[`reviewer${i + 1}_decision`] = d.decision;
        row[`reviewer${i + 1}_exclusion_reason`] = d.reason || '';
      });

      const allSame = m.decisions.every(d => d.decision === m.decisions[0].decision);

      // Check if this article had a conflict that was resolved
      const conflict = conflicts.find(c => c.title === m.title || c.doi === m.doi);

      if (conflict && conflict.resolvedDecision) {
        row.agreement = 'no';
        row.final_decision = conflict.resolvedDecision;
        row.resolved_by = 'reconciliation';
      } else if (allSame) {
        row.agreement = 'yes';
        row.final_decision = m.decisions[0].decision;
        row.resolved_by = 'agreement';
      } else {
        row.agreement = 'no';
        row.final_decision = '';
        row.resolved_by = '';
      }

      return row;
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reconciled_k${synthesis.kappaScore || 'NA'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Completion screen
  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">All Conflicts Resolved</h1>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {conflicts.filter(c => c.resolvedDecision === 'include').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Included</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {conflicts.filter(c => c.resolvedDecision === 'maybe').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Maybe</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {conflicts.filter(c => c.resolvedDecision === 'exclude').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Excluded</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleExportReconciled}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Download Reconciled CSV
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  if (!currentConflict) return null;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Progress */}
      <div className="px-4 pt-4 pb-2 max-w-[600px] w-full mx-auto">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/')} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            &larr; Back
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Conflict {currentIndex + 1} / {conflicts.length}
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${(resolvedCount / conflicts.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Conflict card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug mb-4">
            {currentConflict.title}
          </h2>

          {/* Reviewer decisions */}
          <div className="space-y-2 mb-4">
            {currentConflict.decisions.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0">
                  {d.reviewer}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${DECISION_COLORS[d.decision] || 'text-gray-600 bg-gray-100'}`}>
                  {d.decision}
                </span>
                {d.reason && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    ({d.reason})
                  </span>
                )}
              </div>
            ))}
          </div>

          {currentConflict.resolvedDecision && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              Resolved: <strong className="capitalize">{currentConflict.resolvedDecision}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Decision buttons */}
      <div className="px-4 pb-8 max-w-[600px] w-full mx-auto">
        <div className="flex gap-3">
          <button
            onClick={() => handleResolve('exclude')}
            className="flex-1 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Exclude
          </button>
          <button
            onClick={() => handleResolve('maybe')}
            className="flex-1 py-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-xl font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
          >
            Maybe
          </button>
          <button
            onClick={() => handleResolve('include')}
            className="flex-1 py-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          >
            Include
          </button>
        </div>

        {/* Save progress */}
        <button
          onClick={handleExportReconciled}
          className="w-full py-2 mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Save progress (download CSV)
        </button>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="text-sm text-gray-500 dark:text-gray-400 disabled:opacity-30"
          >
            &larr; Previous
          </button>
          <button
            onClick={() => setCurrentIndex(Math.min(conflicts.length - 1, currentIndex + 1))}
            disabled={currentIndex === conflicts.length - 1}
            className="text-sm text-gray-500 dark:text-gray-400 disabled:opacity-30"
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
