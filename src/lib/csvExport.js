import Papa from 'papaparse';
import db from './db';

export async function exportDecisionsCSV(projectId) {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Project not found');

  const articles = await db.articles
    .where('projectId')
    .equals(projectId)
    .toArray();

  const decisions = await db.decisions
    .where('projectId')
    .equals(projectId)
    .toArray();

  // Build decision lookup by articleId
  const decisionMap = {};
  for (const d of decisions) {
    decisionMap[d.articleId] = d;
  }

  // Build export rows: original CSV columns + screening columns
  const rows = articles
    .sort((a, b) => a.screeningOrder - b.screeningOrder)
    .map((article) => {
      const d = decisionMap[article.id];
      const row = { ...(article.rawRow || {}) };

      row.screening_decision = d ? d.decision : '';
      row.exclusion_reason = d?.exclusionReason || '';
      row.reviewer = d?.reviewer || project.reviewerName;
      row.screening_phase = d?.screeningPhase || project.screeningPhase;
      row.screening_timestamp = d ? new Date(d.timestamp).toISOString() : '';
      row.time_on_card_seconds = d ? (d.timeOnCardMs / 1000).toFixed(1) : '';

      return row;
    });

  const csv = Papa.unparse(rows);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${project.reviewerName}_${project.screeningPhase}_${dateStr}.csv`;
  triggerDownload(csv, filename);
}

export async function exportProgressJSON(projectId) {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Project not found');

  const articles = await db.articles
    .where('projectId')
    .equals(projectId)
    .toArray();

  const decisions = await db.decisions
    .where('projectId')
    .equals(projectId)
    .toArray();

  // Build a lookup from article DB id → screeningOrder for portable references
  const articleIdToOrder = {};
  for (const a of articles) {
    articleIdToOrder[a.id] = a.screeningOrder;
  }

  const snapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      reviewerName: project.reviewerName,
      screeningPhase: project.screeningPhase,
      inclusionCriteria: project.inclusionCriteria,
      exclusionCriteria: project.exclusionCriteria,
      exclusionReasons: project.exclusionReasons,
      currentIndex: project.currentIndex,
      totalArticles: project.totalArticles,
      columnMapping: project.columnMapping,
      sourceDatabase: project.sourceDatabase,
    },
    articles: articles.map(a => ({
      screeningOrder: a.screeningOrder,
      title: a.title,
      abstract: a.abstract,
      authors: a.authors,
      year: a.year,
      journal: a.journal,
      doi: a.doi,
      pmid: a.pmid,
      rawRow: a.rawRow,
    })),
    decisions: decisions.map(d => ({
      articleScreeningOrder: articleIdToOrder[d.articleId] ?? null,
      decision: d.decision,
      exclusionReason: d.exclusionReason,
      reviewer: d.reviewer,
      screeningPhase: d.screeningPhase,
      timestamp: d.timestamp,
      timeOnCardMs: d.timeOnCardMs,
    })),
  };

  const json = JSON.stringify(snapshot, null, 2);
  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_progress.json`;
  triggerDownload(json, filename, 'application/json');
}

function triggerDownload(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
