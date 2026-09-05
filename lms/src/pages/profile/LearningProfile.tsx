import {useTranslation} from 'react-i18next';
import {formatNumber, formatNumericText} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import {useState} from 'react';
import {SkillIcon} from '@/components/SkillIcon';
import {ReleasedAssessments} from './ReleasedAssessments';
import {type StudentFacingProfileResponse} from '@/apis';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {formatPersonName} from '@/utils/personName';
import {formatPlanDate} from '@/utils/studyPlan';
import styles from './LearningProfile.module.scss';

export function LearningProfileSummary({
  profile,
}: {
  profile: StudentFacingProfileResponse;
}) {
  const {t: translate} = useTranslation();
  const advisorName = formatPersonName({
    firstName: profile.assignedAdvisorFirstName,
    middleName: profile.assignedAdvisorMiddleName,
    lastName: profile.assignedAdvisorLastName,
  });
  return (
    <div className={styles.summary}>
      <div className={styles.goal}>
        <span>{translate("learning:plan.baseline")}</span>
        <strong>{formatNumericText(profile.baselineAssessment) || translate("common:risk.notAssessed")}</strong>
      </div>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
      <div className={styles.goal}>
        <span>{profile.targetMetric || translate("learning:plan.goalLabel")}</span>
        <strong>
          {formatNumericText(profile.targetValue) || profile.targetGoal || translate("assessment:submission.notSet")}
        </strong>
      </div>
      <dl>
        <div>
          <dt>{translate("settings:learning.advisor")}</dt>
          <dd>
            {advisorName ||
              (profile.assignedAdvisorUserId
                ? translate('common:records.advisor', {id: formatNumber(profile.assignedAdvisorUserId)})
                : translate("course:learning.notAssigned"))}
          </dd>
        </div>
        <div>
          <dt>{translate("settings:learning.enrollment")}</dt>
          <dd>{statusLabel(profile.enrollmentStatus)}</dd>
        </div>
        <div>
          <dt>{translate("advising:studentWorkspace.targetDate")}</dt>
          <dd>
            {profile.targetDate
              ? formatPlanDate(profile.targetDate)
              : translate("assessment:submission.notSet")}
          </dd>
        </div>
      </dl>
    </div>
  );
}
export function LearningProfileDetails({
  profile,
}: {
  profile: StudentFacingProfileResponse;
}) {
  const {t: translate} = useTranslation();
  const [tab, setTab] = useState<'insights' | 'assessments'>('insights');
  const performance = profile.performanceSummary;
  return (
    <div className={styles.learningDetails}>
      <div className={styles.skills}>
        {[...(profile.skills ?? [])]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((skill, index) => {
            return <article key={skill.skillCode ?? index}>
              <span className={styles.skillSymbol} aria-hidden="true">
                <SkillIcon code={skill.skillCode}/>
              </span>
              <h2>{skill.displayName || statusLabel(skill.skillCode)}</h2>
              <strong>{formatNumericText(skill.currentValue) || translate("common:risk.notAssessed")}</strong>
              <small>
                {skill.scale}{' '}
                {skill.targetValue ? <>· {translate('advising:studentWorkspace.targetValue', {value: formatNumericText(skill.targetValue)})}</> : null}
              </small>
            </article>;
          })}
      </div>
      {(profile.skills?.length ?? 0) === 0 ? (
        <p className={styles.empty}>
          {translate("settings:learning.noSkills")}</p>
      ) : null}
      <div className={styles.insightLayout}>
        <section>
          <nav aria-label={translate("settings:learning.views")}>
            <button
              type="button"
              aria-pressed={tab === 'insights'}
              onClick={() => setTab('insights')}
            >
              {translate("settings:learning.insights")}</button>
            <button
              type="button"
              aria-pressed={tab === 'assessments'}
              onClick={() => setTab('assessments')}
            >
              {translate("settings:learning.assessments")}</button>
          </nav>
          {tab === 'insights' ? (
            <div className={styles.insights}>
              <article>
                <h2>{translate("settings:learning.goal")}</h2>
                <p>
                  {profile.targetGoal ||
                    translate("settings:learning.noGoal")}
                </p>
              </article>
              <article>
                <h2>{translate("settings:learning.focus")}</h2>
                {profile.skills?.some((skill) => skill.gapSummary) ? (
                  <ul>
                    {profile.skills
                      .filter((skill) => skill.gapSummary)
                      .map((skill, index) => (
                        <li key={skill.skillCode ?? index}>
                          <strong>
                            {skill.displayName || statusLabel(skill.skillCode)}
                          </strong>
                          <p>{skill.gapSummary}</p>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>{translate("settings:learning.noFocus")}</p>
                )}
              </article>
              <article>
                <h2>{translate("settings:learning.notes")}</h2>
                <p>
                  {profile.advisorInterpretation ||
                    translate("settings:learning.noNotes")}
                </p>
              </article>
            </div>
          ) : (
            <>
              <ReleasedAssessments />
              <div className={styles.assessments}>
                <h2>{translate("settings:learning.summary")}</h2>
                <dl>
                  {[
                    {
                      labelKey: 'settings:learning.releasedAssignments',
                      value: performance?.releasedAssignmentCount,
                    },
                    {
                      labelKey: 'settings:learning.average',
                      value: performance?.releasedScoreAverage,
                    },
                    {
                      labelKey: 'settings:learning.sessions',
                      value: performance?.completedSessionCount,
                    },
                    {
                      labelKey: 'settings:learning.tasks',
                      value: performance?.completedAdvisorTaskCount,
                    },
                    {
                      labelKey: 'settings:learning.reports',
                      value: performance?.publishedReportCount,
                    },
                  ].map((item) => (
                    <div key={item.labelKey}>
                      <dt>{translate(item.labelKey)}</dt>
                      <dd>{item.value == null ? translate("common:feedback.notAvailable") : formatNumber(item.value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}
        </section>
        <aside>
          <h2>{translate("settings:learning.activity")}</h2>
          <RecordSummaryList
            value={performance?.activityHistory ?? []}
            emptyMessage={translate("settings:learning.noActivity")}
          />
        </aside>
      </div>
    </div>
  );
}
