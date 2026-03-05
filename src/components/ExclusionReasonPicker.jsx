export default function ExclusionReasonPicker({ reasons, onSelect }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-2xl shadow-2xl p-4 pb-8 safe-area-bottom animate-slide-up">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
        Exclusion reason (optional)
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
        {reasons.map((reason, i) => (
          <button
            key={reason}
            onClick={() => onSelect(reason)}
            className="px-3 py-2 rounded-full text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors border border-red-200 dark:border-red-800"
          >
            <span className="text-xs text-red-400 dark:text-red-500 mr-1">{i + 1}</span>
            {reason}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
        Swipe next card to skip
      </p>
    </div>
  );
}
