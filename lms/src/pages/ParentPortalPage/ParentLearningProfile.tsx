import {
  CalendarDays,
  ChartNoAxesCombined,
  GraduationCap,
  MessageSquareText,
  Star,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import {AdvisingBadge} from '@/components/AdvisingBadge';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {asRecord, parentDate, parentLabel, parentText, withoutFields} from './parentPresentation';
import styles from './index.module.scss';

const PROFILE_FIELDS: Array<{key: string; label: string; icon: LucideIcon; date?: boolean}> = [
  {key: 'intakeBackground', label: 'Intake background', icon: UserRound},
  {key: 'academicBackground', label: 'Academic background', icon: GraduationCap},
  {key: 'targetGoal', label: 'Target goal', icon: Target},
  {key: 'targetMetric', label: 'Target metric', icon: ChartNoAxesCombined},
  {key: 'targetValue', label: 'Target value', icon: Star},
  {key: 'targetDate', label: 'Target date', icon: CalendarDays, date: true},
  {key: 'advisorInterpretation', label: 'Advisor interpretation', icon: MessageSquareText},
];

export function ParentLearningProfile({value, risk}: {value: unknown; risk: unknown}) {
  const profile = asRecord(value);
  const riskRecord = asRecord(risk);
  const riskStatus = parentText(riskRecord, 'riskStatus') || parentText(riskRecord, 'status');
  if (!profile) return <RecordSummaryList value={value} emptyMessage="The learning profile will appear here when it is shared."/>;
  const visible = PROFILE_FIELDS.flatMap(field => {
    const raw = parentText(profile, field.key);
    return raw ? [{...field, value: field.date ? parentDate(raw) : raw}] : [];
  });
  const additional = withoutFields(profile, ['student', ...PROFILE_FIELDS.map(field => field.key)]);
  return <>
    {riskStatus ? <div className={styles.profileStatus}><span>Learning status</span><AdvisingBadge kind="risk" value={riskStatus} label={parentLabel(riskStatus)}/></div> : null}
    {visible.length ? <dl className={styles.profileFacts}>{visible.map(({key, label, icon: Icon, value: display}) => <div key={key}>
      <span className={styles.iconTile}><Icon size={21} aria-hidden="true"/></span>
      <div><dt>{label}</dt><dd data-emphasis={key === 'targetValue' || undefined}>{display}</dd></div>
    </div>)}</dl> : <p className={styles.meta}>No learning profile details have been shared yet.</p>}
    {Object.keys(additional).length ? <details className={styles.details}><summary>More profile details</summary><RecordSummaryList value={additional}/></details> : null}
  </>;
}
