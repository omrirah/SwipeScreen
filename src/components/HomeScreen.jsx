import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProject';
import db from '../lib/db';

export default function HomeScreen({ darkMode, setDarkMode }) {
  const { projects, loading } = useProjects();
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleDelete = async (projectId) => {
    await db.transaction('rw', [db.projects, db.articles, db.decisions], async () => {
      await db.decisions.where('projectId').equals(projectId).delete();
      await db.articles.where('projectId').equals(projectId).delete();
      await db.projects.delete(projectId);
    });
    setDeleteConfirm(null);
  };

  const handleResumeFromFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');

    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);

      if (!snapshot.version || !snapshot.project || !snapshot.articles) {
        setImportError('Invalid save file format.');
        return;
      }

      const { project, articles, decisions } = snapshot;
      delete project.id;

      const projectId = await db.projects.add({
        ...project,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const articleBatch = articles.map((a, i) => ({
        ...a,
        id: undefined,
        projectId,
        screeningOrder: a.screeningOrder ?? i,
      }));
      const newArticleIds = await db.articles.bulkAdd(articleBatch, { allKeys: true });

      // Build mapping from screeningOrder → new article ID
      const orderToNewId = {};
      articleBatch.forEach((a, i) => {
        orderToNewId[a.screeningOrder] = newArticleIds[i];
      });

      if (decisions && decisions.length > 0) {
        const decisionBatch = decisions.map((d) => ({
          ...d,
          id: undefined,
          projectId,
          articleId: d.articleScreeningOrder != null
            ? orderToNewId[d.articleScreeningOrder]
            : orderToNewId[d.articleId] ?? d.articleId,
        }));
        await db.decisions.bulkAdd(decisionBatch);
      }

      navigate(`/project/${projectId}/screen`);
    } catch (err) {
      setImportError(`Failed to import: ${err.message}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SwipeScreen</h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? 'Light' : 'Dark'}
        </button>
      </div>
      <p className="text-gray-400 dark:text-gray-500 mb-6 text-xs">
        Your data never leaves your device. All processing happens locally in your browser.
      </p>

      {/* Action buttons */}
      <div className="flex gap-3 mb-8">
        <Link
          to="/project/new"
          className="flex-1 text-center py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          New Project
        </Link>
        <Link
          to="/synthesis"
          className="flex-1 text-center py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Synthesis
        </Link>
      </div>

      {/* Resume from file */}
      <div className="mb-8">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleResumeFromFile}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Resume from saved file...
        </button>
        {importError && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1 text-center">{importError}</p>
        )}
      </div>

      {/* Project list */}
      {loading ? (
        <p className="text-center text-gray-400 dark:text-gray-500 py-8">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 dark:text-gray-500 mb-2">No projects yet.</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Create a new project to start screening.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div key={project.id} className="relative">
              <Link
                to={project.isComplete ? `/project/${project.id}/results` : `/project/${project.id}/screen`}
                className="block bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {project.reviewerName} &middot;{' '}
                      {project.screeningPhase === 'title' ? 'Title' : 'Abstract'} screening
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      project.isComplete
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {project.isComplete ? 'Done' : 'In progress'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${project.totalArticles ? (project.screened / project.totalArticles) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {project.screened} / {project.totalArticles} screened
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(project.updatedAt)}
                    </span>
                  </div>
                </div>
              </Link>

              {/* Delete button */}
              {deleteConfirm === project.id ? (
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <button
                    onClick={(e) => { e.preventDefault(); handleDelete(project.id); }}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Delete
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); setDeleteConfirm(null); }}
                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.preventDefault(); setDeleteConfirm(project.id); }}
                  className="absolute top-3 right-3 text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors z-10"
                  aria-label="Delete project"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
