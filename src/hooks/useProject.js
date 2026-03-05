import { useLiveQuery } from 'dexie-react-hooks';
import db from '../lib/db';

export function useProjects() {
  const projects = useLiveQuery(async () => {
    const allProjects = await db.projects.orderBy('createdAt').reverse().toArray();

    const enriched = await Promise.all(
      allProjects.map(async (project) => {
        const decisionCount = await db.decisions
          .where('projectId')
          .equals(project.id)
          .count();

        return {
          ...project,
          screened: decisionCount,
          isComplete: decisionCount >= project.totalArticles,
        };
      })
    );

    return enriched;
  }, []);

  return { projects: projects || [], loading: projects === undefined };
}

export function useProject(projectId) {
  const id = Number(projectId);

  const project = useLiveQuery(
    () => db.projects.get(id),
    [id]
  );

  const updateProject = async (updates) => {
    await db.projects.update(id, { ...updates, updatedAt: Date.now() });
  };

  const deleteProject = async () => {
    await db.transaction('rw', [db.projects, db.articles, db.decisions], async () => {
      await db.decisions.where('projectId').equals(id).delete();
      await db.articles.where('projectId').equals(id).delete();
      await db.projects.delete(id);
    });
  };

  return {
    project: project || null,
    loading: project === undefined,
    updateProject,
    deleteProject,
  };
}
