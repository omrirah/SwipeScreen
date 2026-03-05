import { useState, useEffect } from 'react';

const shortcuts = [
  { keys: ['\u2192', 'K'], action: 'Include (accept)' },
  { keys: ['\u2190', 'J'], action: 'Exclude (reject)' },
  { keys: ['\u2191', 'M'], action: 'Maybe (unsure)' },
  { keys: ['Ctrl+Z'], action: 'Undo last decision' },
  { keys: ['?'], action: 'Show/hide shortcuts' },
  { keys: ['Esc'], action: 'Back to home' },
];

export default function KeyboardShortcuts() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '?' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setShow(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 right-4 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors z-40"
        aria-label="Show keyboard shortcuts"
      >
        ?
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShow(false)}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h3>
          <button
            onClick={() => setShow(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            &times;
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map(({ keys, action }) => (
            <div key={action} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{action}</span>
              <div className="flex gap-1">
                {keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono border border-gray-200 dark:border-gray-600"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
