const DATABASE_SIGNATURES = {
  pubmed: {
    detect: (headers) => headers.some(h => h === 'PMID') && headers.some(h => h === 'Title'),
    mapping: {
      title: 'Title',
      abstract: 'Abstract',
      authors: 'Authors',
      year: 'Publication Year',
      journal: 'Journal/Book',
      doi: 'DOI',
      pmid: 'PMID',
      volume: 'Volume',
      issue: 'Issue',
      pages: 'Pages',
    },
  },
  scopus: {
    detect: (headers) =>
      headers.some(h => h === 'EID') ||
      (headers.some(h => h === 'Title') && headers.some(h => h === 'Source title')),
    mapping: {
      title: 'Title',
      abstract: 'Abstract',
      authors: 'Authors',
      year: 'Year',
      journal: 'Source title',
      doi: 'DOI',
      pmid: 'PubMed ID',
      volume: 'Volume',
      issue: 'Issue',
      pages: 'Page start',
      keywords: 'Author Keywords',
    },
  },
  wos: {
    detect: (headers) =>
      headers.some(h => h === 'UT (Unique WOS ID)') ||
      headers.some(h => h === 'Article Title'),
    mapping: {
      title: 'Article Title',
      abstract: 'Abstract',
      authors: 'Authors',
      year: 'Publication Year',
      journal: 'Source Title',
      doi: 'DOI',
      pmid: 'Pubmed Id',
      volume: 'Volume',
      issue: 'Issue',
      pages: 'Start Page',
      keywords: 'Author Keywords',
    },
  },
  embase: {
    detect: (headers) =>
      headers.some(h => h.toLowerCase().includes('embase')) ||
      (headers.some(h => h === 'Title') && headers.some(h => h === 'Source')),
    mapping: {
      title: 'Title',
      abstract: 'Abstract',
      authors: 'Authors',
      year: 'Year',
      journal: 'Source',
      doi: 'DOI',
      pmid: 'PMID',
    },
  },
  cochrane: {
    detect: (headers) =>
      headers.some(h => h.toLowerCase().includes('cochrane')) ||
      (headers.some(h => h === 'Title') && headers.some(h => h === 'Source') && headers.some(h => h === 'Year')),
    mapping: {
      title: 'Title',
      abstract: 'Abstract',
      authors: 'Authors',
      year: 'Year',
      journal: 'Source',
      doi: 'DOI',
    },
  },
};

const FUZZY_PATTERNS = {
  title: ['title', 'article title', 'document title'],
  abstract: ['abstract', 'description'],
  authors: ['author', 'authors', 'author(s)'],
  year: ['year', 'publication year', 'pub year', 'publication date'],
  journal: ['journal', 'source', 'source title', 'journal/book'],
  doi: ['doi', 'digital object identifier'],
  pmid: ['pmid', 'pubmed id', 'pubmed'],
};

const INTERNAL_FIELDS = ['title', 'abstract', 'authors', 'year', 'journal', 'doi', 'pmid'];

export function detectDatabase(headers) {
  const matches = [];

  for (const [source, sig] of Object.entries(DATABASE_SIGNATURES)) {
    if (sig.detect(headers)) {
      matches.push({ source, mapping: sig.mapping });
    }
  }

  if (matches.length === 1) {
    const { source, mapping } = matches[0];
    const validatedMapping = {};
    for (const [field, colName] of Object.entries(mapping)) {
      if (headers.includes(colName)) {
        validatedMapping[field] = colName;
      }
    }
    return { source, mapping: validatedMapping, confidence: 'auto' };
  }

  return { source: null, mapping: fuzzyMatch(headers), confidence: matches.length > 1 ? 'ambiguous' : 'fuzzy' };
}

export function fuzzyMatch(headers) {
  const mapping = {};
  const headersLower = headers.map(h => h.toLowerCase().trim());

  for (const field of INTERNAL_FIELDS) {
    const patterns = FUZZY_PATTERNS[field] || [];

    // Exact match first (case-insensitive)
    for (const pattern of patterns) {
      const idx = headersLower.indexOf(pattern);
      if (idx !== -1) {
        mapping[field] = headers[idx];
        break;
      }
    }

    // Substring match fallback
    if (!mapping[field]) {
      for (const pattern of patterns) {
        const idx = headersLower.findIndex(h => h.includes(pattern));
        if (idx !== -1 && !Object.values(mapping).includes(headers[idx])) {
          mapping[field] = headers[idx];
          break;
        }
      }
    }
  }

  return mapping;
}

export function applyMapping(row, mapping) {
  const article = {};
  for (const [field, colName] of Object.entries(mapping)) {
    article[field] = row[colName] || '';
  }
  article.rawRow = { ...row };
  return article;
}

export { INTERNAL_FIELDS, DATABASE_SIGNATURES };
