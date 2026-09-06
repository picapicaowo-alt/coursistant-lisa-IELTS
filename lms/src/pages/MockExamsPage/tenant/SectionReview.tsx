import {useTranslation} from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import {
  questionTitle,
  unitName,
  type Section,
  type SectionDraft,
} from './model';
import {QuestionPreview} from './QuestionPreview';
import {parseContent, questionDefinition} from './questionSchema';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './authoring.module.scss';

export function SectionReview({
  section,
  draft,
  disabled,
  onEdit,
}: {
  section: Section;
  draft: SectionDraft;
  disabled: boolean;
  onEdit: (index: number) => void;
}) {
  const {t: translate} = useTranslation();
  return (
    <div className={styles.review}>
      {draft.units.map((unit, index) => {
        const paragraphs = parseContent(unit.paragraphs);
        return (
          <div className={styles.reviewRow} key={unit.draftId}>
            <div className={styles.itemHeading}>
              <h3>{unitName(section, unit, index)}</h3>
              <button
                type="button"
                className={ui.textButton}
                disabled={disabled}
                onClick={() => onEdit(index)}
              >
                {translate('exams:authoring.editContent')}
              </button>
            </div>
            {section === 'writing' ? (
              <>
                <p>{unit.prompt}</p>
                <p>
                  {translate('exams:authoring.minimumWords', {number: formatNumber(Number(unit.minWords))})} ·{' '}
                  {translate(unit.mediaId ? 'exams:authoring.taskImageSelected' : 'exams:authoring.noTaskImage')}
                </p>
              </>
            ) : (
              <>
                {section === 'listening' ? (
                  <p>{translate('exams:authoring.audioSelected')}</p>
                ) : (
                  <>
                    <h4>{unit.title}</h4>
                    <p>{unit.intro}</p>
                    {Array.isArray(paragraphs) &&
                    paragraphs.every(
                      (paragraph) => typeof paragraph === 'string',
                    ) ? (
                      <p>{paragraphs.join('\n\n')}</p>
                    ) : (
                      <p className={styles.notice}>
                        {translate('exams:authoring.structuredReview')}
                      </p>
                    )}
                  </>
                )}
                {unit.questions.map((question) => (
                  <details key={question.draftId} className={styles.advanced}>
                    <summary>
                      {questionTitle(question)} ·{' '}
                      {translate(questionDefinition(section, question.kind)?.labelKey ?? 'exams:authoring.customTypeCode', {code: question.kind})}
                      {question.mediaId ? <> · {translate('exams:authoring.imageSelected')}</> : null}
                    </summary>
                    <QuestionPreview subject={section} question={question} />
                  </details>
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
