import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseReviewerCSV, matchReviewers } from '../lib/synthesisMatch';
import { calculateKappa, calculateFleissKappa } from '../lib/kappa';
import db from '../lib/db';
import Papa from 'papaparse';

export default function SynthesisUpload() {
  const navigate = useNavigate();
  const [reviewerFiles, setReviewerFiles] = useState([]);
  const [reviewerData, setReviewerData] = useState([]);
  const [matchResult, setMatchResult] = useState(null);
  const [kappaResult, setKappaResult] = useState(null);
  const [fuzzyPending, setFuzzyPending] = useState([]);
  // fuzzyApproved items are immediately integrated into matchResult
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilesAdded = useCallback(async (files) => {
    setError('');
    const newFiles = [...reviewerFiles];
    const newData = [...reviewerData];

    for (const file of files) {
      try {
        const parsed = await parseReviewerCSV(file);
        newFiles.push(file);
        newData.push(parsed);
      } catch (err) {
        setError(`Error parsing ${file.name}: ${err.message}`);
        return;
      }
    }

    setReviewerFiles(newFiles);
    setReviewerData(newData);
    setMatchResult(null);
    setKappaResult(null);
  }, [reviewerFiles, reviewerData]);

  const handleRemoveReviewer = (index) => {
    setReviewerFiles(prev => prev.filter((_, i) => i !== index));
    setReviewerData(prev => prev.filter((_, i) => i !== index));
    setMatchResult(null);
    setKappaResult(null);
  };

  const handleMatch = useCallback(() => {
    if (reviewerData.length < 2) {
      setError('Need at least 2 reviewer CSVs');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const result = matchReviewers(reviewerData);
      setMatchResult(result);
      setFuzzyPending(result.fuzzyPending || []);

      if (result.matched.length > 0) {
        if (reviewerData.length === 2) {
          const r1 = result.matched.map(m => m.decisions[0].decision);
          const r2 = result.matched.map(m => m.decisions[1].decision);
          setKappaResult(calculateKappa(r1, r2));
        } else {
          const ratings = [];
          for (let ri = 0; ri < reviewerData.length; ri++) {
            ratings.push(result.matched.map(m => m.decisions[ri]?.decision || 'unknown'));
          }
          setKappaResult(calculateFleissKappa(ratings));
        }
      }
    } catch (err) {
      setError(`Matching failed: ${err.message}`);
    }

    setIsProcessing(false);
  }, [reviewerData]);

  const recalcKappa = useCallback((matched) => {
    if (matched.length === 0) { setKappaResult(null); return; }
    if (reviewerData.length === 2) {
      const r1 = matched.map(m => m.decisions[0].decision);
      const r2 = matched.map(m => m.decisions[1].decision);
      setKappaResult(calculateKappa(r1, r2));
    } else {
      const ratings = [];
      for (let ri = 0; ri < reviewerData.length; ri++) {
        ratings.push(matched.map(m => m.decisions[ri]?.decision || 'unknown'));
      }
      setKappaResult(calculateFleissKappa(ratings));
    }
  }, [reviewerData]);

  const handleApproveFuzzy = (idx) => {
    const fp = fuzzyPending[idx];
    if (!fp || !matchResult) return;

    // Build a matched pair from the fuzzy match
    const anchorRow = reviewerData[0].data[fp.anchorIdx];
    const otherRow = reviewerData[fp.otherReviewerIndex].data[fp.otherRowIndex];
    const getDecision = (row) => (row.screening_decision || row.decision || '').toLowerCase().trim();
    const getReason = (row) => row.exclusion_reason || row.exclusionReason || '';
    const getTitle = (row) => row.Title || row.title || row['Article Title'] || '';
    const getDOI = (row) => row.DOI || row.doi || '';

    // For 2-reviewer case, build the matched pair directly
    const newMatch = {
      title: getTitle(anchorRow),
      doi: getDOI(anchorRow),
      decisions: [
        { reviewer: reviewerData[0].reviewerName, decision: getDecision(anchorRow), reason: getReason(anchorRow) },
        { reviewer: reviewerData[fp.otherReviewerIndex].reviewerName, decision: getDecision(otherRow), reason: getReason(otherRow) },
      ],
      rawRows: [anchorRow, otherRow],
      matchedBy: ['Title (fuzzy)'],
    };

    const updatedMatched = [...matchResult.matched, newMatch];
    setMatchResult({ ...matchResult, matched: updatedMatched });
    setFuzzyPending(prev => prev.filter((_, i) => i !== idx));
    recalcKappa(updatedMatched);
  };

  const handleRejectFuzzy = (idx) => {
    setFuzzyPending(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStartResolution = async () => {
    if (!matchResult) return;

    const conflicts = matchResult.matched.filter(m => {
      const decisions = m.decisions.map(d => d.decision);
      return !decisions.every(d => d === decisions[0]);
    });

    if (conflicts.length === 0) {
      setError('No conflicts found - all reviewers agree!');
      return;
    }

    const synthesisId = await db.synthesisProjects.add({
      projectId: null,
      reviewerNames: reviewerData.map(r => r.reviewerName),
      matched: matchResult.matched,
      conflicts: conflicts.map(c => ({
        title: c.title,
        doi: c.doi,
        decisions: c.decisions,
        rawRows: c.rawRows,
        resolvedDecision: null,
        resolvedReason: null,
      })),
      kappaScore: kappaResult?.kappa,
      kappaType: reviewerData.length === 2 ? 'cohen' : 'fleiss',
      createdAt: Date.now(),
    });

    navigate(`/synthesis/${synthesisId}/resolve`);
  };

  const handleExportReconciled = () => {
    if (!matchResult) return;

    const rows = matchResult.matched.map(m => {
      const row = { ...(m.rawRows[0] || {}) };

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
      row.agreement = allSame ? 'yes' : 'no';
      row.final_decision = allSame ? m.decisions[0].decision : '';
      row.resolved_by = allSame ? 'agreement' : '';

      return row;
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `synthesis_reconciled${kappaResult ? `_k${kappaResult.kappa}` : ''}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const conflicts = matchResult?.matched.filter(m => {
    const decisions = m.decisions.map(d => d.decision);
    return !decisions.every(d => d === decisions[0]);
  }) || [];

  const agreements = matchResult ? matchResult.matched.length - conflicts.length : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          &larr; Home
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Synthesis</h1>
      </div>

      {/* File uploads */}
      <div className="space-y-3 mb-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Upload exported CSVs from each reviewer (2 or more).
        </p>

        {reviewerData.map((rd, i) => (
          <div key={i} className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Reviewer {i + 1}: {rd.reviewerName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{rd.data.length} articles</p>
            </div>
            <button
              onClick={() => handleRemoveReviewer(i)}
              className="text-gray-400 hover:text-red-500 text-lg"
              aria-label="Remove reviewer"
            >
              &times;
            </button>
          </div>
        ))}

        <div
          onClick={() => document.getElementById('synthesis-csv-input').click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
        >
          <input
            id="synthesis-csv-input"
            type="file"
            accept=".csv"
            multiple
            onChange={(e) => { handleFilesAdded(Array.from(e.target.files)); e.target.value = ''; }}
            className="hidden"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {reviewerData.length === 0 ? 'Upload reviewer CSVs' : 'Add another reviewer CSV'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      {reviewerData.length >= 2 && !matchResult && (
        <button
          onClick={handleMatch}
          disabled={isProcessing}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors mb-6"
        >
          {isProcessing ? 'Matching...' : 'Match & Compare'}
        </button>
      )}

      {/* Fuzzy matches requiring confirmation */}
      {fuzzyPending.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Possible Matches (manual confirmation needed)
          </h3>
          <div className="space-y-2">
            {fuzzyPending.map((fp, i) => (
              <div key={i} className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">{fp.similarity}% similar</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 mb-1">R1: {fp.anchorTitle}</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">R{fp.otherReviewerIndex + 1}: {fp.otherTitle}</p>
                <div className="flex gap-2">
                  <button onClick={() => handleApproveFuzzy(i)} className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
                    Same article
                  </button>
                  <button onClick={() => handleRejectFuzzy(i)} className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
                    Different
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {matchResult && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Matching Results</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Matched articles</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{matchResult.matched.length}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Reviewers</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{reviewerData.length}</p>
              </div>
            </div>
          </div>

          {kappaResult && kappaResult.kappa !== null && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {reviewerData.length === 2 ? "Cohen's" : "Fleiss'"} Kappa
              </h3>
              <div className="text-center mb-3">
                <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">{kappaResult.kappa.toFixed(3)}</p>
                <p className={`text-sm mt-1 font-medium ${
                  kappaResult.kappa >= 0.8 ? 'text-green-600 dark:text-green-400' :
                  kappaResult.kappa >= 0.6 ? 'text-blue-600 dark:text-blue-400' :
                  kappaResult.kappa >= 0.4 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {kappaResult.interpretation}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Observed</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{(kappaResult.observed * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Expected</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{(kappaResult.expected * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">N</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{kappaResult.n}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Agreement</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{agreements}</p>
                <p className="text-xs text-green-600 dark:text-green-400">Agreed</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{conflicts.length}</p>
                <p className="text-xs text-red-600 dark:text-red-400">Conflicts</p>
              </div>
            </div>
          </div>

          {/* Confusion matrix for 2 reviewers */}
          {reviewerData.length === 2 && kappaResult?.matrix && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Confusion Matrix</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-gray-500 dark:text-gray-400"></th>
                    {Object.keys(kappaResult.matrix).map(c => (
                      <th key={c} className="p-2 text-center text-gray-500 dark:text-gray-400 capitalize">{c} (R2)</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(kappaResult.matrix).map(([r1Cat, r2Counts]) => (
                    <tr key={r1Cat}>
                      <td className="p-2 font-medium text-gray-600 dark:text-gray-400 capitalize">{r1Cat} (R1)</td>
                      {Object.entries(r2Counts).map(([r2Cat, count]) => (
                        <td key={r2Cat} className={`p-2 text-center ${
                          r2Cat === r1Cat
                            ? 'font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {count}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-3">
            {conflicts.length > 0 && (
              <button
                onClick={handleStartResolution}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Resolve {conflicts.length} Conflicts
              </button>
            )}
            <button
              onClick={handleExportReconciled}
              className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Download Reconciled CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
