import {LocalizedError} from '@/i18n/errors';
import {formatNumber} from '@/i18n/formatting';
import { useTranslation } from 'react-i18next';
import {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {Copy, LockKeyhole} from 'lucide-react';
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
  const { t: translate } = useTranslation();
  const [params, setParams] = useSearchParams();
  const requestedSection = params.get('section');
  const activeSection = isSection(requestedSection) ? requestedSection : null;
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
    <div className={`${ui.page} ${activeSection ? styles.composerPage : ''}`}>
      {!activeSection ? (
        <button
          type="button"
          className={ui.textButton}
          disabled={contentBusy}
          onClick={() => setParams({})}
        >

          {translate('common:navigationControls.backToTemplates')}
        </button>
      ) : null}
      <header
        className={`${ui.pageHeader} ${activeSection ? styles.composerHeading : styles.editorHeading}`}
      >
        <div>
          <h1>{template.data?.title || translate("exams:templates.templateTitle")}</h1>
          {activeSection ? (
            <nav
              className={styles.composerBreadcrumb}
              aria-label={translate("exams:templates.breadcrumb")}
            >
              <button
                type="button"
                disabled={contentBusy}
                onClick={() => setParams({})}
              >
                {translate("common:navigationControls.backToTemplates")}</button>
              <span aria-hidden="true">›</span>
              <button
                type="button"
                disabled={contentBusy}
                onClick={() =>
                  setParams({
                    template: String(templateId),
                    version: String(version?.id ?? ''),
                  })
                }
              >
                {template.data?.label || translate("exams:templates.versionOverview")}
              </button>
              <span aria-hidden="true">›</span>
              <span aria-current="page">
                {translate(SECTION_META[activeSection].labelKey)}
              </span>
            </nav>
          ) : (
            <p>
              {translate('exams:staff.template', {id: formatNumber(templateId)})}
              {version
                ? <> · {translate('courseTools:delivery.version', {number: version.versionNo == null ? '—' : formatNumber(version.versionNo)})} · {readableValue(version.status)}</>
                : ''}
            </p>
          )}
        </div>
        {versions.length ? (
          <label className={styles.versionSelect}>
            {translate("exams:templates.workingVersion")}<select
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
                  {translate('courseTools:delivery.version', {number: item.versionNo == null ? '—' : formatNumber(item.versionNo)})} · {readableValue(item.status)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>
      {template.isPending ? (
        <p className={ui.status}>{translate("exams:templates.loading")}</p>
      ) : template.isError ? (
        <div className={ui.errorNotice}>
          {getApiErrorMessage(template.error, translate('exams:templates.unavailable'))}
          <button
            className={ui.textButton}
            onClick={() => void template.refetch()}
          >
            {translate("common:actions.tryAgain")}</button>
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
        <p className={ui.empty}>{translate("exams:templates.noVersion")}</p>
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
  const { t: translate } = useTranslation();
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
        throw new LocalizedError("exams:templates.contentBusy");
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
            {translate("exams:templates.contentBusyHelp")}</p>
        ) : null}
        {!storageAvailable ? (
          <p className={ui.inlineError}>
            {translate("exams:templates.storageUnavailable")}</p>
        ) : null}
        <nav
          className={`${ui.tabs} ${styles.composerTabs}`}
          aria-label={translate("exams:templates.sections")}
        >
          {SECTIONS.map((item) => (
            <button
              key={item}
              className={section === item ? ui.activeTab : ''}
              aria-current={section === item ? 'page' : undefined}
              onClick={() => setSection(item)}
            >
              {translate(SECTION_META[item].labelKey)}
              {current[SECTION_META[item].flag] === true ? (
                <LockKeyhole size={14} />
              ) : null}
            </button>
          ))}
        </nav>
        {detail.isPending ? (
          <p className={ui.status}>{translate("exams:templates.checkingVersion")}</p>
        ) : detail.isError ? (
          <div className={ui.errorNotice}>
            {translate("exams:templates.versionUnverified")}<button
              className={ui.textButton}
              onClick={() => void detail.refetch()}
            >
              {translate("common:actions.tryAgain")}</button>
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
            <h2>{translate("exams:templates.contentUnavailable")}</h2>
            <p className={ui.hint}>
              {translate("exams:templates.contentUnavailableHelp")}</p>
            <button className={ui.textButton} onClick={() => setSection(null)}>
              {translate("common:navigationControls.backToVersion")}</button>
          </div>
        )}
      </>
    );
  return (
    <div className={styles.editorGrid}>
      <section>
        <div className={ui.sectionHeading}>
          <h2>{translate("exams:templates.sections")}</h2>
          <span className={ui.hint}>{translate("exams:templates.sectionList")}</span>
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
                    <h3>{translate(meta.labelKey)}</h3>
                    <p>
                      {saved
                        ? translate("exams:templates.savedReadOnly")
                        : current[meta.flag] === false
                          ? translate("exams:templates.noSavedContent")
                          : translate("exams:templates.contentStatusUnavailable")}
                    </p>
                  </div>
                  <span
                    className={ui.badge}
                    data-tone={saved ? 'SAVED' : 'DRAFT'}
                  >
                    {saved
                      ? translate("assessment:attempt.saved")
                      : current[meta.flag] === false
                        ? translate("common:status.NOT_STARTED")
                        : translate('course:learning.dataUnavailable')}
                  </span>
                </div>
                <p className={ui.hint}>
                  {saved
                    ? translate("exams:templates.reviewSavedHelp")
                    : translate('exams:templates.composeHelp', {section: translate(meta.labelKey)})}
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
                  {saved ? translate("common:navigationControls.viewSection") : translate('common:navigationControls.composeSection')}

                </button>
              </article>
            );
          })}
        </div>
      </section>
      <aside className={`${ui.surface} ${styles.versionDetails}`}>
        <h2>{translate("exams:templates.details")}</h2>
        <dl className={ui.detailList}>
          <dt>{translate("common:fields.status")}</dt>
          <dd>
            <span className={ui.badge} data-tone={current.status}>
              {readableValue(current.status)}
            </span>
          </dd>
          <dt>{translate("exams:templates.internalLabel")}</dt>
          <dd>{label || '—'}</dd>
          <dt>{translate("exams:templates.candidateTitle")}</dt>
          <dd>{title || '—'}</dd>
          <dt>{translate("exams:templates.createdDate")}</dt>
          <dd>{tenantDate(version.createdAt)}</dd>
          {version.publishedAt ? (
            <>
              <dt>{translate("common:status.PUBLISHED")}</dt>
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
            {action.isPending ? translate("common:actions.working") : translate("exams:templates.publishComplete")}
          </button>
          <button
            className={ui.secondaryButton}
            disabled={contentBusy}
            onClick={() => action.mutate('copy')}
          >
            <Copy size={16} />
            {translate("exams:templates.copyToDraft")}</button>
          <p className={ui.hint}>
            {translate("exams:templates.copyHelp")}</p>
          {current.status === 'PUBLISHED' ? (
            <button
              className={ui.textButton}
              disabled={contentBusy}
              onClick={() => setConfirmAction('archive')}
            >
              {translate("exams:templates.archive")}</button>
          ) : null}
          {isDraft ? (
            <button
              className={ui.dangerLink}
              disabled={contentBusy}
              onClick={() => setConfirmAction('delete')}
            >
              {translate("exams:templates.deleteDraft")}</button>
          ) : null}
        </div>
        {confirmAction ? (
          <div className={ui.confirmBox}>
            <p>
              {confirmAction === 'delete'
                ? translate("exams:templates.confirmDelete")
                : translate("exams:templates.confirmArchive")}
            </p>
            <div>
              <button
                className={ui.dangerButton}
                disabled={contentBusy}
                onClick={() => action.mutate(confirmAction)}
              >
                {translate('common:actions.confirmTarget', {target: translate(confirmAction === 'delete' ? 'common:actions.delete' : 'common:status.ARCHIVE')})}
              </button>
              <button
                className={ui.secondaryButton}
                disabled={contentBusy}
                onClick={() => setConfirmAction(null)}
              >
                {translate("exams:templates.keepVersion")}</button>
            </div>
          </div>
        ) : null}
        {detail.isError ? (
          <p className={ui.inlineError}>
            {translate("exams:templates.versionUnverified")}{' '}
            <button
              className={ui.textButton}
              onClick={() => void detail.refetch()}
            >
              {translate("common:actions.retry")}</button>
          </p>
        ) : null}
        {action.error ? (
          <p className={ui.inlineError} role="alert">
            {getApiErrorMessage(
              action.error,
              translate('exams:templates.operationFailed'),
            )}
          </p>
        ) : null}
        {action.isSuccess ? (
          <p className={ui.inlineSuccess} role="status">
            {translate("exams:templates.operationComplete")}</p>
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
  const { t: translate } = useTranslation();
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
        <h2>{translate('exams:templates.contentTitle', {section: translate(SECTION_META[section].labelKey)})}</h2>
        <span className={ui.badge}>
          <LockKeyhole size={14} />
          {translate("courseTools:owner.readOnly")}</span>
      </div>
      <p className={ui.hint}>
        {translate("exams:templates.savedSectionHelp")}</p>
      {content.isPending ? (
        <p className={ui.status}>{translate("exams:templates.loadingContent")}</p>
      ) : content.isError ? (
        <p className={ui.inlineError}>
          {translate("exams:templates.contentFailed")}<button
            className={ui.textButton}
            onClick={() => void content.refetch()}
          >
            {translate("common:actions.tryAgain")}</button>
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

        {translate('common:navigationControls.backToVersion')}
      </button>
    </div>
  );
}
