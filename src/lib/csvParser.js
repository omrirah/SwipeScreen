import Papa from 'papaparse';
import db from './db';
import { applyMapping } from './columnMapper';

export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error(`CSV parse error: ${results.errors[0].message}`));
          return;
        }
        resolve({
          headers: results.meta.fields || [],
          data: results.data,
          rowCount: results.data.length,
          errors: results.errors,
        });
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}

export async function importArticlesToDB(projectId, data, mapping, onProgress, filterIncludedOnly = false) {
  // For abstract screening from reconciled CSV: only import included articles
  let filteredData = data;
  if (filterIncludedOnly) {
    filteredData = data.filter(row => {
      const finalDecision = (row.final_decision || row.screening_decision || '').toLowerCase().trim();
      return finalDecision === 'include' || finalDecision === 'maybe';
    });
  }

  const batchSize = 500;
  const total = filteredData.length;

  // Generate randomized screening order
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  for (let i = 0; i < total; i += batchSize) {
    const batch = [];
    const end = Math.min(i + batchSize, total);

    for (let j = i; j < end; j++) {
      const row = filteredData[indices[j]];
      const article = applyMapping(row, mapping);
      batch.push({
        projectId,
        screeningOrder: j,
        title: article.title || '',
        abstract: article.abstract || '',
        authors: article.authors || '',
        year: article.year || '',
        journal: article.journal || '',
        doi: article.doi || '',
        pmid: article.pmid || '',
        rawRow: article.rawRow,
      });
    }

    await db.articles.bulkAdd(batch);

    if (onProgress) {
      onProgress(Math.min(end, total), total);
    }
  }

  return total;
}
