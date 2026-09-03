import {useState} from 'react';
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
  const advisorName = formatPersonName({
    firstName: profile.assignedAdvisorFirstName,
    middleName: profile.assignedAdvisorMiddleName,
    lastName: profile.assignedAdvisorLastName,
  });
  return (
    <div className={styles.summary}>
      <div className={styles.goal}>
        <span>Baseline assessment</span>
        <strong>{profile.baselineAssessment || 'Not assessed'}</strong>
      </div>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
      <div className={styles.goal}>
        <span>{profile.targetMetric || 'Learning goal'}</span>
        <strong>
          {profile.targetValue || profile.targetGoal || 'Not set'}
        </strong>
      </div>
      <dl>
        <div>
          <dt>Assigned advisor</dt>
          <dd>
            {advisorName ||
              (profile.assignedAdvisorUserId
                ? `Advisor #${profile.assignedAdvisorUserId}`
                : 'Not assigned')}
          </dd>
        </div>
        <div>
          <dt>Enrollment status</dt>
          <dd>{profile.enrollmentStatus || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Target date</dt>
          <dd>
            {profile.targetDate
              ? formatPlanDate(profile.targetDate)
              : 'Not set'}
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
  const [tab, setTab] = useState<'insights' | 'assessments'>('insights');
  const performance = profile.performanceSummary;
  return (
    <div className={styles.learningDetails}>
      <div className={styles.skills}>
        {[...(profile.skills ?? [])]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((skill, index) => (
            <article key={skill.skillCode ?? index}>
              <span className={styles.skillSymbol} aria-hidden="true">
                {(skill.displayName || skill.skillCode || '').slice(0, 1)}
              </span>
              <h2>{skill.displayName || skill.skillCode}</h2>
              <strong>{skill.currentValue || 'Not assessed'}</strong>
              <small>
                {skill.scale}{' '}
                {skill.targetValue ? `· Target ${skill.targetValue}` : ''}
              </small>
            </article>
          ))}
      </div>
      {(profile.skills?.length ?? 0) === 0 ? (
        <p className={styles.empty}>
          Your advisor has not added skill assessments yet.
        </p>
      ) : null}
      <div className={styles.insightLayout}>
        <section>
          <nav aria-label="Learning profile views">
            <button
              type="button"
              aria-pressed={tab === 'insights'}
              onClick={() => setTab('insights')}
            >
              Insights
            </button>
            <button
              type="button"
              aria-pressed={tab === 'assessments'}
              onClick={() => setTab('assessments')}
            >
              Assessments
            </button>
          </nav>
          {tab === 'insights' ? (
            <div className={styles.insights}>
              <article>
                <h2>Learning Goal</h2>
                <p>
                  {profile.targetGoal ||
                    'Your advisor will help you set your goal.'}
                </p>
              </article>
              <article>
                <h2>Focus Areas</h2>
                {profile.skills?.some((skill) => skill.gapSummary) ? (
                  <ul>
                    {profile.skills
                      .filter((skill) => skill.gapSummary)
                      .map((skill, index) => (
                        <li key={skill.skillCode ?? index}>
                          <strong>
                            {skill.displayName || skill.skillCode}
                          </strong>
                          <p>{skill.gapSummary}</p>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>No focus areas recorded yet.</p>
                )}
              </article>
              <article>
                <h2>Advisor Notes</h2>
                <p>
                  {profile.advisorInterpretation ||
                    'Your advisor has not shared an interpretation yet.'}
                </p>
              </article>
            </div>
          ) : (
            <>
              <ReleasedAssessments />
              <div className={styles.assessments}>
                <h2>Learning Summary</h2>
                <dl>
                  {[
                    {
                      label: 'Released assignments',
                      value: performance?.releasedAssignmentCount,
                    },
                    {
                      label: 'Released score average',
                      value: performance?.releasedScoreAverage,
                    },
                    {
                      label: 'Completed sessions',
                      value: performance?.completedSessionCount,
                    },
                    {
                      label: 'Completed advisor tasks',
                      value: performance?.completedAdvisorTaskCount,
                    },
                    {
                      label: 'Published reports',
                      value: performance?.publishedReportCount,
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value ?? 'Not available'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}
        </section>
        <aside>
          <h2>Recent Activity</h2>
          <RecordSummaryList
            value={performance?.activityHistory ?? []}
            emptyMessage="No activity has been recorded yet."
          />
        </aside>
      </div>
    </div>
  );
}
