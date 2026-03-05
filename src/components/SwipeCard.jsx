const CARD_COLORS = [
  '#FFDAB9', // soft peach
  '#E6E6FA', // lavender
  '#F0FFF0', // mint
  '#FFF8DC', // cream
  '#FFE4E1', // rose
  '#F0F8FF', // sky
  '#FAF0E6', // champagne
  '#F5FFFA', // sage
];

const DARK_CARD_COLORS = [
  '#3d2e1f', // dark peach
  '#2e2e3d', // dark lavender
  '#1f3d2e', // dark mint
  '#3d3a1f', // dark cream
  '#3d2e2e', // dark rose
  '#1f2e3d', // dark sky
  '#3d361f', // dark champagne
  '#1f3d2e', // dark sage
];

export default function SwipeCard({ article, screeningPhase, stampDirection, index = 0 }) {
  if (!article) return null;

  const colorIndex = index % CARD_COLORS.length;
  const bgColor = CARD_COLORS[colorIndex];
  const darkBgColor = DARK_CARD_COLORS[colorIndex];

  return (
    <div
      className="w-full max-w-[600px] rounded-2xl shadow-lg p-6 select-none relative overflow-hidden"
      style={{
        backgroundColor: bgColor,
        minHeight: screeningPhase === 'abstract' ? '400px' : '200px',
      }}
    >
      {/* Dark mode overlay */}
      <div
        className="absolute inset-0 hidden dark:block rounded-2xl"
        style={{ backgroundColor: darkBgColor }}
      />

      {/* Stamp overlays */}
      {stampDirection === 'right' && (
        <div className="absolute top-8 left-4 -rotate-12 border-4 border-green-500 text-green-500 text-3xl font-bold px-4 py-2 rounded-lg opacity-70 z-10 pointer-events-none">
          INCLUDE
        </div>
      )}
      {stampDirection === 'left' && (
        <div className="absolute top-8 right-4 rotate-12 border-4 border-red-500 text-red-500 text-3xl font-bold px-4 py-2 rounded-lg opacity-70 z-10 pointer-events-none">
          EXCLUDE
        </div>
      )}
      {stampDirection === 'up' && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 border-4 border-yellow-500 text-yellow-500 text-3xl font-bold px-4 py-2 rounded-lg opacity-70 z-10 pointer-events-none">
          MAYBE
        </div>
      )}

      <div className="relative z-[1]">
        {/* Title */}
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug mb-3">
          {article.title || 'Untitled'}
        </h2>

        {/* Abstract (only in abstract screening mode) */}
        {screeningPhase === 'abstract' && article.abstract && (
          <div className="abstract-scroll overflow-y-auto max-h-[300px] mb-3 -webkit-overflow-scrolling-touch">
            <p className="text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed">
              {article.abstract}
            </p>
          </div>
        )}

        {/* Metadata footer */}
        <div className="mt-auto pt-3 border-t border-black/10 dark:border-white/10 space-y-1">
          {article.authors && (
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {article.authors}
            </p>
          )}
          <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-500">
            {article.year && <span>{article.year}</span>}
            {article.journal && <span className="truncate">{article.journal}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export { CARD_COLORS };
