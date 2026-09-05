import {useState, type SetStateAction} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {unwrapData} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {getApiErrorCode} from '@/utils/apiError';
import {advisingErrorMessage} from '@/pages/advising/advisingErrors';
import {TenantSectionComposer} from './TenantSectionComposer';
import {authoringDraft, AUTHORING_ERROR_KEYS} from './authoringContent';
import type {Section, SectionDraft} from './model';
import ui from '@/components/TenantWorkspace/workspace.module.scss';

export function SavedSectionEditor({templateId, versionId, section, draft, onChange, onMediaDeleted, onBack, onSaved}: {
  templateId: number; versionId: number; section: Section; draft: SectionDraft;
  onChange: (next: SetStateAction<SectionDraft>) => void;
  onMediaDeleted: (id: number) => void; onBack: () => void; onSaved: () => Promise<void>;
}) {
  const {t} = useTranslation();
  const [blocked, setBlocked] = useState<string>();
  const [saved, setSaved] = useState(false);
  const content = useQuery({
    queryKey: ['mock-exams', 'tenant', templateId, versionId, 'authoring', section],
    queryFn: async () => authoringDraft(section, unwrapData(await mockExamApiService.getTenantAuthoring(templateId, versionId, section), 'tenantAuthoring')),
    retry: false, refetchOnWindowFocus: false,
  });
  const editable = draft.contentRevision == null ? content.data : draft;
  const stale = editable?.contentRevision !== content.data?.contentRevision;
  const requiresOverview = blocked === 'MOCK_EXAM_CONTENT_LOCKED' || blocked === 'MOCK_EXAM_SECTION_NOT_FOUND';
  const reload = async () => {
    const latest = await content.refetch();
    if (latest.isError || !latest.data) return;
    onChange(latest.data);
    setBlocked(undefined);
    setSaved(false);
  };
  return <>
    {blocked || stale && editable ? <p className={ui.errorNotice} role="alert">
      {t(blocked ? AUTHORING_ERROR_KEYS[blocked] ?? 'exams:editing.reloadRequired' : 'exams:editing.versionConflict')}
      <button type="button" className={ui.textButton} disabled={content.isFetching} onClick={() => requiresOverview ? onBack() : void reload()}>{t(requiresOverview ? 'common:navigationControls.backToVersion' : 'exams:editing.loadLatest')}</button>
    </p> : null}
    {saved ? <p role="status">{t('exams:editing.saved')}</p> : null}
    {content.isPending ? <p role="status">{t('exams:templates.loadingContent')}</p> : null}
    {content.isError ? <p role="alert" className={ui.errorNotice}>{advisingErrorMessage(content.error, t(AUTHORING_ERROR_KEYS[getApiErrorCode(content.error) ?? ''] ?? 'exams:templates.contentFailed'))}
      <button type="button" className={ui.textButton} onClick={() => void content.refetch()}>{t('common:actions.retry')}</button>
    </p> : null}
    {editable && content.isSuccess ? <TenantSectionComposer
      key={`${section}:${editable.contentRevision}`} templateId={templateId} versionId={versionId}
      section={section} draft={editable} existing disabled={Boolean(blocked) || stale || content.isFetching}
      onChange={next => {setSaved(false); onChange(typeof next === 'function' ? next(editable) : next);}}
      onMediaDeleted={onMediaDeleted} onBack={onBack}
      onConflict={async error => {setBlocked(getApiErrorCode(error) ?? 'reload'); await content.refetch(); await onSaved();}}
      onSaved={async revision => {
        onChange({...editable, contentRevision: revision});
        setSaved(true);
        await onSaved();
      }}
    /> : <button type="button" className={ui.textButton} onClick={onBack}>{t('common:navigationControls.backToVersion')}</button>}
  </>;
}
