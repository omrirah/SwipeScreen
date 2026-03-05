import Dexie from 'dexie';

const db = new Dexie('SwipeScreenDB');

db.version(1).stores({
  projects: '++id, name, createdAt',
  articles: '++id, projectId, doi, pmid, title, [projectId+screeningOrder]',
  decisions: '++id, projectId, articleId, [projectId+articleId], timestamp',
  synthesisProjects: '++id, projectId, createdAt',
});

export default db;
