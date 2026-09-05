export const PRIORITY_LABELS: Record<string, string> = {HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low'};
export const RISK_LABELS: Record<string, string> = {ON_TRACK: 'On track', AT_RISK: 'At risk', NEEDS_ATTENTION: 'Needs attention'};
export const ACTION_CATEGORY_LABELS: Record<string, string> = {
  APPROVAL: 'Approval',
  RISK: 'Risk',
  FOLLOW_UP: 'Follow-up',
  REVIEW: 'Review',
  PLANNING: 'Planning',
  ONGOING: 'Ongoing',
};
export const ACTION_STATUS_LABELS: Record<string, string> = {PENDING: 'Pending', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved'};

// Semantic keys coexist with legacy labels while shared consumers migrate to i18n.
export const PRIORITY_KEYS: Record<string, string> = {HIGH: 'common:priority.high', MEDIUM: 'common:priority.medium', LOW: 'common:priority.low'};
export const RISK_KEYS: Record<string, string> = {ON_TRACK: 'common:risk.onTrack', AT_RISK: 'common:risk.atRisk', NEEDS_ATTENTION: 'common:risk.needsAttention'};
export const ACTION_CATEGORY_KEYS: Record<string, string> = {
  APPROVAL: 'common:category.approval',
  RISK: 'common:category.risk',
  FOLLOW_UP: 'common:category.followUp',
  REVIEW: 'common:category.review',
  PLANNING: 'common:category.planning',
  ONGOING: 'common:category.ongoing',
};
export const ACTION_STATUS_KEYS: Record<string, string> = {PENDING: 'common:status.pending', IN_PROGRESS: 'common:status.inProgress', RESOLVED: 'common:status.resolved'};
