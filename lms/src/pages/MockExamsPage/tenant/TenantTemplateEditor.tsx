import {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {ArrowLeft, ArrowRight, Copy, LockKeyhole} from 'lucide-react';
import {unwrapData, type MockExamTemplateVersionSummary} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {getApiErrorMessage, isRecord} from '@/utils/apiError';
import {
  readableValue,
  tenantDate,
} from '@/components/TenantWorkspace/presentation';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {ExamSectionMedia} from '../StaffMockExamWorkspaces';
import {runtimeNumber} from '../staffRuntime';
import {
  SECTION_META,
  SECTIONS,
  isSection,
  newDraft,
  clearDraftMedia,
  tenantContentWriteKey,
  type Section,
} from './model';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {useSectionDrafts} from './useSectionDrafts';
import {TenantSectionComposer} from './TenantSectionComposer';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './tenant.module.scss';

export function TenantTemplateEditor({templateId}: {templateId: number}) {
  const [params, setParams] = useSearchParams();
  const template = useQuery({
    queryKey: ['mock-exams', 'tenant', 'template', templateId],
    queryFn: async () =>
      unwrapData(
        await mockExamApiService.getTenantTemplate(templateId),
        'tenantTemplate',
      ),
    retry: false,
  });
  const versions = template.data?.versions ?? [];
  const requested = Number(params.get('version'));
  const version =
    versions.find((item) => item.id === requested) ??
    versions.find((item) => item.status === 'DRAFT') ??
    versions[0];
  const contentBusy =
    useIsMutating({
      mutationKey: tenantContentWriteKey(templateId, version?.id ?? 0),
    }) > 0;
  return (
    <div className={ui.page}>
      <button
        type="button"
        className={ui.textButton}
        disabled={contentBusy}
        onClick={() => setParams({})}
      >
        <ArrowLeft size={17} />
        Mock exam templates
      </button>
      <header className={`${ui.pageHeader} ${styles.editorHeading}`}>
        <div>
          <h1>{template.data?.title || 'Mock exam template'}</h1>
          <p>
            Template #{templateId}
            {version
              ? ` · Version ${version.versionNo ?? '—'} · ${readableValue(version.status)}`
              : ''}
          </p>
        </div>
        {versions.length ? (
          <label className={styles.versionSelect}>
            Working version
            <select
              disabled={contentBusy}
              value={version?.id ?? ''}
              onChange={(event) =>
                setParams({
                  template: String(templateId),
                  version: event.target.value,
                })
              }
            >
              {versions.map((item) => (
                <option key={item.id} value={item.id}>
                  Version {item.versionNo ?? '—'} · {readableValue(item.status)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>
      {template.isPending ? (
        <p className={ui.status}>Loading template…</p>
      ) : template.isError ? (
        <div className={ui.errorNotice}>
          {getApiErrorMessage(template.error, 'Template unavailable.')}
          <button
            className={ui.textButton}
            onClick={() => void template.refetch()}
          >
            Try again
          </button>
        </div>
      ) : version?.id ? (
        <VersionWorkspace
          key={version.id}
          templateId={templateId}
          version={version}
          label={template.data?.label}
          title={template.data?.title}
        />
      ) : (
        <p className={ui.empty}>No version is available for this template.</p>
      )}
    </div>
  );
}

function VersionWorkspace({
  templateId,
  version,
  label,
  title,
}: {
  templateId: number;
  version: MockExamTemplateVersionSummary & {id?: number};
  label?: string;
  title?: string;
}) {
  const versionId = version.id!;
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const mutationKey = tenantContentWriteKey(templateId, versionId);
  const contentBusy = useIsMutating({mutationKey}) > 0;
  const {user} = useRequiredAuth();
  const {drafts, setDrafts, storageAvailable} = useSectionDrafts(
    user.id,
    templateId,
    versionId,
  );
  const [confirmAction, setConfirmAction] = useState<
    'delete' | 'archive' | null
  >(null);
  const detail = useQuery({
    queryKey: ['mock-exams', 'tenant', templateId, 'version', versionId],
    queryFn: async () =>
      unwrapData(
        await mockExamApiService.getTenantVersion(templateId, versionId),
        'tenantVersion',
      ),
    retry: false,
  });
  const current = {...version, ...(isRecord(detail.data) ? detail.data : {})};
  const requestedSection = params.get('section');
  const section = isSection(requestedSection) ? requestedSection : null;
  const setSection = (next: Section | null) =>
    setParams({
      template: String(templateId),
      version: String(versionId),
      ...(next ? {section: next} : {}),
    });
  const refresh = async () => {
    await client.invalidateQueries({queryKey: ['mock-exams', 'tenant']});
    await client.invalidateQueries({queryKey: ['tenant', 'audit-events']});
  };
  const action = useMutation({
    mutationKey,
    mutationFn: async (kind: 'publish' | 'archive' | 'copy' | 'delete') => {
      if (client.isMutating({mutationKey}) > 1)
        throw new Error('Wait for the current content operation to finish.');
      if (kind === 'copy') {
        const data = unwrapData(
          await mockExamApiService.copyTenantVersion(
            templateId,
            versionId,
            versionId,
          ),
          'tenantCopyVersion',
        );
        return {
          kind,
          id: isRecord(data) ? runtimeNumber(data, 'id', 'versionId') : null,
        };
      }
      if (kind === 'delete')
        await mockExamApiService.deleteTenantDraft(templateId, versionId);
      else if (kind === 'archive')
        await mockExamApiService.archiveTenantVersion(templateId, versionId);
      else {
        // Summary flags alone cannot prove protected content is retrievable.
        // Preserve the existing three-section preflight before publishing.
        await Promise.all(
          SECTIONS.map(async (section) =>
            unwrapData(
              await mockExamApiService.getTenantSection(
                templateId,
                versionId,
                section,
              ),
              'tenantPublishPreflight',
            ),
          ),
        );
        await mockExamApiService.publishTenantVersion(templateId, versionId);
      }
      return {kind, id: null};
    },
    onSuccess: async (result) => {
      setConfirmAction(null);
      await refresh();
      if (result.kind === 'delete') setParams({template: String(templateId)});
      else if (result.id)
        setParams({template: String(templateId), version: String(result.id)});
    },
  });
  const isDraft = current.status === 'DRAFT';
  const canPublish =
    isDraft &&
    SECTIONS.every((item) => current[SECTION_META[item].flag] === true);
  if (section)
    return (
      <>
        {contentBusy ? (
          <p className={ui.hint} role="status">
            A content operation is in progress. Wait before submitting or
            changing this version.
          </p>
        ) : null}
        <p className={storageAvailable ? ui.hint : ui.inlineError}>
          {storageAvailable
            ? 'Unsaved work is kept in this browser tab, including when you switch sections. Submit a complete section to save it to the server.'
            : 'Browser draft storage is unavailable. Keep this page open until your section is submitted.'}
        </p>
        <nav className={ui.tabs} aria-label="Exam sections">
          {SECTIONS.map((item) => (
            <button
              key={item}
              className={section === item ? ui.activeTab : ''}
              aria-current={section === item ? 'page' : undefined}
              onClick={() => setSection(item)}
            >
              {SECTION_META[item].label}
              {current[SECTION_META[item].flag] === true ? (
                <LockKeyhole size={14} />
              ) : null}
            </button>
          ))}
        </nav>
        {detail.isPending ? (
          <p className={ui.status}>Checking the current version…</p>
        ) : detail.isError ? (
          <div className={ui.errorNotice}>
            The version could not be verified.
            <button
              className={ui.textButton}
              onClick={() => void detail.refetch()}
            >
              Try again
            </button>
          </div>
        ) : current[SECTION_META[section].flag] === true ? (
          <SavedSection
            templateId={templateId}
            versionId={versionId}
            section={section}
            onBack={() => setSection(null)}
          />
        ) : isDraft && current[SECTION_META[section].flag] === false ? (
          <TenantSectionComposer
            key={section}
            templateId={templateId}
            versionId={versionId}
            section={section}
            draft={drafts[section]}
            onChange={(next) =>
              setDrafts((all) => ({
                ...all,
                [section]:
                  typeof next === 'function' ? next(all[section]) : next,
              }))
            }
            onMediaDeleted={(id) =>
              setDrafts((all) => ({
                listening: clearDraftMedia(all.listening, id),
                reading: clearDraftMedia(all.reading, id),
                writing: clearDraftMedia(all.writing, id),
              }))
            }
            onBack={() => setSection(null)}
            onSaved={async () => {
              await refresh();
              setDrafts((all) => ({...all, [section]: newDraft()}));
            }}
          />
        ) : (
          <div className={ui.surface}>
            <h2>Content unavailable</h2>
            <p className={ui.hint}>
              Only an explicitly empty section in a draft version can accept new
              content.
            </p>
            <button className={ui.textButton} onClick={() => setSection(null)}>
              Back to version
            </button>
          </div>
        )}
      </>
    );
  return (
    <div className={styles.editorGrid}>
      <section>
        <div className={ui.sectionHeading}>
          <h2>Exam sections</h2>
          <span className={ui.hint}>Listening · Reading · Writing</span>
        </div>
        <div className={styles.examSections}>
          {SECTIONS.map((item) => {
            const meta = SECTION_META[item];
            const saved = current[meta.flag] === true;
            return (
              <article className={styles.examSection} key={item}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionIcon}>
                    <meta.Icon size={23} />
                  </span>
                  <div>
                    <h3>{meta.label}</h3>
                    <p>
                      {saved
                        ? 'Content saved · Read only'
                        : current[meta.flag] === false
                          ? 'No content saved yet'
                          : 'Content status unavailable'}
                    </p>
                  </div>
                  <span
                    className={ui.badge}
                    data-tone={saved ? 'SAVED' : 'DRAFT'}
                  >
                    {saved
                      ? 'Saved'
                      : current[meta.flag] === false
                        ? 'Not started'
                        : 'Unavailable'}
                  </span>
                </div>
                <p className={ui.hint}>
                  {saved
                    ? 'Review the saved content and preview its protected media.'
                    : `Compose ${meta.label.toLowerCase()} content, then submit the complete section once.`}
                </p>
                <button
                  className={saved ? ui.secondaryButton : ui.primaryButton}
                  disabled={
                    detail.isPending ||
                    detail.isError ||
                    (!saved && (!isDraft || current[meta.flag] !== false))
                  }
                  onClick={() => setSection(item)}
                >
                  {saved ? 'View section' : 'Compose section'}
                  <ArrowRight size={16} />
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <aside className={`${ui.surface} ${styles.versionDetails}`}>
        <h2>Template details</h2>
        <dl className={ui.detailList}>
          <dt>Status</dt>
          <dd>
            <span className={ui.badge} data-tone={current.status}>
              {readableValue(current.status)}
            </span>
          </dd>
          <dt>Internal label</dt>
          <dd>{label || '—'}</dd>
          <dt>Candidate title</dt>
          <dd>{title || '—'}</dd>
          <dt>Version created</dt>
          <dd>{tenantDate(version.createdAt)}</dd>
          {version.publishedAt ? (
            <>
              <dt>Published</dt>
              <dd>{tenantDate(version.publishedAt)}</dd>
            </>
          ) : null}
        </dl>
        <div className={styles.lifecycle}>
          <button
            className={ui.primaryButton}
            disabled={
              !canPublish || detail.isPending || detail.isError || contentBusy
            }
            onClick={() => action.mutate('publish')}
          >
            {action.isPending ? 'Working…' : 'Publish complete draft'}
          </button>
          <button
            className={ui.secondaryButton}
            disabled={contentBusy}
            onClick={() => action.mutate('copy')}
          >
            <Copy size={16} />
            Copy to new draft
          </button>
          <p className={ui.hint}>
            Copies retain saved, read-only content. All three sections are
            required before publishing.
          </p>
          {current.status === 'PUBLISHED' ? (
            <button
              className={ui.textButton}
              disabled={contentBusy}
              onClick={() => setConfirmAction('archive')}
            >
              Archive version
            </button>
          ) : null}
          {isDraft ? (
            <button
              className={ui.dangerLink}
              disabled={contentBusy}
              onClick={() => setConfirmAction('delete')}
            >
              Delete draft
            </button>
          ) : null}
        </div>
        {confirmAction ? (
          <div className={ui.confirmBox}>
            <p>
              {confirmAction === 'delete'
                ? 'Delete this draft version and its content? This cannot be undone.'
                : 'Archive this published version? It will no longer be available for new assignments.'}
            </p>
            <div>
              <button
                className={ui.dangerButton}
                disabled={contentBusy}
                onClick={() => action.mutate(confirmAction)}
              >
                Confirm {confirmAction}
              </button>
              <button
                className={ui.secondaryButton}
                disabled={contentBusy}
                onClick={() => setConfirmAction(null)}
              >
                Keep version
              </button>
            </div>
          </div>
        ) : null}
        {detail.isError ? (
          <p className={ui.inlineError}>
            The version could not be verified.{' '}
            <button
              className={ui.textButton}
              onClick={() => void detail.refetch()}
            >
              Retry
            </button>
          </p>
        ) : null}
        {action.error ? (
          <p className={ui.inlineError} role="alert">
            {getApiErrorMessage(
              action.error,
              'The version operation failed. Your content has not been discarded.',
            )}
          </p>
        ) : null}
        {action.isSuccess ? (
          <p className={ui.inlineSuccess} role="status">
            Version operation completed.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function SavedSection({
  templateId,
  versionId,
  section,
  onBack,
}: {
  templateId: number;
  versionId: number;
  section: Section;
  onBack: () => void;
}) {
  const content = useQuery({
    queryKey: ['mock-exams', 'tenant', templateId, versionId, section],
    queryFn: async () =>
      unwrapData(
        await mockExamApiService.getTenantSection(
          templateId,
          versionId,
          section,
        ),
        'tenantSection',
      ),
    retry: false,
  });
  return (
    <div className={ui.surface}>
      <div className={ui.sectionHeading}>
        <h2>{SECTION_META[section].label} content</h2>
        <span className={ui.badge}>
          <LockKeyhole size={14} />
          Read only
        </span>
      </div>
      <p className={ui.hint}>
        This saved section is read only. The current API does not support
        changing saved questions.
      </p>
      {content.isPending ? (
        <p className={ui.status}>Loading content…</p>
      ) : content.isError ? (
        <p className={ui.inlineError}>
          Content could not be loaded.
          <button
            className={ui.textButton}
            onClick={() => void content.refetch()}
          >
            Try again
          </button>
        </p>
      ) : (
        <>
          <RecordSummaryList value={content.data} />
          <ExamSectionMedia
            templateId={templateId}
            versionId={versionId}
            section={section}
            value={content.data}
          />
        </>
      )}
      <button className={ui.textButton} onClick={onBack}>
        <ArrowLeft size={17} />
        Back to version
      </button>
    </div>
  );
}
