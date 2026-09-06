import {useTranslation} from 'react-i18next';
import {useConfirmationDialog} from '@/components/TeachingWorkspace/useConfirmationDialog';
import {useEffect, useId, useMemo, useRef, useState} from 'react';
import {formatNumber} from '@/i18n/formatting';
import {useQueryClient} from '@tanstack/react-query';
import {FileJson, FileUp, X} from 'lucide-react';
import {unwrapData, type MockExamMediaRead} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {getApiErrorMessage} from '@/utils/apiError';
import {formatFileSize} from '@/utils/file-utils';
import {
  draftContent,
  newDraft,
  unitName,
  tenantContentWriteKey,
  type SectionDraft,
} from './model';
import {questionDefinition} from './questionSchema';
import {
  parseReadingImport,
  readingImportMediaErrors,
  READING_IMPORT_EXAMPLE,
  READING_IMPORT_MAX_BYTES,
} from './readingJson';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './authoring.module.scss';
import mediaStyles from './tenant.module.scss';
import modal from './ReadingImport.module.scss';

type ImportFailure =
  | {type: 'message'; key: string}
  | {type: 'json'; raw: string}
  | {type: 'media'; draft: SectionDraft; media: MockExamMediaRead[]}
  | {type: 'request'; error: unknown};

export function ReadingImport({
  templateId,
  versionId,
  draft,
  disabled,
  onApply,
}: {
  templateId: number;
  versionId: number;
  draft: SectionDraft;
  disabled: boolean;
  onApply: (draft: SectionDraft) => void;
}) {
  const {t: translate} = useTranslation();
  const panelId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const generation = useRef(0);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const [open, setOpen] = useState(false);
  const confirmation = useConfirmationDialog(`${templateId}/${versionId}/${open}`);
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [raw, setRaw] = useState('');
  const [file, setFile] = useState<{
    name: string;
    size: number;
    content: string;
  }>();
  const [dragging, setDragging] = useState(false);
  const [candidate, setCandidate] = useState<SectionDraft>();
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  // Keep the accepted candidate and API result fixed. Re-resolve only diagnostic
  // copy when the interface locale changes; never re-fetch media or apply data.
  const errors = useMemo(() => {
    if (!failure) return [];
    if (failure.type === 'message') return [translate(failure.key)];
    if (failure.type === 'json') return parseReadingImport(failure.raw).errors;
    if (failure.type === 'media') return readingImportMediaErrors(failure.draft, failure.media);
    return [getApiErrorMessage(failure.error, translate('exams:import.imageFailed'))];
  }, [failure, translate]);
  const importText = mode === 'upload' ? (file?.content ?? '') : raw;
  useEffect(() => {
    // Keep the validation result visible above the fixed mobile action bar.
    if (candidate || failure)
      feedback.current?.scrollIntoView({block: 'nearest'});
  }, [candidate, failure]);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [open]);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const resetValidation = () => {
    generation.current += 1;
    setCandidate(undefined);
    setFailure(null);
    setMessage('');
  };
  const changeRaw = (value: string) => {
    resetValidation();
    setRaw(value);
  };
  const close = () => {
    // Dismissal cancels local work, never applies a late file/media result.
    generation.current += 1;
    setWorking(false);
    setDragging(false);
    setMessage('');
    setOpen(false);
  };
  const readFile = async (file?: File) => {
    if (!file || disabled || working) return;
    resetValidation();
    setFile(undefined);
    if (
      !file.name.toLowerCase().endsWith('.json') ||
      file.size > READING_IMPORT_MAX_BYTES
    ) {
      setFailure({type: 'message', key: 'exams:import.fileRule'});
      return;
    }
    const request = ++generation.current;
    setWorking(true);
    try {
      const content = await file.text();
      if (generation.current === request) {
        setFile({name: file.name, size: file.size, content});
        setMessage(
          'exams:import.fileLoaded',
        );
      }
    } catch {
      if (generation.current === request)
        setFailure({type: 'message', key: 'exams:import.fileFailed'});
    } finally {
      if (generation.current === request) setWorking(false);
    }
  };
  const apply = async () => {
    if (!candidate || disabled || working) return;
    const approvedDraft = draftContent(draft);
    const approvalGeneration = generation.current;
    if (
      draftContent(draft) !== draftContent(newDraft()) &&
      !await confirmation.confirm({titleKey: 'exams:import.title', messageKey: 'exams:import.replaceConfirm'})
    )
      return;
    if (generation.current !== approvalGeneration) return;
    const request = ++generation.current;
    setWorking(true);
    setFailure(null);
    try {
      // Resolve references in the active version just before replacing the draft.
      // Neither file selection nor validation sends content to the backend.
      if (
        candidate.units.some((unit) =>
          unit.questions.some((group) => group.mediaId !== null),
        )
      ) {
        const media = await client.fetchQuery({
          queryKey: ['mock-exams', 'tenant', templateId, versionId, 'media'],
          queryFn: async () =>
            unwrapData(
              await mockExamApiService.listTenantMedia(templateId, versionId),
              'tenantMedia',
            ),
          staleTime: 0,
        });
        const mediaErrors = readingImportMediaErrors(candidate, media);
        if (generation.current !== request) return;
        if (mediaErrors.length) {
          setFailure({type: 'media', draft: candidate, media});
          return;
        }
      }
      if (generation.current !== request) return;
      if (draftContent(latestDraft.current) !== approvedDraft) {
        setFailure({type: 'message', key: 'exams:import.draftChanged'});
        return;
      }
      if (
        client.isMutating({
          mutationKey: tenantContentWriteKey(templateId, versionId),
        })
      ) {
        setFailure({type: 'message', key: 'exams:import.contentBusy'});
        return;
      }
      onApply(candidate);
      setOpen(false);
      setRaw('');
      setFile(undefined);
      setCandidate(undefined);
      setMessage(
        'exams:import.imported',
      );
    } catch (error) {
      if (generation.current === request)
        setFailure({type: 'request', error});
    } finally {
      if (generation.current === request) setWorking(false);
    }
  };
  return (
    <div className={styles.importTools}>
      {confirmation.dialog}
      <button
        type="button"
        className={ui.secondaryButton}
        disabled={disabled || working}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <FileJson size={18} /> {' '}{translate("exams:import.title")}</button>
      {message && !open ? (
        <p role="status" className={ui.hint}>
          {translate(message)}
        </p>
      ) : null}
      {open ? (
        <dialog
          ref={dialog}
          id={panelId}
          aria-labelledby={`${panelId}-title`}
          aria-describedby={`${panelId}-description`}
          className={modal.dialog}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
        >
          <header className={modal.header}>
            <div>
              <h2 id={`${panelId}-title`}>{translate("exams:import.title")}</h2>
              <p id={`${panelId}-description`}>
                {translate("exams:import.help")}</p>
            </div>
            <button
              type="button"
              className={modal.close}
              aria-label={translate("exams:import.close")}
              onClick={close}
            >
              <X size={20} />
            </button>
          </header>
          <div className={`${ui.form} ${modal.body}`} aria-busy={working}>
            <div
              className={modal.modes}
              role="group"
              aria-label={translate("exams:import.method")}
            >
              {(['upload', 'paste'] as const).map((method) => (
                <button
                  type="button"
                  key={method}
                  aria-pressed={mode === method}
                  disabled={disabled || working}
                  onClick={() => {
                    resetValidation();
                    setMode(method);
                  }}
                >
                  {method === 'upload' ? translate("exams:import.upload") : translate("exams:import.paste")}
                </button>
              ))}
            </div>
            {mode === 'upload' ? (
              <div className={modal.upload}>
                <div
                  className={`${mediaStyles.dropzone} ${modal.dropzone}`}
                  data-dragging={dragging}
                  aria-label={translate("exams:import.uploadArea")}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!disabled && !working) setDragging(true);
                  }}
                  onDragLeave={(event) => {
                    if (
                      !(event.relatedTarget instanceof Node) ||
                      !event.currentTarget.contains(event.relatedTarget)
                    )
                      setDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    if (disabled || working) return;
                    if (event.dataTransfer.files.length !== 1) {
                      resetValidation();
                      setFailure({type: 'message', key: 'exams:import.oneFile'});
                      return;
                    }
                    void readFile(event.dataTransfer.files[0]);
                  }}
                >
                  <FileUp size={32} aria-hidden="true" />
                  <strong>
                    {working && !candidate
                      ? translate("exams:import.readingFile")
                      : translate("exams:import.drop")}
                  </strong>
                  <small>
                    {translate('exams:import.maxSize', {size: formatFileSize(READING_IMPORT_MAX_BYTES)})}
                  </small>
                  <input
                    ref={fileInput}
                    type="file"
                    className={ui.srOnly}
                    tabIndex={-1}
                    aria-label={translate("exams:import.fileLabel")}
                    accept=".json,application/json"
                    disabled={disabled || working}
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      event.target.value = '';
                      void readFile(selected);
                    }}
                  />
                  <button
                    type="button"
                    className={ui.primaryButton}
                    disabled={disabled || working}
                    onClick={() => fileInput.current?.click()}
                  >
                    {translate(file ? 'exams:media.change' : 'exams:media.chooseFile')}
                  </button>
                </div>
                {file ? (
                  <div className={modal.fileRow}>
                    <FileJson size={22} aria-hidden="true" />
                    <div>
                      <strong>{file.name}</strong>
                      <small>
                        {translate('exams:import.loadedSize', {size: formatFileSize(file.size)})}
                      </small>
                    </div>
                    <button
                      type="button"
                      className={modal.remove}
                      disabled={disabled || working}
                      onClick={() => {
                        resetValidation();
                        setFile(undefined);
                      }}
                    >
                      {translate("exams:import.removeFile")}</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <label>
                <span>{translate("exams:import.pasteLabel")}</span>
                <textarea
                  className={styles.code}
                  rows={10}
                  value={raw}
                  disabled={disabled || working}
                  onChange={(event) => changeRaw(event.target.value)}
                  spellCheck={false}
                />
              </label>
            )}
            {message ? (
              <p role="status" className={ui.hint}>
                {translate(message)}
              </p>
            ) : null}
            <details className={styles.advanced}>
              <summary>{translate("exams:import.example")}</summary>
              <p className={ui.hint}>
                {translate("exams:import.exampleHelp")}</p>
              <pre className={styles.importExample}>
                {JSON.stringify(READING_IMPORT_EXAMPLE, null, 2)}
              </pre>
            </details>
            {errors.length ? (
              <div ref={feedback} role="alert" className={styles.notice}>
                <strong>{translate("exams:import.checkItems")}</strong>
                <ul>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {candidate ? (
              <div
                ref={feedback}
                role="status"
                className={styles.importSummary}
              >
                <strong>
                  {translate('exams:import.readySummary', {duration: translate('assessment:attempt.duration', {count: Number(candidate.minutes), number: formatNumber(Number(candidate.minutes))}), passages: translate('exams:import.passageCount', {count: candidate.units.length, number: formatNumber(candidate.units.length)})})}
                </strong>
                <ul>
                  {candidate.units.map((unit, index) => (
                    <li key={unit.draftId}>
                      {unitName('reading', unit, (unit.seq ?? index + 1) - 1)} ·{' '}
                      {translate('exams:import.groupCount', {count: unit.questions.length, number: formatNumber(unit.questions.length)})}
                    </li>
                  ))}
                </ul>
                {candidate.units.some((unit) =>
                  unit.questions.some(
                    (group) =>
                      !questionDefinition('reading', group.kind)?.schema,
                  ),
                ) ? (
                  <p>
                    {translate("exams:import.customTypes")}</p>
                ) : null}
                <p>
                  {translate("exams:import.replaceHelp")}</p>
              </div>
            ) : null}
          </div>
          <footer className={modal.footer}>
            <p>
              {translate("exams:import.saveHelp")}</p>
            <div className={modal.actions}>
              <button
                type="button"
                className={ui.secondaryButton}
                onClick={close}
              >
                {translate("exams:import.cancel")}</button>
              <button
                type="button"
                className={candidate ? ui.secondaryButton : ui.primaryButton}
                disabled={disabled || working || !importText.trim()}
                onClick={() => {
                  const result = parseReadingImport(importText);
                  setFailure(result.errors.length ? {type: 'json', raw: importText} : null);
                  setCandidate(result.draft);
                  setMessage('');
                }}
              >
                {translate("exams:import.validate")}</button>
              {candidate ? (
                <button
                  type="button"
                  className={ui.primaryButton}
                  disabled={disabled || working}
                  onClick={() => void apply()}
                >
                  {working ? translate("exams:import.checkingImages") : translate("exams:import.load")}
                </button>
              ) : null}
            </div>
          </footer>
        </dialog>
      ) : null}
    </div>
  );
}
