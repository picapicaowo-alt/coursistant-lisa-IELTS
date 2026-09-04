import {useEffect, useId, useRef, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {FileJson, FileUp, X} from 'lucide-react';
import {unwrapData} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {getApiErrorMessage} from '@/utils/apiError';
import {formatFileSize} from '@/utils/file-utils';
import {
  draftContent,
  newDraft,
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
  const panelId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const generation = useRef(0);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [raw, setRaw] = useState('');
  const [file, setFile] = useState<{
    name: string;
    size: number;
    content: string;
  }>();
  const [dragging, setDragging] = useState(false);
  const [candidate, setCandidate] = useState<SectionDraft>();
  const [errors, setErrors] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const importText = mode === 'upload' ? (file?.content ?? '') : raw;
  useEffect(() => {
    // Keep the validation result visible above the fixed mobile action bar.
    if (candidate || errors.length)
      feedback.current?.scrollIntoView({block: 'nearest'});
  }, [candidate, errors]);
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
    setErrors([]);
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
      setErrors([
        'Choose a .json file up to 2 MB. The file stays in your browser until you confirm the section save.',
      ]);
      return;
    }
    const request = ++generation.current;
    setWorking(true);
    try {
      const content = await file.text();
      if (generation.current === request) {
        setFile({name: file.name, size: file.size, content});
        setMessage(
          'File loaded locally. Validate it before loading the editor.',
        );
      }
    } catch {
      if (generation.current === request)
        setErrors([
          'The file could not be read. Choose it again or paste the JSON.',
        ]);
    } finally {
      if (generation.current === request) setWorking(false);
    }
  };
  const apply = async () => {
    if (!candidate || disabled || working) return;
    const approvedDraft = draftContent(draft);
    if (
      draftContent(draft) !== draftContent(newDraft()) &&
      !window.confirm(
        'Replace this unsaved Reading draft with the imported content? Other sections and uploaded files will not be changed.',
      )
    )
      return;
    const request = ++generation.current;
    setWorking(true);
    setErrors([]);
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
          setErrors(mediaErrors);
          return;
        }
      }
      if (generation.current !== request) return;
      if (draftContent(latestDraft.current) !== approvedDraft) {
        setErrors([
          'The Reading draft changed while images were being checked. Your edits are preserved; review the import and load it again.',
        ]);
        return;
      }
      if (
        client.isMutating({
          mutationKey: tenantContentWriteKey(templateId, versionId),
        })
      ) {
        setErrors([
          'Wait for the current content operation to finish, then load the draft again.',
        ]);
        return;
      }
      onApply(candidate);
      setOpen(false);
      setRaw('');
      setFile(undefined);
      setCandidate(undefined);
      setMessage(
        'Reading imported into this browser draft. You can edit it now. Use Review & save, then confirm, to save the complete section to the server.',
      );
    } catch (error) {
      if (generation.current === request)
        setErrors([
          getApiErrorMessage(
            error,
            'Image references could not be verified. Your existing draft is unchanged. Try again.',
          ),
        ]);
    } finally {
      if (generation.current === request) setWorking(false);
    }
  };
  return (
    <div className={styles.importTools}>
      <button
        type="button"
        className={ui.secondaryButton}
        disabled={disabled || working}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <FileJson size={18} /> Import Reading JSON
      </button>
      {message && !open ? (
        <p role="status" className={ui.hint}>
          {message}
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
              <h2 id={`${panelId}-title`}>Import Reading JSON</h2>
              <p id={`${panelId}-description`}>
                Import all passages and question groups. You can review and edit
                them before saving.
              </p>
            </div>
            <button
              type="button"
              className={modal.close}
              aria-label="Close JSON import"
              onClick={close}
            >
              <X size={20} />
            </button>
          </header>
          <div className={`${ui.form} ${modal.body}`} aria-busy={working}>
            <div
              className={modal.modes}
              role="group"
              aria-label="JSON import method"
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
                  {method === 'upload' ? 'Upload file' : 'Paste JSON'}
                </button>
              ))}
            </div>
            {mode === 'upload' ? (
              <div className={modal.upload}>
                <div
                  className={`${mediaStyles.dropzone} ${modal.dropzone}`}
                  data-dragging={dragging}
                  aria-label="Reading JSON upload area"
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
                      setErrors([
                        'Choose one JSON file containing the complete Reading section.',
                      ]);
                      return;
                    }
                    void readFile(event.dataTransfer.files[0]);
                  }}
                >
                  <FileUp size={32} aria-hidden="true" />
                  <strong>
                    {working && !candidate
                      ? 'Reading your file…'
                      : 'Drag & drop a JSON file'}
                  </strong>
                  <small>
                    JSON · up to {formatFileSize(READING_IMPORT_MAX_BYTES)}
                  </small>
                  <input
                    ref={fileInput}
                    type="file"
                    className={ui.srOnly}
                    tabIndex={-1}
                    aria-label="Reading JSON file · up to 2 MB"
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
                    {file ? 'Change file' : 'Choose file'}
                  </button>
                </div>
                {file ? (
                  <div className={modal.fileRow}>
                    <FileJson size={22} aria-hidden="true" />
                    <div>
                      <strong>{file.name}</strong>
                      <small>
                        {formatFileSize(file.size)} · Loaded locally
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
                      Remove file
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <label>
                <span>Or paste complete Reading JSON</span>
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
                {message}
              </p>
            ) : null}
            <details className={styles.advanced}>
              <summary>View example JSON format</summary>
              <p className={ui.hint}>
                Illustrative content only. Use the existing Reading API body,
                without template IDs or a response wrapper. Custom payload and
                paragraph data are preserved. Imported sequence values are
                retained.
              </p>
              <pre className={styles.importExample}>
                {JSON.stringify(READING_IMPORT_EXAMPLE, null, 2)}
              </pre>
            </details>
            {errors.length ? (
              <div ref={feedback} role="alert" className={styles.notice}>
                <strong>Nothing has been imported. Check these items:</strong>
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
                  Ready to load · {candidate.minutes} minutes ·{' '}
                  {candidate.units.length} passages
                </strong>
                <ul>
                  {candidate.units.map((unit) => (
                    <li key={unit.draftId}>
                      {unit.label || `Passage ${unit.seq}`} ·{' '}
                      {unit.questions.length} question groups
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
                    Some custom types use Advanced data. Their payload is
                    preserved; confirm compatibility and scoring with your
                    content team.
                  </p>
                ) : null}
                <p>
                  Loading replaces only the current Reading draft. Uploaded
                  files and other sections remain unchanged. Preview and confirm
                  the final section before saving.
                </p>
              </div>
            ) : null}
          </div>
          <footer className={modal.footer}>
            <p>
              Nothing is saved to the server until you review and confirm the
              complete section.
            </p>
            <div className={modal.actions}>
              <button
                type="button"
                className={ui.secondaryButton}
                onClick={close}
              >
                Cancel import
              </button>
              <button
                type="button"
                className={candidate ? ui.secondaryButton : ui.primaryButton}
                disabled={disabled || working || !importText.trim()}
                onClick={() => {
                  const result = parseReadingImport(importText);
                  setErrors(result.errors);
                  setCandidate(result.draft);
                  setMessage('');
                }}
              >
                Validate JSON
              </button>
              {candidate ? (
                <button
                  type="button"
                  className={ui.primaryButton}
                  disabled={disabled || working}
                  onClick={() => void apply()}
                >
                  {working ? 'Checking image references…' : 'Load into editor'}
                </button>
              ) : null}
            </div>
          </footer>
        </dialog>
      ) : null}
    </div>
  );
}
