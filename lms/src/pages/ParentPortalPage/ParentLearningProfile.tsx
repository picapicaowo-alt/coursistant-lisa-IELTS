import {recordFieldLabel, displayScalar} from '@/components/RecordSummaryList/recordPresentation';
import {useTranslation} from 'react-i18next';
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
import {asRecord, parentText, withoutFields} from './parentPresentation';
import styles from './index.module.scss';

const PROFILE_FIELDS: Array<{key: string; icon: LucideIcon;}> = [
  {key: 'intakeBackground', icon: UserRound},
  {key: 'academicBackground', icon: GraduationCap},
  {key: 'targetGoal', icon: Target},
  {key: 'targetMetric', icon: ChartNoAxesCombined},
  {key: 'targetValue', icon: Star},
  {key: 'targetDate', icon: CalendarDays},
  {key: 'advisorInterpretation', icon: MessageSquareText},
];

export function ParentLearningProfile({value, risk}: {value: unknown; risk: unknown}) {
  const {t: translate} = useTranslation();
  const profile = asRecord(value);
  const riskRecord = asRecord(risk);
  const riskStatus = parentText(riskRecord, 'riskStatus') || parentText(riskRecord, 'status');
  if (!profile) return <RecordSummaryList value={value} emptyMessage={translate("learning:parent.noProfile")}/>;
  const visible = PROFILE_FIELDS.flatMap(field => {
    const display = displayScalar(profile[field.key], field.key);
    return display != null ? [{...field, value: display}] : [];
  });
  const additional = withoutFields(profile, ['student', ...PROFILE_FIELDS.map(field => field.key)]);
  return <>
    {riskStatus ? <div className={styles.profileStatus}><span>{translate("learning:parent.learningStatus")}</span><AdvisingBadge kind="risk" value={riskStatus}/></div> : null}
    {visible.length ? <dl className={styles.profileFacts}>{visible.map(({key, icon: Icon, value: display}) => <div key={key}>
      <span className={styles.iconTile}><Icon size={21} aria-hidden="true"/></span>
      <div><dt>{recordFieldLabel(key)}</dt><dd data-emphasis={key === 'targetValue' || undefined}>{display}</dd></div>
    </div>)}</dl> : <p className={styles.meta}>{translate("learning:parent.noProfileDetails")}</p>}
    {Object.keys(additional).length ? <details className={styles.details}><summary>{translate("learning:parent.moreProfile")}</summary><RecordSummaryList value={additional}/></details> : null}
  </>;
}
