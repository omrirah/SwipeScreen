// Non-blocking strip shown under the card after an exclude in abstract mode.
// Tagging a reason is entirely optional: the decision is already saved, and
// the reviewer can keep screening (or dismiss with Esc / the close button)
// without ever touching this bar.
export default function ExclusionReasonBar({ reasons, articleTitle, onSelect, onDismiss }) {
  return (
    <div
      className="px-4 pb-1 max-w-[600px] w-full mx-auto shrink-0"
      role="region"
      aria-label="Optional exclusion reason"
    >
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate min-w-0">
            <span className="font-semibold text-red-600 dark:text-red-400">Excluded</span>
            {' '}&middot; add a reason (optional):{' '}
            <span className="italic">{articleTitle || 'Untitled'}</span>
          </p>
          <button
            onClick={onDismiss}
            className="shrink-0 w-6 h-6 rounded-full text-gray-400 dark:text-gray-500 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-gray-600 dark:hover:text-gray-300 transition-colors leading-none"
            aria-label="Dismiss (no reason)"
          >
            &times;
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {reasons.map((reason, i) => (
            <button
              key={reason}
              onClick={() => onSelect(reason)}
              className="px-2.5 py-1 rounded-lg text-xs text-left bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-800 active:scale-[0.97]"
            >
              {/* Number hint only where a matching 1-9 key shortcut exists */}
              {i < 9 && (
                <span className="text-red-400 dark:text-red-500 mr-1 font-mono">{i + 1}</span>
              )}
              {reason}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
