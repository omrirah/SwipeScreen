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

export default function SwipeCard({ article, screeningPhase, index = 0 }) {
  if (!article) return null;

  const colorIndex = index % CARD_COLORS.length;
  const bgColor = CARD_COLORS[colorIndex];
  const darkBgColor = DARK_CARD_COLORS[colorIndex];

  return (
    <div
      className="w-full max-w-[600px] rounded-2xl shadow-lg p-5 select-none relative overflow-hidden"
      style={{
        backgroundColor: bgColor,
        minHeight: screeningPhase === 'abstract' ? '200px' : '160px',
      }}
    >
      {/* Dark mode overlay */}
      <div
        className="absolute inset-0 hidden dark:block rounded-2xl"
        style={{ backgroundColor: darkBgColor }}
      />

      {/* Content */}
      <div className="relative z-[1]">
        {/* Title */}
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug mb-2">
          {article.title || 'Untitled'}
        </h2>

        {/* Abstract — no max-height, parent controls scrolling */}
        {screeningPhase === 'abstract' && article.abstract && (
          <div className="mb-2">
            <p className="text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed">
              {article.abstract}
            </p>
          </div>
        )}

        {/* Metadata footer */}
        <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-1">
          {article.authors && (
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {article.authors}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500 flex-wrap">
            {article.year && <span>{article.year}</span>}
            {article.journal && <span className="truncate">{article.journal}</span>}
            {article.doi && (
              <a
                href={`https://doi.org/${article.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                DOI
              </a>
            )}
            {article.pmid && (
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                PubMed
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { CARD_COLORS };
