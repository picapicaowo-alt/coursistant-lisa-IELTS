import {LocalizedError} from '@/i18n/errors';
import {useConfirmationDialog} from '@/components/TeachingWorkspace/useConfirmationDialog';
import i18n from '@/i18n';
import {formatNumber} from '@/i18n/formatting';
import { useTranslation } from 'react-i18next';
import {useEffect, useRef, useState, type SetStateAction} from 'react';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {Plus} from 'lucide-react';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {advisingErrorMessage} from '@/pages/advising/advisingErrors';
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
  const { t: translate } = useTranslation();
  const [active, setActive] = useState(0);
  const confirmation = useConfirmationDialog(`${templateId}/${versionId}/${section}/${active}`);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const [review, setReview] = useState(false);
  const [error, setError] = useState<unknown>(null);
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
    setError(null);
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
        throw new LocalizedError("exams:templates.contentBusy");
      if (sectionIssues(section, draft).length)
        throw new LocalizedError("exams:authoring.needsAttention");
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
      setError(null);
      setShowIssues(false);
      setReview(true);
    } catch (problem) {
      setError(problem);
    }
  };
  return (
    <div className={authoring.composer}>
      {confirmation.dialog}
      {section !== "writing" ? <div className={authoring.notice} role="note">
        <strong>{translate("exams:authoring.answersRequired")}</strong>
        <p>{translate("exams:authoring.answersRequiredHelp")}</p>
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
        aria-label={translate('exams:authoring.unitNavigation', {section: translate(meta.labelKey), unit: translate(meta.unitKey).toLowerCase()})}
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
            {translate(meta.numberKey, {number: formatNumber(index + 1)})}
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
          {translate('common:actions.addItem', {item: translate(meta.unitKey).toLowerCase()})}
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
                <h2>{translate('exams:authoring.unitSettings', {unit: translate(meta.unitKey)})}</h2>
                {draft.units.length > 1 ? (
                  <button
                    type="button"
                    className={ui.dangerLink}
                    onClick={async () => {
                      if (
                        await confirmation.confirm({titleKey: 'common:actions.remove', messageKey: 'exams:authoring.removeUnitConfirm', valueKeys: {unit: meta.unitKey}}) && latestDraft.current === draft
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
                    {translate('common:actions.removeItem', {item: translate(meta.unitKey).toLowerCase()})}
                  </button>
                ) : null}
              </div>
              <div className={`${ui.fieldGrid} ${authoring.settingsGrid}`}>
                <label>
                  <span>{translate('exams:authoring.duration', {section: translate(meta.labelKey)})}</span>
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
                    {translate('exams:authoring.durationHelp', {section: translate(meta.labelKey).toLowerCase()})}
                  </small>
                </label>
                <label>
                  <span>
                    {translate(section === 'writing' ? 'exams:authoring.unitTitle' : 'exams:authoring.unitName', {unit: translate(meta.unitKey)})}
                  </span>
                  <input
                    value={section === 'writing' ? unit.title : unit.label}
                    placeholder={i18n.getFixedT('en')(meta.numberKey, {number: active + 1})}
                    aria-describedby="unit-name-help"
                    aria-label={translate(section === 'writing' ? 'exams:authoring.unitTitle' : 'exams:authoring.unitName', {unit: translate(meta.unitKey)})}
                    onChange={(event) =>
                      patchUnit(
                        section === 'writing'
                          ? {title: event.target.value}
                          : {label: event.target.value},
                      )
                    }
                  />
                  <small id="unit-name-help" className={ui.hint}>
                    {translate('exams:authoring.unitNameHelp', {name: i18n.getFixedT('en')(meta.numberKey, {number: active + 1})})}
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
                  <h2>{translate("exams:authoring.passageContent")}</h2>
                </div>
                <div className={ui.form}>
                  <label>
                    <span>{translate("exams:authoring.passageTitle")}</span>
                    <input
                      value={unit.title}
                      onChange={(event) =>
                        patchUnit({title: event.target.value})
                      }
                    />
                  </label>
                  <label>
                    <span>{translate("exams:authoring.introduction")}</span>
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
                  <h2>{translate("exams:authoring.taskContent")}</h2>
                </div>
                <div className={ui.form}>
                  <label>
                    <span>{translate("exams:authoring.writingPrompt")}</span>
                    <textarea
                      required
                      value={unit.prompt}
                      onChange={(event) =>
                        patchUnit({prompt: event.target.value})
                      }
                    />
                  </label>
                  <label>
                    <span>{translate("exams:authoring.minimumWordsLabel")}</span>
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
                    aria-label={translate('exams:authoring.groupContentLabel', {number: formatNumber(index + 1)})}
                  >
                    <div className={ui.sectionHeading}>
                      <h2>
                        {unit.questions.length === 1
                          ? translate("common:admin.examFields.content")
                          : translate('exams:authoring.groupContent', {number: formatNumber(index + 1)})}
                      </h2>
                      {unit.questions.length > 1 ? (
                        <button
                          type="button"
                          className={ui.dangerLink}
                          onClick={async () => {
                            if (
                              await confirmation.confirm({titleKey: 'exams:authoring.removeGroup', messageKey: 'exams:authoring.removeGroupConfirm'}) && latestDraft.current === draft
                            )
                              changeUnit((current) => ({
                                ...current,
                                questions: current.questions.filter(
                                  (item) => item.draftId !== question.draftId,
                                ),
                              }));
                          }}
                        >
                          {translate("exams:authoring.removeGroup")}</button>
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
                        <span>{translate("exams:authoring.groupTitleOptional")}</span>
                        <input
                          value={question.title}
                          placeholder={questionTitle(question)}
                          onChange={(event) =>
                            patchQuestion(index, {title: event.target.value})
                          }
                        />
                      </label>
                      <label>
                        <span>{translate("exams:authoring.instructions")}</span>
                        <textarea
                          value={question.instruction}
                          placeholder={translate("exams:authoring.instructionsPlaceholder")}
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
                  <h2>{translate("exams:authoring.media")}</h2>
                  <span className={ui.hint}>
                    {section === 'listening'
                      ? translate("exams:authoring.audioRequired")
                      : translate("exams:authoring.optionalTaskImage")}
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
                  <h2>{translate("exams:authoring.media")}</h2>
                </div>
                <div className={authoring.fields}>
                  {unit.questions.map((question, index) => (
                    <div key={question.draftId}>
                      <p className={authoring.mediaLabel}>
                        {unit.questions.length === 1
                          ? translate("exams:authoring.optionalQuestionImage")
                          : translate('exams:authoring.groupImageOptional', {number: formatNumber(index + 1)})}
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
                aria-label={translate("exams:authoring.questionConfiguration")}
              >
                <div className={ui.sectionHeading}>
                  <h2>{translate("exams:authoring.questionConfigurationTitle")}</h2>
                </div>
                <div className={authoring.fields}>
                  {unit.questions.map((question, index) => (
                    <div
                      key={question.draftId}
                      role="group"
                      aria-label={translate('exams:authoring.groupNumber', {number: formatNumber(index + 1)})}
                      data-question-group-index={index}
                    >
                      {unit.questions.length > 1 ? (
                        <h3 className={authoring.groupTitle}>
                          {translate('exams:authoring.groupNumber', {number: formatNumber(index + 1)})}
                        </h3>
                      ) : null}
                      <QuestionEditor
                        subject={section}
                        question={question}
                        onChange={(patch) => patchQuestion(index, patch)}
                        suggestedNumber={nextQuestionNumber}
                      />
                      <details className={authoring.advanced}>
                        <summary>{translate("exams:authoring.previewGroup")}</summary>
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
                    <Plus size={16} /> {' '}{translate("exams:authoring.addGroup")}</button>
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
                {translate('exams:authoring.reviewIssues', {count: issues.length, number: formatNumber(issues.length)})}
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
                                ? `[data-question-group-index="${issue.groupIndex}"]`
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
                        ? translate(meta.labelKey)
                        : <>{translate(meta.numberKey, {number: formatNumber(issue.unitIndex + 1)})}{issue.groupIndex === undefined ? null : <> · {translate('exams:authoring.groupShort', {number: formatNumber(issue.groupIndex + 1)})}</>}</>}
                      : {issue.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!review && Boolean(error || save.error) ? (
            <p className={ui.inlineError} role="alert">
              {advisingErrorMessage(error || save.error, translate(error ? 'exams:authoring.reviewFields' : 'exams:authoring.createFailed'))}
            </p>
          ) : null}
          {review ? (
            <section
              ref={reviewPanel}
              tabIndex={-1}
              className={`${ui.surface} ${authoring.surface} ${authoring.review}`}
              aria-label={translate("exams:authoring.reviewSubmission")}
            >
              <h2>
                {translate('exams:authoring.submitUnits', {count: draft.units.length, number: formatNumber(draft.units.length), unit: translate(meta.unitKey).toLowerCase()})}
              </h2>
              <p>
                {translate(meta.labelKey)} · {translate('assessment:attempt.duration', {count: Number(draft.minutes), number: formatNumber(Number(draft.minutes))})} · {translate('exams:authoring.unitCount', {count: draft.units.length, number: formatNumber(draft.units.length)})}
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
              <p className={authoring.notice}>
                {translate(section === "writing" ? "exams:authoring.writingReview" : "exams:authoring.scoringReview")}
              </p>
              <p>
                {translate('exams:authoring.createHelp', {section: translate(meta.labelKey).toLowerCase()})}
              </p>
              {save.error ? (
                <p className={ui.inlineError} role="alert">
                  {advisingErrorMessage(
                    save.error,
                    translate('exams:authoring.createRetryFailed'),
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
                    ? translate("exams:authoring.creatingSection")
                    : translate("exams:authoring.confirmCreate")}
                </button>
                <button
                  type="button"
                  className={ui.secondaryButton}
                  disabled={save.isPending}
                  onClick={() => setReview(false)}
                >
                  {translate("operations:keepEditing")}</button>
              </div>
            </section>
          ) : null}
          {!review ? (
            <p className={authoring.saveHint}>
              {translate('exams:authoring.draftHelp', {unit: translate(meta.unitKey).toLowerCase()})}
            </p>
          ) : null}
          <footer className={styles.composerFooter} hidden={review}>
            <div className={ui.actions}>
              <button
                className={ui.primaryButton}
                disabled={contentBusy || review}
              >
                {translate("exams:authoring.reviewSave")}</button>
              <button
                type="button"
                className={ui.secondaryButton}
                disabled={contentBusy}
                onClick={async () => {
                  if (
                    await confirmation.confirm({titleKey: 'exams:authoring.discardDraft', messageKey: 'exams:authoring.discardConfirm', valueKeys: {section: meta.labelKey}}) && latestDraft.current === draft && !client.isMutating({mutationKey})
                  ) {
                    update(newDraft());
                    setActive(0);
                    setShowIssues(false);
                    onBack();
                  }
                }}
              >
                {translate("exams:authoring.discardDraft")}</button>
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

          {translate('common:actions.previousItem', {item: translate(meta.unitKey).toLowerCase()})}
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
          {translate('common:actions.nextItem', {item: translate(meta.unitKey).toLowerCase()})}

              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
