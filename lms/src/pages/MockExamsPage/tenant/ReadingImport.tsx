import {useEffect, useId, useRef, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {FileJson} from 'lucide-react';
import {unwrapData} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {getApiErrorMessage} from '@/utils/apiError';
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
  const client = useQueryClient();
  const generation = useRef(0);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [candidate, setCandidate] = useState<SectionDraft>();
  const [errors, setErrors] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const changeRaw = (value: string) => {
    generation.current += 1;
    setRaw(value);
    setCandidate(undefined);
    setErrors([]);
    setMessage('');
  };
  const readFile = async (file?: File) => {
    if (!file) return;
    changeRaw('');
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
        setRaw(content);
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
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <FileJson size={18} /> Import Reading JSON
      </button>
      {message ? (
        <p role="status" className={ui.hint}>
          {message}
        </p>
      ) : null}
      {open ? (
        <section
          id={panelId}
          aria-label="Import complete Reading JSON"
          className={`${ui.surface} ${styles.surface}`}
        >
          <div className={ui.sectionHeading}>
            <h2>Import a complete Reading section</h2>
          </div>
          <div className={`${ui.form} ${styles.fields}`}>
            <p>
              Upload a JSON file or paste the Reading request body. After
              validation, load all passages and question groups into the editor.
              Nothing is saved to the server yet.
            </p>
            <label>
              <span>Reading JSON file · up to 2 MB</span>
              <input
                type="file"
                accept=".json,application/json"
                disabled={disabled || working}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void readFile(file);
                }}
              />
            </label>
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
              <div role="alert" className={styles.notice}>
                <strong>Nothing has been imported. Check these items:</strong>
                <ul>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {candidate ? (
              <div role="status" className={styles.importSummary}>
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
            <div className={ui.actions}>
              <button
                type="button"
                className={candidate ? ui.secondaryButton : ui.primaryButton}
                disabled={disabled || working || !raw.trim()}
                onClick={() => {
                  const result = parseReadingImport(raw);
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
              <button
                type="button"
                className={ui.secondaryButton}
                disabled={working}
                onClick={() => {
                  changeRaw('');
                  setOpen(false);
                }}
              >
                Cancel import
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
