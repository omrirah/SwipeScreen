export function calculatePrismaNumbers({ totalIdentified, duplicatesRemoved = 0, decisions, synthesisData = null }) {
  const screened = totalIdentified - duplicatesRemoved;

  const included = decisions.filter(d => d.decision === 'include').length;
  const excluded = decisions.filter(d => d.decision === 'exclude').length;
  const maybe = decisions.filter(d => d.decision === 'maybe').length;

  const exclusionBreakdown = {};
  decisions
    .filter(d => d.decision === 'exclude' && d.exclusionReason)
    .forEach(d => {
      exclusionBreakdown[d.exclusionReason] = (exclusionBreakdown[d.exclusionReason] || 0) + 1;
    });

  return {
    identification: {
      databaseRecords: totalIdentified,
      duplicatesRemoved,
    },
    screening: {
      recordsScreened: screened,
      recordsExcluded: excluded,
      recordsMaybe: maybe,
      exclusionReasons: exclusionBreakdown,
    },
    included: {
      studiesIncluded: included + maybe, // maybe treated as include for conservative screening
    },
    synthesis: synthesisData ? {
      agreementRate: synthesisData.agreements / synthesisData.n,
      kappa: synthesisData.kappa,
      conflictsResolved: synthesisData.conflictsResolved || 0,
      finalIncluded: synthesisData.finalIncluded || 0,
      finalExcluded: synthesisData.finalExcluded || 0,
    } : null,
  };
}
