/**
 * Calculate Cohen's kappa for two raters.
 */
export function calculateKappa(rater1, rater2) {
  if (rater1.length !== rater2.length) {
    throw new Error('Rater arrays must have equal length');
  }

  const n = rater1.length;
  if (n === 0) return { kappa: null, observed: 0, expected: 0, matrix: {}, interpretation: 'N/A', n: 0, agreements: 0 };

  const categories = [...new Set([...rater1, ...rater2])];

  // Build confusion matrix
  const matrix = {};
  categories.forEach(c1 => {
    matrix[c1] = {};
    categories.forEach(c2 => {
      matrix[c1][c2] = 0;
    });
  });

  for (let i = 0; i < n; i++) {
    matrix[rater1[i]][rater2[i]]++;
  }

  // Observed agreement
  let agreements = 0;
  categories.forEach(c => { agreements += matrix[c][c]; });
  const Po = agreements / n;

  // Expected agreement
  let Pe = 0;
  categories.forEach(c => {
    let r1Count = 0;
    categories.forEach(c2 => { r1Count += matrix[c][c2]; });
    let r2Count = 0;
    categories.forEach(c1 => { r2Count += matrix[c1][c]; });
    Pe += (r1Count / n) * (r2Count / n);
  });

  let kappa;
  if (Pe === 1) {
    kappa = 1;
  } else {
    kappa = (Po - Pe) / (1 - Pe);
  }

  return {
    kappa: Math.round(kappa * 1000) / 1000,
    observed: Math.round(Po * 1000) / 1000,
    expected: Math.round(Pe * 1000) / 1000,
    matrix,
    interpretation: interpretKappa(kappa),
    n,
    agreements,
  };
}

/**
 * Calculate Fleiss' kappa for 3+ raters.
 * @param {string[][]} ratings - Array of arrays, each inner array is one rater's decisions (aligned by index)
 */
export function calculateFleissKappa(ratings) {
  const numRaters = ratings.length;
  if (numRaters < 2) throw new Error('Need at least 2 raters');
  const n = ratings[0].length;
  if (n === 0) return { kappa: null, interpretation: 'N/A', n: 0 };

  // Collect all unique categories
  const categories = [...new Set(ratings.flat())];
  const k = categories.length;

  // Build count matrix: for each subject i, count how many raters assigned each category
  const countMatrix = [];
  for (let i = 0; i < n; i++) {
    const counts = {};
    categories.forEach(c => { counts[c] = 0; });
    for (let r = 0; r < numRaters; r++) {
      counts[ratings[r][i]]++;
    }
    countMatrix.push(counts);
  }

  // Calculate P_i for each subject
  const Pi = countMatrix.map(counts => {
    let sum = 0;
    categories.forEach(c => {
      sum += counts[c] * counts[c];
    });
    return (sum - numRaters) / (numRaters * (numRaters - 1));
  });

  // P-bar (mean of P_i)
  const Pbar = Pi.reduce((a, b) => a + b, 0) / n;

  // p_j for each category (proportion of all assignments in category j)
  const pj = {};
  categories.forEach(c => {
    let total = 0;
    countMatrix.forEach(counts => { total += counts[c]; });
    pj[c] = total / (n * numRaters);
  });

  // Pe-bar
  let PeBar = 0;
  categories.forEach(c => {
    PeBar += pj[c] * pj[c];
  });

  let kappa;
  if (PeBar === 1) {
    kappa = 1;
  } else {
    kappa = (Pbar - PeBar) / (1 - PeBar);
  }

  return {
    kappa: Math.round(kappa * 1000) / 1000,
    observed: Math.round(Pbar * 1000) / 1000,
    expected: Math.round(PeBar * 1000) / 1000,
    interpretation: interpretKappa(kappa),
    n,
    numRaters,
  };
}

function interpretKappa(kappa) {
  if (kappa === null) return 'N/A';
  if (kappa < 0) return 'Poor (less than chance)';
  if (kappa <= 0.20) return 'Slight agreement';
  if (kappa <= 0.40) return 'Fair agreement';
  if (kappa <= 0.60) return 'Moderate agreement';
  if (kappa <= 0.80) return 'Substantial agreement';
  return 'Almost perfect agreement';
}
