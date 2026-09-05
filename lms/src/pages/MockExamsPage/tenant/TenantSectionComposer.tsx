import {useTranslation} from 'react-i18next';
import {advisingErrorMessage} from '@/pages/advising/advisingErrors';
import {useEffect, useRef, useState, type SetStateAction} from 'react';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {Plus} from 'lucide-react';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {
  SECTION_META,
  listeningPayload,
  readingPayload,
  writingPayload,
  newUnit,
  newQuestion,
  newDraft,
  tenantContentWriteKey,
  sectionIssues,
  questionTitle,
  type Section,
  type SectionDraft,
  type QuestionDraft,
} from './model';
import {TenantMediaManager} from './TenantMediaManager';
import {QuestionEditor} from './QuestionEditor';
import {QuestionPreview} from './QuestionPreview';
import {PassageEditor} from './PassageEditor';
import {SectionReview} from './SectionReview';
import {QuestionRangeFields} from './QuestionRangeFields';
import {ReadingImport} from './ReadingImport';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './tenant.module.scss';
import authoring from './authoring.module.scss';

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
  const {t: translate} = useTranslation();
  const [active, setActive] = useState(0);
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [showIssues, setShowIssues] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const reviewPanel = useRef<HTMLElement>(null);
  const client = useQueryClient();
  const mutationKey = tenantContentWriteKey(templateId, versionId);
  const contentBusy = useIsMutating({mutationKey}) > 0;
  const meta = SECTION_META[section];
  const unit = draft.units[Math.min(active, draft.units.length - 1)];
  const issues = sectionIssues(section, draft);
  const nextQuestionNumber =
    Math.max(
      0,
      ...draft.units.flatMap((item) =>
        item.questions.map((question) => Number(question.end) || 0),
      ),
    ) + 1;
  useEffect(() => {
    const target = review
      ? reviewPanel.current
      : showIssues
        ? feedback.current
        : null;
    target?.focus();
    target?.scrollIntoView({block: 'nearest'});
  }, [review, showIssues]);
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
      if (sectionIssues(section, draft).length)
        throw new Error(
          'Some content needs attention. Keep editing and review the section again.',
        );
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
    if (issues.length) {
      setShowIssues(true);
      setReview(false);
      feedback.current?.focus();
      feedback.current?.scrollIntoView({block: 'nearest'});
      return;
    }
    try {
      if (section === 'listening') listeningPayload(draft);
      else if (section === 'reading') readingPayload(draft);
      else writingPayload(draft);
      setError('');
      setShowIssues(false);
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
    <div className={authoring.composer}>
      {section !== 'writing' ? <div className={authoring.notice} role="note">
        <strong>Correct answers are required before saving.</strong>
        <p>Enter official accepted answers in the question form, or include verified answer keys in imported or advanced question data. A preview alone does not mean the paper is ready to save or assign.</p>
      </div> : null}
      {section === 'reading' && !review ? (
        <ReadingImport
          templateId={templateId}
          versionId={versionId}
          draft={draft}
          disabled={contentBusy}
          onApply={(imported) => {
            update(imported);
            setActive(0);
            setShowIssues(false);
          }}
        />
      ) : null}
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
            disabled={save.isPending}
            onClick={() => {
              setActive(index);
              setReview(false);
            }}
          >
            {meta.unit} {index + 1}
          </button>
        ))}
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            const added = newUnit();
            if (
              section === 'reading' &&
              draft.units.some((item) => item.seq !== undefined)
            )
              added.seq =
                draft.units.reduce(
                  (max, item, index) => Math.max(max, item.seq ?? index + 1),
                  0,
                ) + 1;
            added.questions[0].start = String(nextQuestionNumber);
            added.questions[0].end = String(nextQuestionNumber);
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
      <div className={authoring.layout}>
        <form
          className={ui.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            prepare();
          }}
        >
          <fieldset
            className={styles.composerFields}
            disabled={save.isPending}
            hidden={review}
          >
            <section className={`${ui.surface} ${authoring.surface}`}>
              <div className={ui.sectionHeading}>
                <h2>{meta.unit} Settings</h2>
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
              <div className={`${ui.fieldGrid} ${authoring.settingsGrid}`}>
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
                    {meta.unit} {section === 'writing' ? 'title' : 'name'}
                  </span>
                  <input
                    value={section === 'writing' ? unit.title : unit.label}
                    placeholder={`${meta.unit} ${active + 1}`}
                    aria-describedby="unit-name-help"
                    aria-label={`${meta.unit} ${section === 'writing' ? 'title' : 'name'}`}
                    onChange={(event) =>
                      patchUnit(
                        section === 'writing'
                          ? {title: event.target.value}
                          : {label: event.target.value},
                      )
                    }
                  />
                  <small id="unit-name-help" className={ui.hint}>
                    Shown to students. Leave blank to use “{meta.unit}{' '}
                    {active + 1}”.
                  </small>
                </label>
                {section !== 'writing' && unit.questions.length === 1 ? (
                  <QuestionRangeFields
                    question={unit.questions[0]}
                    onChange={(patch) => patchQuestion(0, patch)}
                  />
                ) : null}
              </div>
            </section>
            {section === 'reading' ? (
              <section className={`${ui.surface} ${authoring.surface}`}>
                <div className={ui.sectionHeading}>
                  <h2>Passage content</h2>
                </div>
                <div className={ui.form}>
                  <label>
                    <span>Passage title</span>
                    <input
                      value={unit.title}
                      onChange={(event) =>
                        patchUnit({title: event.target.value})
                      }
                    />
                  </label>
                  <label>
                    <span>Introduction</span>
                    <textarea
                      value={unit.intro}
                      onChange={(event) =>
                        patchUnit({intro: event.target.value})
                      }
                    />
                  </label>
                  <PassageEditor
                    key={unit.draftId}
                    value={unit.paragraphs}
                    onChange={(paragraphs) => patchUnit({paragraphs})}
                  />
                </div>
              </section>
            ) : null}
            {section === 'writing' ? (
              <section className={`${ui.surface} ${authoring.surface}`}>
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
                  <section
                    className={`${ui.surface} ${authoring.surface}`}
                    key={question.draftId}
                    aria-label={`Content for question group ${index + 1}`}
                  >
                    <div className={ui.sectionHeading}>
                      <h2>
                        {unit.questions.length === 1
                          ? 'Content'
                          : `Content · Group ${index + 1}`}
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
                    <div className={`${ui.form} ${authoring.fields}`}>
                      {unit.questions.length > 1 ? (
                        <div
                          className={`${ui.fieldGrid} ${authoring.settingsGrid}`}
                        >
                          <QuestionRangeFields
                            question={question}
                            onChange={(patch) => patchQuestion(index, patch)}
                          />
                        </div>
                      ) : null}
                      <label>
                        <span>Question group title (optional)</span>
                        <input
                          value={question.title}
                          placeholder={questionTitle(question)}
                          onChange={(event) =>
                            patchQuestion(index, {title: event.target.value})
                          }
                        />
                      </label>
                      <label>
                        <span>Instructions for students</span>
                        <textarea
                          value={question.instruction}
                          placeholder="For example: Choose the correct letter, A, B or C."
                          onChange={(event) =>
                            patchQuestion(index, {
                              instruction: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  </section>
                ))
              : null}
            {section !== 'reading' ? (
              <section className={`${ui.surface} ${authoring.surface}`}>
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
            ) : (
              <section className={`${ui.surface} ${authoring.surface}`}>
                <div className={ui.sectionHeading}>
                  <h2>Media</h2>
                </div>
                <div className={authoring.fields}>
                  {unit.questions.map((question, index) => (
                    <div key={question.draftId}>
                      <p className={authoring.mediaLabel}>
                        {unit.questions.length === 1
                          ? 'Question image (optional)'
                          : `Group ${index + 1} image (optional)`}
                      </p>
                      <TenantMediaManager
                        templateId={templateId}
                        versionId={versionId}
                        kind="READING_IMAGE"
                        selectedMediaId={question.mediaId}
                        onSelect={(id) => selectMedia(id, question.draftId)}
                        onDeleted={onMediaDeleted}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {section !== 'writing' ? (
              <section
                className={`${ui.surface} ${authoring.surface}`}
                aria-label="Question configuration"
              >
                <div className={ui.sectionHeading}>
                  <h2>Question Configuration</h2>
                </div>
                <div className={authoring.fields}>
                  {unit.questions.map((question, index) => (
                    <div
                      key={question.draftId}
                      role="group"
                      aria-label={`Question group ${index + 1}`}
                    >
                      {unit.questions.length > 1 ? (
                        <h3 className={authoring.groupTitle}>
                          Question group {index + 1}
                        </h3>
                      ) : null}
                      <QuestionEditor
                        subject={section}
                        question={question}
                        onChange={(patch) => patchQuestion(index, patch)}
                        suggestedNumber={nextQuestionNumber}
                      />
                      <details className={authoring.advanced}>
                        <summary>Preview this question group</summary>
                        <QuestionPreview
                          key={question.payload + question.kind}
                          subject={section}
                          question={question}
                        />
                      </details>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={`${ui.textButton} ${authoring.addGroup}`}
                    onClick={() => {
                      const added = newQuestion();
                      if (
                        unit.questions.some(
                          (item) => item.sortOrder !== undefined,
                        )
                      )
                        added.sortOrder =
                          unit.questions.reduce(
                            (max, item, index) =>
                              Math.max(max, item.sortOrder ?? index + 1),
                            0,
                          ) + 1;
                      added.start = String(nextQuestionNumber);
                      added.end = String(nextQuestionNumber);
                      changeUnit((current) => ({
                        ...current,
                        questions: [...current.questions, added],
                      }));
                    }}
                  >
                    <Plus size={16} /> Add question group
                  </button>
                </div>
              </section>
            ) : null}
          </fieldset>
          {showIssues && issues.length ? (
            <div
              ref={feedback}
              tabIndex={-1}
              className={authoring.notice}
              role="alert"
            >
              <strong>
                {issues.length} item{issues.length === 1 ? '' : 's'} to check
                before review
              </strong>
              <ul>
                {issues.map((issue, index) => (
                  <li key={`${issue.unitIndex}-${issue.groupIndex}-${index}`}>
                    <button
                      type="button"
                      className={ui.textButton}
                      onClick={() => {
                        if (issue.unitIndex !== null)
                          setActive(issue.unitIndex);
                        setReview(false);
                        requestAnimationFrame(() => {
                          const element = feedback.current
                            ?.closest('form')
                            ?.querySelector<HTMLElement>(
                              issue.groupIndex !== undefined
                                ? `[aria-label="Question group ${issue.groupIndex + 1}"]`
                                : 'fieldset',
                            );
                          element?.scrollIntoView({block: 'start'});
                          element
                            ?.querySelector<HTMLElement>(
                              'select, input, textarea',
                            )
                            ?.focus();
                        });
                      }}
                    >
                      {issue.unitIndex === null
                        ? meta.label
                        : `${meta.unit} ${issue.unitIndex + 1}${issue.groupIndex === undefined ? '' : ` · Group ${issue.groupIndex + 1}`}`}
                      : {issue.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!review && (error || save.error) ? (
            <p className={ui.inlineError} role="alert">
              {error ||
                advisingErrorMessage(
                  save.error,
                  'The section could not be created. Your draft is preserved.',
                )}
            </p>
          ) : null}
          {review ? (
            <section
              ref={reviewPanel}
              tabIndex={-1}
              className={`${ui.surface} ${authoring.surface} ${authoring.review}`}
              aria-label="Review section submission"
            >
              <h2>
                {draft.units.length === 1
                  ? `Submit this ${meta.unit.toLowerCase()}?`
                  : `Submit all ${draft.units.length} ${meta.unit.toLowerCase()}s?`}
              </h2>
              <p>
                {meta.label} · {draft.minutes} minutes · {draft.units.length}{' '}
                {meta.unit.toLowerCase()}
                {draft.units.length === 1 ? '' : 's'}
              </p>
              <SectionReview
                section={section}
                draft={draft}
                disabled={save.isPending}
                onEdit={(index) => {
                  setReview(false);
                  setActive(index);
                }}
              />
              {section !== 'writing' ? <p className={authoring.notice}>
                Answer-key format checks do not verify which answers are correct or
                how the backend scores them. Confirm the official answers with
                your content team before publishing.
              </p> : <p className={authoring.notice}>Writing responses are reviewed by the instructor selected when the exam is assigned.</p>}
              <p>
                This creates the complete {meta.label.toLowerCase()} section.
                Once saved, its content is read only. Make any final edits
                before confirming.
              </p>
              {save.error ? (
                <p className={ui.inlineError} role="alert">
                  {advisingErrorMessage(
                    save.error,
                    'The section could not be created. Your draft is preserved. Try again when ready.',
                  )}
                </p>
              ) : null}
              <div className={ui.actions}>
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
          {!review ? (
            <p className={authoring.saveHint}>
              Draft content stays in this browser tab. Review every{' '}
              {meta.unit.toLowerCase()} before saving; saved sections are read
              only.
            </p>
          ) : null}
          <footer className={styles.composerFooter} hidden={review}>
            <div className={ui.actions}>
              <button
                className={ui.primaryButton}
                disabled={contentBusy || review}
              >
                Review &amp; save
              </button>
              <button
                type="button"
                className={ui.secondaryButton}
                disabled={contentBusy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Discard the unsaved ${meta.label.toLowerCase()} section, including all ${meta.unit.toLowerCase()}s? Uploaded files will not be deleted.`,
                    )
                  ) {
                    update(newDraft());
                    setActive(0);
                    setShowIssues(false);
                    onBack();
                  }
                }}
              >
                Discard draft
              </button>
            </div>
            <div className={ui.actions}>
              <button
                type="button"
                className={ui.textButton}
                disabled={active === 0 || save.isPending}
                onClick={() => {
                  setActive((index) => index - 1);
                  setReview(false);
                }}
              >

          {translate(`common:navigationControls.previousExamUnit.${section}`)}
              </button>
              <button
                type="button"
                className={ui.textButton}
                disabled={active === draft.units.length - 1 || save.isPending}
                onClick={() => {
                  setActive((index) => index + 1);
                  setReview(false);
                }}
              >
          {translate(`common:navigationControls.nextExamUnit.${section}`)}

              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
