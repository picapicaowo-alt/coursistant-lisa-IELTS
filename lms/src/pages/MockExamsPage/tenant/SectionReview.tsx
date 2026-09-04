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
                Edit content
              </button>
            </div>
            {section === 'writing' ? (
              <>
                <p>{unit.prompt}</p>
                <p>
                  Minimum {unit.minWords} words ·{' '}
                  {unit.mediaId ? 'Task image selected' : 'No task image'}
                </p>
              </>
            ) : (
              <>
                {section === 'listening' ? (
                  <p>Audio selected</p>
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
                        Structured passage content retained. Review its Advanced
                        paragraph data before submission.
                      </p>
                    )}
                  </>
                )}
                {unit.questions.map((question) => (
                  <details key={question.draftId} className={styles.advanced}>
                    <summary>
                      {questionTitle(question)} ·{' '}
                      {questionDefinition(section, question.kind)?.label ??
                        `Custom type: ${question.kind}`}
                      {question.mediaId ? ' · Image selected' : ''}
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
