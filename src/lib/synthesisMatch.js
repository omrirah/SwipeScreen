import Papa from 'papaparse';

/**
 * Parse a reviewer CSV export and extract decisions.
 */
export function parseReviewerCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          reject(new Error('CSV contains no data'));
          return;
        }

        // Find reviewer name from the data
        const firstRow = results.data[0];
        const reviewerName = firstRow.reviewer || file.name.replace('.csv', '');

        resolve({
          reviewerName,
          data: results.data,
          headers: results.meta.fields || [],
        });
      },
      error: (err) => reject(new Error(`Parse error: ${err.message}`)),
    });
  });
}

/**
 * Normalize a DOI for matching.
 */
function normalizeDOI(doi) {
  if (!doi) return '';
  return doi
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/i, '');
}

/**
 * Normalize a title for exact matching.
 */
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity ratio (0 to 1).
 */
function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Find the screening_decision column value for a row.
 */
function getDecision(row) {
  return (row.screening_decision || row.decision || '').toLowerCase().trim();
}

function getExclusionReason(row) {
  return row.exclusion_reason || row.exclusionReason || '';
}

/**
 * Find a title-like column in a row.
 */
function getTitle(row) {
  return row.Title || row.title || row['Article Title'] || '';
}

function getDOI(row) {
  return row.DOI || row.doi || '';
}

function getPMID(row) {
  return row.PMID || row.pmid || row['PubMed ID'] || '';
}

/**
 * Match articles across multiple reviewer datasets.
 * Returns { matched, unmatched, fuzzyPending }
 */
export function matchReviewers(reviewerDatasets) {
  // Use first reviewer as the anchor
  const anchor = reviewerDatasets[0];
  const others = reviewerDatasets.slice(1);

  const matched = [];
  const unmatched = reviewerDatasets.map(() => []);
  const fuzzyPending = [];

  // Index other reviewers by DOI, PMID, and normalized title
  const otherIndices = others.map(other => {
    const byDOI = new Map();
    const byPMID = new Map();
    const byTitle = new Map();
    const used = new Set();

    other.data.forEach((row, idx) => {
      const doi = normalizeDOI(getDOI(row));
      const pmid = (getPMID(row) || '').trim();
      const title = normalizeTitle(getTitle(row));

      if (doi) byDOI.set(doi, idx);
      if (pmid) byPMID.set(pmid, idx);
      if (title) byTitle.set(title, idx);
    });

    return { byDOI, byPMID, byTitle, used };
  });

  // Try to match each anchor article
  anchor.data.forEach((anchorRow, anchorIdx) => {
    const anchorDOI = normalizeDOI(getDOI(anchorRow));
    const anchorPMID = (getPMID(anchorRow) || '').trim();
    const anchorTitle = normalizeTitle(getTitle(anchorRow));
    const anchorTitleRaw = getTitle(anchorRow);

    const otherMatches = [];
    let allMatched = true;

    for (let oi = 0; oi < others.length; oi++) {
      const idx = otherIndices[oi];
      let matchIdx = -1;
      let matchedBy = '';

      // Priority 1: DOI
      if (anchorDOI && idx.byDOI.has(anchorDOI) && !idx.used.has(idx.byDOI.get(anchorDOI))) {
        matchIdx = idx.byDOI.get(anchorDOI);
        matchedBy = 'DOI';
      }

      // Priority 2: PMID
      if (matchIdx === -1 && anchorPMID && idx.byPMID.has(anchorPMID) && !idx.used.has(idx.byPMID.get(anchorPMID))) {
        matchIdx = idx.byPMID.get(anchorPMID);
        matchedBy = 'PMID';
      }

      // Priority 3: Exact title
      if (matchIdx === -1 && anchorTitle && idx.byTitle.has(anchorTitle) && !idx.used.has(idx.byTitle.get(anchorTitle))) {
        matchIdx = idx.byTitle.get(anchorTitle);
        matchedBy = 'Title (exact)';
      }

      if (matchIdx !== -1) {
        idx.used.add(matchIdx);
        otherMatches.push({ reviewerIndex: oi + 1, rowIndex: matchIdx, matchedBy });
      } else {
        allMatched = false;

        // Try fuzzy title match
        if (anchorTitle) {
          let bestMatch = -1;
          let bestSim = 0;
          let bestOtherTitle = '';

          others[oi].data.forEach((otherRow, otherIdx) => {
            if (idx.used.has(otherIdx)) return;
            const otherTitle = normalizeTitle(getTitle(otherRow));
            if (!otherTitle) return;

            const sim = similarity(anchorTitle, otherTitle);
            if (sim >= 0.9 && sim > bestSim) {
              bestSim = sim;
              bestMatch = otherIdx;
              bestOtherTitle = getTitle(otherRow);
            }
          });

          if (bestMatch !== -1) {
            fuzzyPending.push({
              anchorIdx,
              anchorTitle: anchorTitleRaw,
              otherReviewerIndex: oi + 1,
              otherRowIndex: bestMatch,
              otherTitle: bestOtherTitle,
              similarity: Math.round(bestSim * 100),
            });
          }
        }
      }
    }

    if (allMatched && otherMatches.length === others.length) {
      const pair = {
        title: anchorTitleRaw,
        doi: getDOI(anchorRow),
        decisions: [
          { reviewer: anchor.reviewerName, decision: getDecision(anchorRow), reason: getExclusionReason(anchorRow) },
        ],
        rawRows: [anchorRow],
        matchedBy: otherMatches.map(m => m.matchedBy),
      };

      for (const om of otherMatches) {
        const otherRow = others[om.reviewerIndex - 1].data[om.rowIndex];
        pair.decisions.push({
          reviewer: others[om.reviewerIndex - 1].reviewerName,
          decision: getDecision(otherRow),
          reason: getExclusionReason(otherRow),
        });
        pair.rawRows.push(otherRow);
      }

      matched.push(pair);
    }
  });

  // Collect unmatched from each reviewer
  // Track which anchor indices were matched
  const anchorMatchedTitles = new Set(matched.map(m => normalizeTitle(m.title)));
  const unmatchedPerReviewer = [];

  // Unmatched from anchor (reviewer 0)
  anchor.data.forEach((row, idx) => {
    const title = normalizeTitle(getTitle(row));
    if (!anchorMatchedTitles.has(title)) {
      unmatchedPerReviewer.push({
        reviewerIndex: 0,
        articleTitle: getTitle(row) || `Row ${idx + 1}`,
        reason: 'no match found',
      });
    }
  });

  // Unmatched from other reviewers
  for (let oi = 0; oi < others.length; oi++) {
    const idx = otherIndices[oi];
    others[oi].data.forEach((row, rowIdx) => {
      if (!idx.used.has(rowIdx)) {
        unmatchedPerReviewer.push({
          reviewerIndex: oi + 1,
          articleTitle: getTitle(row) || `Row ${rowIdx + 1}`,
          reason: 'no match found',
        });
      }
    });
  }

  return { matched, fuzzyPending, totalPerReviewer: reviewerDatasets.map(r => r.data.length), unmatchedPerReviewer };
}
