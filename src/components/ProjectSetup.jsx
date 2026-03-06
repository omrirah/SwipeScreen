import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseCSVFile, importArticlesToDB } from '../lib/csvParser';
import { detectDatabase, INTERNAL_FIELDS } from '../lib/columnMapper';
import db from '../lib/db';

const FIELD_LABELS = {
  title: 'Title *',
  abstract: 'Abstract',
  authors: 'Authors',
  year: 'Year',
  journal: 'Journal / Source',
  doi: 'DOI',
  pmid: 'PMID',
};

const DEFAULT_EXCLUSION_REASONS = [
  'Wrong Population',
  'Wrong Intervention/Exposure',
  'Wrong Comparator',
  'Wrong Outcome',
  'Wrong Study Design',
  'Duplicate',
  'Not Original Research',
  'Other',
];

export default function ProjectSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1: Project info
  const [projectName, setProjectName] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [screeningPhase, setScreeningPhase] = useState('title');
  const [inclusionCriteria, setInclusionCriteria] = useState('');
  const [exclusionCriteria, setExclusionCriteria] = useState('');
  const [exclusionReasons, setExclusionReasons] = useState(DEFAULT_EXCLUSION_REASONS.join('\n'));

  // Step 2: CSV upload
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  // Step 3: Column mapping
  const [mapping, setMapping] = useState({});
  const [detectedSource, setDetectedSource] = useState(null);
  const [confidence, setConfidence] = useState(null);

  // Step 4: Import
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      setParseError('Please upload a CSV file (.csv or .txt)');
      return;
    }

    setIsParsing(true);
    setParseError('');
    setCsvFile(file);

    try {
      const result = await parseCSVFile(file);
      if (result.rowCount === 0) {
        setParseError('CSV contains no data rows.');
        setIsParsing(false);
        return;
      }

      setCsvData(result.data);
      setCsvHeaders(result.headers);

      const detection = detectDatabase(result.headers);
      setDetectedSource(detection.source);
      setConfidence(detection.confidence);
      setMapping(detection.mapping);

      setIsParsing(false);
      setStep(3);
    } catch (err) {
      setParseError(err.message);
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleMappingChange = (field, value) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (value === '') {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const canProceedStep1 = projectName.trim() && reviewerName.trim();
  const canProceedStep3 = mapping.title;

  const handleStartScreening = async () => {
    setIsImporting(true);

    try {
      const projectId = await db.projects.add({
        name: projectName.trim(),
        reviewerName: reviewerName.trim(),
        screeningPhase,
        inclusionCriteria: inclusionCriteria.split('\n').map(s => s.trim()).filter(Boolean),
        exclusionCriteria: exclusionCriteria.split('\n').map(s => s.trim()).filter(Boolean),
        exclusionReasons: exclusionReasons.split('\n').map(s => s.trim()).filter(Boolean),
        currentIndex: 0,
        totalArticles: csvData.length,
        columnMapping: mapping,
        sourceDatabase: detectedSource || 'unknown',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const importedCount = await importArticlesToDB(projectId, csvData, mapping, (done, total) => {
        setImportProgress({ done, total });
      }, screeningPhase === 'abstract');

      // Update totalArticles to actual imported count (may differ if filtered)
      if (importedCount !== csvData.length) {
        await db.projects.update(projectId, { totalArticles: importedCount });
      }

      navigate(`/project/${projectId}/screen`);
    } catch (err) {
      setParseError(`Import failed: ${err.message}`);
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">New Project</h1>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Project Info */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Project Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Knee arthroplasty outcomes SR"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reviewer Name / Initials
            </label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="e.g., OR"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Screening Phase
            </label>
            <div className="flex gap-3">
              {['title', 'abstract'].map((phase) => (
                <button
                  key={phase}
                  onClick={() => setScreeningPhase(phase)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    screeningPhase === phase
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {phase === 'title' ? 'Title Screening (Pass 1)' : 'Abstract Screening (Pass 2)'}
                </button>
              ))}
            </div>
          </div>

          {screeningPhase === 'abstract' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Inclusion Criteria (one per line)
                </label>
                <textarea
                  value={inclusionCriteria}
                  onChange={(e) => setInclusionCriteria(e.target.value)}
                  rows={3}
                  placeholder={"e.g., RCTs comparing intervention X vs Y\nAdult population (>18 years)\nPublished 2010-2024"}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Exclusion Criteria (one per line)
                </label>
                <textarea
                  value={exclusionCriteria}
                  onChange={(e) => setExclusionCriteria(e.target.value)}
                  rows={3}
                  placeholder={"e.g., Animal studies\nCase reports\nNon-English language"}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Exclusion Reasons for Quick-Select (one per line)
                </label>
                <textarea
                  value={exclusionReasons}
                  onChange={(e) => setExclusionReasons(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                />
              </div>
            </>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!canProceedStep1}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next: Upload CSV
          </button>
        </div>
      )}

      {/* Step 2: CSV Upload */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Upload Search Results</h2>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('csv-input').click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            <input
              id="csv-input"
              type="file"
              accept=".csv,.txt"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="hidden"
            />
            {isParsing ? (
              <p className="text-gray-500 dark:text-gray-400">Parsing CSV...</p>
            ) : csvFile ? (
              <div>
                <p className="text-gray-700 dark:text-gray-300 font-medium">{csvFile.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {(csvFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  Drop your CSV file here, or click to browse
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Supports PubMed, EMBASE, Scopus, Web of Science, Cochrane exports
                </p>
              </div>
            )}
          </div>

          {parseError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {parseError}
            </div>
          )}

          <button
            onClick={() => setStep(1)}
            className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            &larr; Back
          </button>
        </div>
      )}

      {/* Step 3: Column Mapping */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Map Columns</h2>

          {detectedSource && confidence === 'auto' && (
            <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
              Detected format: <strong>{detectedSource}</strong> — columns auto-mapped
            </div>
          )}

          {confidence === 'ambiguous' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-sm">
              Multiple database formats matched. Please verify the column mapping below.
            </div>
          )}

          {confidence === 'fuzzy' && mapping.title && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
              Columns mapped by header names. Please verify below.
            </div>
          )}

          {confidence === 'fuzzy' && !mapping.title && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-sm">
              Could not auto-detect columns. Please map them manually below.
            </div>
          )}

          <div className="space-y-3">
            {INTERNAL_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-3">
                <label className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
                  {FIELD_LABELS[field]}
                </label>
                <select
                  value={mapping[field] || ''}
                  onChange={(e) => handleMappingChange(field, e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="">(not available)</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {!canProceedStep3 && (
            <p className="text-sm text-red-500 dark:text-red-400">
              Title column mapping is required.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              &larr; Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!canProceedStep3}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Review & Start</h2>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-2 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Project</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{projectName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Reviewer</span>
              <span className="text-gray-900 dark:text-gray-100">{reviewerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Phase</span>
              <span className="text-gray-900 dark:text-gray-100">
                {screeningPhase === 'title' ? 'Title Screening' : 'Abstract Screening'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Articles</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{csvData?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Source format</span>
              <span className="text-gray-900 dark:text-gray-100">{detectedSource || 'Manual'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Mapped fields</span>
              <span className="text-gray-900 dark:text-gray-100">
                {Object.keys(mapping).length} / {INTERNAL_FIELDS.length}
              </span>
            </div>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                  style={{ width: `${importProgress.total ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Importing... {importProgress.done} / {importProgress.total} articles
              </p>
            </div>
          )}

          {parseError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {parseError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              disabled={isImporting}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              &larr; Back
            </button>
            <button
              onClick={handleStartScreening}
              disabled={isImporting}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isImporting ? 'Importing...' : 'Start Screening'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
