import {useState, type SetStateAction} from 'react';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {ArrowLeft, ChevronLeft, ChevronRight, Plus} from 'lucide-react';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {getApiErrorMessage} from '@/utils/apiError';
import {
  SECTION_META,
  listeningPayload,
  readingPayload,
  writingPayload,
  newUnit,
  newQuestion,
  tenantContentWriteKey,
  type Section,
  type SectionDraft,
  type QuestionDraft,
} from './model';
import {TenantMediaManager} from './TenantMediaManager';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './tenant.module.scss';

export function TenantSectionComposer({
  templateId,
  versionId,
  section,
  draft,
  onChange,
  onMediaDeleted,
  onBack,
  onSaved,
}: {
  templateId: number;
  versionId: number;
  section: Section;
  draft: SectionDraft;
  onChange: (draft: SetStateAction<SectionDraft>) => void;
  onMediaDeleted: (id: number) => void;
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  const [active, setActive] = useState(0);
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const client = useQueryClient();
  const mutationKey = tenantContentWriteKey(templateId, versionId);
  const contentBusy = useIsMutating({mutationKey}) > 0;
  const meta = SECTION_META[section];
  const unit = draft.units[Math.min(active, draft.units.length - 1)];
  const update = (next: SetStateAction<SectionDraft>) => {
    setReview(false);
    setError('');
    onChange(next);
  };
  const changeUnit = (change: (current: typeof unit) => typeof unit) =>
    update((current) => ({
      ...current,
      units: current.units.map((item) =>
        item.draftId === unit.draftId ? change(item) : item,
      ),
    }));
  const patchUnit = (patch: Partial<typeof unit>) =>
    changeUnit((current) => ({...current, ...patch}));
  const patchQuestion = (index: number, patch: Partial<QuestionDraft>) => {
    const questionId = unit.questions[index].draftId;
    changeUnit((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.draftId === questionId ? {...question, ...patch} : question,
      ),
    }));
  };
  const selectMedia = (id: number | null, questionId?: string) =>
    update((current) => ({
      ...current,
      units: current.units.map((item) => {
        if (item.draftId !== unit.draftId) return item;
        return questionId
          ? {
              ...item,
              questions: item.questions.map((question) =>
                question.draftId === questionId
                  ? {...question, mediaId: id}
                  : question,
              ),
            }
          : {...item, mediaId: id};
      }),
    }));
  const save = useMutation({
    mutationKey,
    mutationFn: () => {
      if (client.isMutating({mutationKey}) > 1)
        throw new Error('Wait for the current content operation to finish.');
      return section === 'listening'
        ? mockExamApiService.createTenantListening(
            templateId,
            versionId,
            listeningPayload(draft),
          )
        : section === 'reading'
          ? mockExamApiService.createTenantReading(
              templateId,
              versionId,
              readingPayload(draft),
            )
          : mockExamApiService.createTenantWriting(
              templateId,
              versionId,
              writingPayload(draft),
            );
    },
    onSuccess: onSaved,
  });
  const prepare = () => {
    if (contentBusy) return;
    try {
      if (section === 'listening') listeningPayload(draft);
      else if (section === 'reading') readingPayload(draft);
      else writingPayload(draft);
      setError('');
      setReview(true);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : 'Review all fields before submitting.',
      );
    }
  };
  return (
    <div>
      <div
        className={styles.partNav}
        aria-label={`${meta.label} ${meta.unit.toLowerCase()} navigation`}
      >
        {draft.units.map((item, index) => (
          <button
            type="button"
            key={item.draftId}
            className={active === index ? styles.activePart : ''}
            aria-pressed={active === index}
            onClick={() => setActive(index)}
          >
            {meta.unit} {index + 1}
          </button>
        ))}
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            const added = newUnit();
            update((current) => ({
              ...current,
              units: [...current.units, added],
            }));
            setActive(draft.units.length);
          }}
        >
          <Plus size={15} />
          Add {meta.unit.toLowerCase()}
        </button>
      </div>
      <form
        className={ui.form}
        onSubmit={(event) => {
          event.preventDefault();
          prepare();
        }}
      >
        <fieldset className={styles.composerFields} disabled={save.isPending}>
          <section className={ui.surface}>
            <div className={ui.sectionHeading}>
              <h2>{meta.unit} settings</h2>
              {draft.units.length > 1 ? (
                <button
                  type="button"
                  className={ui.dangerLink}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${meta.unit.toLowerCase()} ${active + 1} from this unsaved draft?`,
                      )
                    ) {
                      update((current) => ({
                        ...current,
                        units: current.units.filter(
                          (item) => item.draftId !== unit.draftId,
                        ),
                      }));
                      setActive(Math.max(0, active - 1));
                    }
                  }}
                >
                  Remove {meta.unit.toLowerCase()}
                </button>
              ) : null}
            </div>
            <div className={ui.fieldGrid}>
              <label>
                <span>{meta.label} duration (minutes)</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={draft.minutes}
                  onChange={(event) => {
                    const minutes = event.target.value;
                    update((current) => ({...current, minutes}));
                  }}
                />
                <small className={ui.hint}>
                  Applies to the complete {meta.label.toLowerCase()} section.
                </small>
              </label>
              <label>
                <span>
                  {meta.unit} {section === 'writing' ? 'title' : 'label'}
                </span>
                <input
                  required
                  value={section === 'writing' ? unit.title : unit.label}
                  onChange={(event) =>
                    patchUnit(
                      section === 'writing'
                        ? {title: event.target.value}
                        : {label: event.target.value},
                    )
                  }
                />
              </label>
            </div>
          </section>
          {section === 'reading' ? (
            <section className={ui.surface}>
              <div className={ui.sectionHeading}>
                <h2>Passage content</h2>
              </div>
              <div className={ui.form}>
                <label>
                  <span>Passage title</span>
                  <input
                    value={unit.title}
                    onChange={(event) => patchUnit({title: event.target.value})}
                  />
                </label>
                <label>
                  <span>Introduction</span>
                  <textarea
                    value={unit.intro}
                    onChange={(event) => patchUnit({intro: event.target.value})}
                  />
                </label>
                <label>
                  <span>Paragraphs (JSON array)</span>
                  <textarea
                    className={styles.payload}
                    value={unit.paragraphs}
                    onChange={(event) =>
                      patchUnit({paragraphs: event.target.value})
                    }
                  />
                </label>
              </div>
            </section>
          ) : null}
          {section === 'writing' ? (
            <section className={ui.surface}>
              <div className={ui.sectionHeading}>
                <h2>Task content</h2>
              </div>
              <div className={ui.form}>
                <label>
                  <span>Writing prompt</span>
                  <textarea
                    required
                    value={unit.prompt}
                    onChange={(event) =>
                      patchUnit({prompt: event.target.value})
                    }
                  />
                </label>
                <label>
                  <span>Minimum words</span>
                  <input
                    required
                    type="number"
                    min="1"
                    value={unit.minWords}
                    onChange={(event) =>
                      patchUnit({minWords: event.target.value})
                    }
                  />
                </label>
              </div>
            </section>
          ) : null}
          {section !== 'writing'
            ? unit.questions.map((question, index) => (
                <section className={ui.surface} key={question.draftId}>
                  <div className={ui.sectionHeading}>
                    <h2>
                      {unit.questions.length === 1
                        ? 'Question content'
                        : `Question group ${index + 1}`}
                    </h2>
                    {unit.questions.length > 1 ? (
                      <button
                        type="button"
                        className={ui.dangerLink}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Remove this unsaved question group?',
                            )
                          )
                            changeUnit((current) => ({
                              ...current,
                              questions: current.questions.filter(
                                (item) => item.draftId !== question.draftId,
                              ),
                            }));
                        }}
                      >
                        Remove group
                      </button>
                    ) : null}
                  </div>
                  <div className={ui.form}>
                    <div className={ui.fieldGrid}>
                      <label>
                        <span>First question number</span>
                        <input
                          required
                          type="number"
                          min="1"
                          value={question.start}
                          onChange={(event) =>
                            patchQuestion(index, {start: event.target.value})
                          }
                        />
                      </label>
                      <label>
                        <span>Last question number</span>
                        <input
                          required
                          type="number"
                          min="1"
                          value={question.end}
                          onChange={(event) =>
                            patchQuestion(index, {end: event.target.value})
                          }
                        />
                      </label>
                    </div>
                    <label>
                      <span>Question group title</span>
                      <input
                        required
                        value={question.title}
                        onChange={(event) =>
                          patchQuestion(index, {title: event.target.value})
                        }
                      />
                    </label>
                    <label>
                      <span>Candidate instruction</span>
                      <textarea
                        value={question.instruction}
                        onChange={(event) =>
                          patchQuestion(index, {
                            instruction: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>Question kind</span>
                      <input
                        required
                        value={question.kind}
                        onChange={(event) =>
                          patchQuestion(index, {kind: event.target.value})
                        }
                        placeholder="Enter the question type"
                      />
                    </label>
                    <label>
                      <span>Question payload (JSON)</span>
                      <textarea
                        className={styles.payload}
                        value={question.payload}
                        onChange={(event) =>
                          patchQuestion(index, {payload: event.target.value})
                        }
                        spellCheck={false}
                      />
                    </label>
                    <p className={ui.hint}>
                      Use the payload defined for this question kind. The
                      supplied API does not enumerate a complete question-type
                      schema.
                    </p>
                    {section === 'reading' ? (
                      <>
                        <h3>Question image</h3>
                        <TenantMediaManager
                          key={question.draftId}
                          templateId={templateId}
                          versionId={versionId}
                          kind="READING_IMAGE"
                          selectedMediaId={question.mediaId}
                          onSelect={(id) => selectMedia(id, question.draftId)}
                          onDeleted={onMediaDeleted}
                        />
                      </>
                    ) : null}
                  </div>
                </section>
              ))
            : null}
          {section !== 'writing' ? (
            <button
              type="button"
              className={ui.secondaryButton}
              onClick={() => {
                const added = newQuestion();
                changeUnit((current) => ({
                  ...current,
                  questions: [...current.questions, added],
                }));
              }}
            >
              <Plus size={16} />
              Add question group
            </button>
          ) : null}
          {section !== 'reading' ? (
            <section className={ui.surface}>
              <div className={ui.sectionHeading}>
                <h2>Media</h2>
                <span className={ui.hint}>
                  {section === 'listening'
                    ? 'Audio required for this part'
                    : 'Optional task image'}
                </span>
              </div>
              <TenantMediaManager
                key={unit.draftId}
                templateId={templateId}
                versionId={versionId}
                kind={meta.mediaKind}
                selectedMediaId={unit.mediaId}
                onSelect={(id) => selectMedia(id)}
                onDeleted={onMediaDeleted}
              />
            </section>
          ) : null}
        </fieldset>
        {error || save.error ? (
          <p className={ui.inlineError} role="alert">
            {error ||
              getApiErrorMessage(
                save.error,
                'The section could not be created. Your draft is preserved.',
              )}
          </p>
        ) : null}
        {review ? (
          <section
            className={ui.confirmBox}
            aria-label="Review section submission"
          >
            <strong>
              Submit all {draft.units.length} {meta.unit.toLowerCase()}
              {draft.units.length === 1 ? '' : 's'}?
            </strong>
            <p>
              This creates the complete {meta.label.toLowerCase()} section. Once
              saved, its content is read only; there is no per-part update API.
            </p>
            <div>
              <button
                type="button"
                className={ui.primaryButton}
                disabled={contentBusy}
                onClick={() => save.mutate()}
              >
                {save.isPending
                  ? 'Creating section…'
                  : 'Confirm and create section'}
              </button>
              <button
                type="button"
                className={ui.secondaryButton}
                disabled={save.isPending}
                onClick={() => setReview(false)}
              >
                Keep editing
              </button>
            </div>
          </section>
        ) : null}
        <footer className={styles.composerFooter}>
          <div className={ui.actions}>
            <button className={ui.primaryButton} disabled={contentBusy}>
              Review complete section
            </button>
            <button
              type="button"
              className={ui.textButton}
              disabled={save.isPending}
              onClick={onBack}
            >
              <ArrowLeft size={16} />
              Back to version
            </button>
          </div>
          <div className={ui.actions}>
            <button
              type="button"
              className={ui.textButton}
              disabled={active === 0}
              onClick={() => setActive((index) => index - 1)}
            >
              <ChevronLeft size={16} />
              Previous {meta.unit.toLowerCase()}
            </button>
            <button
              type="button"
              className={ui.textButton}
              disabled={active === draft.units.length - 1}
              onClick={() => setActive((index) => index + 1)}
            >
              Next {meta.unit.toLowerCase()}
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
