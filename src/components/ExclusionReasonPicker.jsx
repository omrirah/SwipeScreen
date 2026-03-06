export default function ExclusionReasonPicker({ reasons, articleTitle, onSelect, onSkip }) {
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1 uppercase tracking-wide">
          Excluded
        </p>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug">
          {articleTitle || 'Untitled'}
        </h2>
      </div>

      {/* Reasons */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
          Select an exclusion reason
        </p>
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          {reasons.map((reason, i) => (
            <button
              key={reason}
              onClick={() => onSelect(reason)}
              className="w-full px-4 py-3 rounded-xl text-left bg-red-50 dark:bg-red-900/20 text-gray-800 dark:text-gray-200 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-800 active:scale-[0.98]"
            >
              <span className="text-xs text-red-400 dark:text-red-500 mr-2 font-mono">{i + 1}</span>
              {reason}
            </button>
          ))}
        </div>
      </div>

      {/* Skip button */}
      <div className="px-4 pb-8 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onSkip}
          className="w-full max-w-md mx-auto block px-4 py-3 rounded-xl text-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Skip (no reason)
        </button>
      </div>
    </div>
  );
}
