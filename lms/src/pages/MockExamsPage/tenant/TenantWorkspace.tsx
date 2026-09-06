import {LocalizedError} from '@/i18n/errors';
import {formatNumber} from '@/i18n/formatting';
import { useTranslation } from 'react-i18next';
import {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {Copy, Plus} from 'lucide-react';
import {unwrapData, type MockExamTemplateSummary} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {TenantDrawer} from '@/components/TenantWorkspace/TenantDrawer';
import {
  readableValue,
  tenantDate,
} from '@/components/TenantWorkspace/presentation';
import {getApiErrorMessage, isRecord} from '@/utils/apiError';
import {templateItems, runtimeNumber} from '../staffRuntime';
import {SECTION_META, SECTIONS} from './model';
import {TenantTemplateEditor} from './TenantTemplateEditor';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './tenant.module.scss';

export function TenantWorkspace({value}: {value: unknown}) {
  const { t: translate } = useTranslation();
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const [createOpen, setCreateOpen] = useState(
    params.get('action') === 'create',
  );
  const [draft, setDraft] = useState({label: '', title: ''});
  const [invalid, setInvalid] = useState(false);
  const templates = templateItems(value);
  const selectedId = Number(params.get('template'));
  const closeCreate = () => {
    setCreateOpen(false);
    setParams({}, {replace: true});
  };
  const openTemplate = (id: number, versionId?: number) =>
    setParams({
      template: String(id),
      ...(versionId ? {version: String(versionId)} : {}),
    });
  const create = useMutation({
    mutationFn: async () =>
      unwrapData(
        await mockExamApiService.createTenantTemplate({
          label: draft.label.trim(),
          title: draft.title.trim(),
        }),
        'createTenantTemplate',
      ),
    onSuccess: async (created) => {
      setCreateOpen(false);
      setDraft({label: '', title: ''});
      await client.invalidateQueries({queryKey: ['mock-exams', 'tenant']});
      if (created.id) openTemplate(created.id, created.versions?.[0]?.id);
    },
  });
  const copy = useMutation({
    mutationFn: async (template: MockExamTemplateSummary) => {
      const version =
        template.versions?.find((item) => item.status === 'PUBLISHED') ??
        template.versions?.[0];
      if (!template.id || !version?.id)
        throw new LocalizedError("exams:templates.copySelectVersion");
      const result = unwrapData(
        await mockExamApiService.copyTenantVersion(
          template.id,
          version.id,
          version.id,
        ),
        'copyTenantVersion',
      );
      return {
        templateId: template.id,
        versionId: isRecord(result)
          ? runtimeNumber(result, 'id', 'versionId')
          : null,
      };
    },
    onSuccess: async (result) => {
      await client.invalidateQueries({queryKey: ['mock-exams', 'tenant']});
      openTemplate(result.templateId, result.versionId ?? undefined);
    },
  });
  if (Number.isInteger(selectedId) && selectedId > 0)
    return <TenantTemplateEditor key={selectedId} templateId={selectedId} />;
  return (
    <div className={ui.page}>
      <header className={ui.pageHeader}>
        <div>
          <h1>{translate("common:navigationControls.backToTemplates")}</h1>
          <p>{translate("exams:templates.help")}</p>
        </div>
        <button
          className={ui.primaryButton}
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={18} />
          {translate("exams:templates.new")}</button>
      </header>
      {copy.error ? (
        <p className={ui.inlineError} role="alert">
          {getApiErrorMessage(copy.error, translate('exams:templates.copyFailed'))}
        </p>
      ) : null}
      {templates.length === 0 ? (
        <div className={ui.surface}>
          <h2>{translate("exams:templates.emptyTitle")}</h2>
          <p className={ui.hint}>
            {translate("exams:templates.emptyHelp")}</p>
          <button
            className={ui.primaryButton}
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={18} />
            {translate("exams:templates.createFirst")}</button>
        </div>
      ) : (
        <div className={styles.templateGrid}>
          {templates.map((template) => {
            const latest =
              template.versions?.find(
                (version) => version.status === 'DRAFT',
              ) ??
              template.versions?.find(
                (version) => version.status === 'PUBLISHED',
              ) ??
              template.versions?.[0];
            const status =
              latest?.status ??
              (template.publishedVersionId ? 'PUBLISHED' : undefined);
            return (
              <article className={styles.templateCard} key={template.id}>
                <div className={styles.cardTop}>
                  <span className={styles.templateId}>
                    #{template.id == null ? '—' : formatNumber(template.id)}
                    <span className={styles.internalLabel}>
                      {template.label || translate("exams:templates.noInternalLabel")}
                    </span>
                  </span>
                  <span className={ui.badge} data-tone={status}>
                    {readableValue(status)}
                  </span>
                </div>
                <h2>{template.title || translate("exams:templates.untitled")}</h2>
                <p>
                  {translate('exams:templates.versionCount', {count: template.versions?.length ?? 0, number: formatNumber(template.versions?.length ?? 0)})}
                  {latest?.versionNo
                    ? <> · {translate('exams:templates.workingVersionNumber', {number: formatNumber(latest.versionNo)})}</>
                    : ''}
                </p>
                <div className={styles.sectionChips}>
                  {SECTIONS.filter(
                    (section) => latest?.[SECTION_META[section].flag],
                  ).map((section) => (
                    <span key={section}>{translate(SECTION_META[section].labelKey)}</span>
                  ))}
                  {!SECTIONS.some(
                    (section) => latest?.[SECTION_META[section].flag],
                  ) ? (
                    <span>{translate("exams:templates.noSections")}</span>
                  ) : null}
                </div>
                <footer>
                  <small>
                    {latest?.createdAt
                      ? translate('exams:templates.createdAt', {date: tenantDate(latest.createdAt)})
                      : translate("exams:templates.selectVersion")}
                  </small>
                  <div className={ui.actions}>
                    <button
                      className={ui.textButton}
                      disabled={!template.id}
                      onClick={() =>
                        template.id && openTemplate(template.id, latest?.id)
                      }
                    >
                      {translate("common:navigationControls.openTemplate")}</button>
                    <button
                      className={ui.textButton}
                      disabled={copy.isPending || !latest?.id}
                      aria-label={translate('exams:templates.duplicateItem', {title: template.title || translate('exams:templates.untitled')})}
                      onClick={() => copy.mutate(template)}
                    >
                      <Copy size={16} />
                      {translate("courseTools:owner.duplicate")}</button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      {createOpen ? (
        <TenantDrawer
          title={translate("exams:templates.newTitle")}
          description={translate("exams:templates.newHelp")}
          busy={create.isPending}
          onClose={closeCreate}
        >
          <form
            noValidate
            className={ui.form}
            onSubmit={(event) => {
              event.preventDefault();
              if (create.isPending) return;
              if (!draft.label.trim() || !draft.title.trim()) {setInvalid(true); return;}
              setInvalid(false);
              create.mutate();
            }}
          >
            <label>
              <span>{translate("exams:templates.internalLabel")}</span>
              <input
                required
                value={draft.label}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder={translate("exams:templates.internalPlaceholder")}
              />
            </label>
            <label>
              <span>{translate("exams:templates.candidateFacingTitle")}</span>
              <input
                required
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder={translate("exams:templates.candidatePlaceholder")}
              />
            </label>
            <p className={ui.hint}>
              {translate("exams:templates.createHelp")}</p>
            {invalid ? <p className={ui.inlineError} role="alert">{translate('exams:templates.required')}</p> : null}
            {create.error ? (
              <p className={ui.inlineError} role="alert">
                {getApiErrorMessage(
                  create.error,
                  translate('exams:templates.createFailed'),
                )}
              </p>
            ) : null}
            <div className={ui.formFooter}>
              <button
                type="button"
                className={ui.secondaryButton}
                disabled={create.isPending}
                onClick={closeCreate}
              >
                {translate("common:actions.cancel")}</button>
              <button className={ui.primaryButton} disabled={create.isPending}>
                {create.isPending ? translate("common:actions.creating") : translate("exams:templates.createDraft")}
              </button>
            </div>
          </form>
        </TenantDrawer>
      ) : null}
    </div>
  );
}
