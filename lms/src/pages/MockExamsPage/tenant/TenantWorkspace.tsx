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
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const [createOpen, setCreateOpen] = useState(
    params.get('action') === 'create',
  );
  const [draft, setDraft] = useState({label: '', title: ''});
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
        throw new Error('Open the template to select a version to copy.');
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
          <h1>Mock exam templates</h1>
          <p>Create, manage, and publish IELTS mock exam papers.</p>
        </div>
        <button
          className={ui.primaryButton}
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={18} />
          New template
        </button>
      </header>
      {copy.error ? (
        <p className={ui.inlineError} role="alert">
          {getApiErrorMessage(copy.error, 'The version could not be copied.')}
        </p>
      ) : null}
      {templates.length === 0 ? (
        <div className={ui.surface}>
          <h2>Your template library starts here</h2>
          <p className={ui.hint}>
            Create a draft, add its exam sections, and publish when it is ready.
          </p>
          <button
            className={ui.primaryButton}
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={18} />
            Create first template
          </button>
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
                    #{template.id}
                    <span className={styles.internalLabel}>
                      {template.label || 'No internal label'}
                    </span>
                  </span>
                  <span className={ui.badge} data-tone={status}>
                    {readableValue(status)}
                  </span>
                </div>
                <h2>{template.title || 'Untitled template'}</h2>
                <p>
                  {template.versions?.length ?? 0}{' '}
                  {(template.versions?.length ?? 0) === 1
                    ? 'version'
                    : 'versions'}
                  {latest?.versionNo
                    ? ` · Working version ${latest.versionNo}`
                    : ''}
                </p>
                <div className={styles.sectionChips}>
                  {SECTIONS.filter(
                    (section) => latest?.[SECTION_META[section].flag],
                  ).map((section) => (
                    <span key={section}>{SECTION_META[section].label}</span>
                  ))}
                  {!SECTIONS.some(
                    (section) => latest?.[SECTION_META[section].flag],
                  ) ? (
                    <span>No sections yet</span>
                  ) : null}
                </div>
                <footer>
                  <small>
                    {latest?.createdAt
                      ? `Version created ${tenantDate(latest.createdAt)}`
                      : 'Select a version to review'}
                  </small>
                  <div className={ui.actions}>
                    <button
                      className={ui.textButton}
                      disabled={!template.id}
                      onClick={() =>
                        template.id && openTemplate(template.id, latest?.id)
                      }
                    >
                      Open template

                    </button>
                    <button
                      className={ui.textButton}
                      disabled={copy.isPending || !latest?.id}
                      aria-label={`Duplicate ${template.title}`}
                      onClick={() => copy.mutate(template)}
                    >
                      <Copy size={16} />
                      Duplicate
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      {createOpen ? (
        <TenantDrawer
          title="New mock exam template"
          description="Create a draft before adding exam content and media."
          busy={create.isPending}
          onClose={closeCreate}
        >
          <form
            className={ui.form}
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <label>
              <span>Internal label</span>
              <input
                required
                value={draft.label}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="For your template library"
              />
            </label>
            <label>
              <span>Candidate-facing title</span>
              <input
                required
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Title shown to students"
              />
            </label>
            <p className={ui.hint}>
              Listening, Reading, and Writing content is created once per
              version. Saved sections are read only.
            </p>
            {create.error ? (
              <p className={ui.inlineError} role="alert">
                {getApiErrorMessage(
                  create.error,
                  'The template could not be created.',
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
                Cancel
              </button>
              <button className={ui.primaryButton} disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create draft'}
              </button>
            </div>
          </form>
        </TenantDrawer>
      ) : null}
    </div>
  );
}
