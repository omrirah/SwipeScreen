import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProject';
import db from '../lib/db';

export default function HomeScreen({ darkMode, setDarkMode }) {
  const { projects, loading } = useProjects();
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);
  const resumePhaseRef = useRef(null);
  const navigate = useNavigate();

  // Split projects by phase
  const titleProjects = projects.filter((p) => p.screeningPhase === 'title');
  const abstractProjects = projects.filter((p) => p.screeningPhase === 'abstract');

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

  const openResumeDialog = (phase) => {
    resumePhaseRef.current = phase;
    fileInputRef.current?.click();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderProjectList = (projectList) => {
    if (loading) return null;
    if (projectList.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
        {projectList.map((project) => (
          <div key={project.id} className="relative group">
            <Link
              to={project.isComplete ? `/project/${project.id}/results` : `/project/${project.id}/screen`}
              className="block bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate flex-1 min-w-0 mr-2">
                  {project.name}
                </h4>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                    project.isComplete
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {project.isComplete ? 'Done' : `${project.screened}/${project.totalArticles}`}
                </span>
              </div>
              <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${project.totalArticles ? (project.screened / project.totalArticles) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {project.reviewerName}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {formatDate(project.updatedAt)}
                </span>
              </div>
            </Link>

            {/* Delete button */}
            {deleteConfirm === project.id ? (
              <div className="absolute top-1.5 right-1.5 flex gap-1 z-10">
                <button
                  onClick={(e) => { e.preventDefault(); handleDelete(project.id); }}
                  className="px-2 py-0.5 text-[10px] bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); setDeleteConfirm(null); }}
                  className="px-2 py-0.5 text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.preventDefault(); setDeleteConfirm(project.id); }}
                className="absolute top-2 right-2 text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors z-10 opacity-0 group-hover:opacity-100"
                aria-label="Delete project"
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SwipeScreen</h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      <p className="text-gray-400 dark:text-gray-500 mb-6 text-xs">
        Systematic review screening. All data stays in your browser.
      </p>

      {/* Hidden file input for resume */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleResumeFromFile}
        className="hidden"
      />
      {importError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {importError}
        </div>
      )}

      {/* ── Pipeline stages ── */}
      <div className="space-y-4">

        {/* Stage 1: Title Screening */}
        <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
              1
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Title Screening
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Screen articles by title. Fast swipe-based decisions.
              </p>
              <div className="flex gap-2 mt-3">
                <Link
                  to="/project/new"
                  state={{ phase: 'title' }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  + New
                </Link>
                <button
                  onClick={() => openResumeDialog('title')}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Resume
                </button>
              </div>
              {renderProjectList(titleProjects)}
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className="flex justify-start ml-[22px]">
          <div className="w-0.5 h-4 bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Stage 2: Synthesis */}
        <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
              2
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Synthesis
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Upload reviewer CSVs, match articles, calculate agreement, resolve conflicts.
              </p>
              <div className="mt-3">
                <Link
                  to="/synthesis"
                  className="inline-block px-4 py-2 bg-purple-600 text-white text-sm rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Start Synthesis
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className="flex justify-start ml-[22px]">
          <div className="w-0.5 h-4 bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Stage 3: Abstract Screening */}
        <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
              3
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Abstract Screening
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Screen included articles by abstract. Upload reconciled CSV from synthesis.
              </p>
              <div className="flex gap-2 mt-3">
                <Link
                  to="/project/new"
                  state={{ phase: 'abstract' }}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                >
                  + New
                </Link>
                <button
                  onClick={() => openResumeDialog('abstract')}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Resume
                </button>
              </div>
              {renderProjectList(abstractProjects)}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
