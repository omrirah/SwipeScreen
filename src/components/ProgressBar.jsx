export default function ProgressBar({ current, total, included, maybe, excluded }) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
        <span className="font-medium">{current} / {total}</span>
        <span className="text-gray-300 dark:text-gray-600">&middot;</span>
        <span className="text-green-600 dark:text-green-400">{included} included</span>
        <span className="text-gray-300 dark:text-gray-600">&middot;</span>
        <span className="text-yellow-600 dark:text-yellow-400">{maybe} maybe</span>
        <span className="text-gray-300 dark:text-gray-600">&middot;</span>
        <span className="text-red-600 dark:text-red-400">{excluded} excluded</span>
      </div>
    </div>
  );
}
