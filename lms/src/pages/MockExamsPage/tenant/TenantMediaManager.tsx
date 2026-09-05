import {LocalizedError} from '@/i18n/errors';
import {formatNumber} from '@/i18n/formatting';
import {formatFileSize} from '@/utils/file-utils';
import {useTranslation} from 'react-i18next';
import {useEffect, useId, useRef, useState} from 'react';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {Eye, FileUp, Headphones, Trash2} from 'lucide-react';
import {unwrapData, type MockExamMediaKind} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {
  idempotencyFingerprint,
  useIdempotencyCheckpoint,
} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorMessage} from '@/utils/apiError';
import {MEDIA_RULES, tenantContentWriteKey} from './model';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './tenant.module.scss';

export function TenantMediaManager({
  templateId,
  versionId,
  kind,
  selectedMediaId,
  onSelect,
  onDeleted,
}: {
  templateId: number;
  versionId: number;
  kind: MockExamMediaKind;
  selectedMediaId: number | null;
  onSelect: (id: number | null) => void;
  onDeleted: (id: number) => void;
}) {
  const {t: translate} = useTranslation();
  const client = useQueryClient();
  const mutationKey = tenantContentWriteKey(templateId, versionId);
  const contentBusy = useIsMutating({mutationKey}) > 0;
  const input = useRef<HTMLInputElement>(null);
  const name = useId();
  const idempotency = useIdempotencyCheckpoint();
  const rule = MEDIA_RULES[kind];
  const [file, setFile] = useState<File | null>(null);
  const [invalidFile, setInvalidFile] = useState(false);
  const [preview, setPreview] = useState<{id: number; url: string} | null>(
    null,
  );
  const queryKey = ['mock-exams', 'tenant', templateId, versionId, 'media'];
  const media = useQuery({
    queryKey,
    queryFn: async () =>
      unwrapData(
        await mockExamApiService.listTenantMedia(templateId, versionId),
        'tenantMedia',
      ),
    retry: false,
  });
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  const choose = (next: File | null) => {
    setInvalidFile(false);
    if (!next) return;
    if (
      next.size > rule.maxBytes ||
      !rule.extensions.includes(next.name.split('.').pop()?.toLowerCase() ?? '')
    ) {
      setInvalidFile(true);
      setFile(null);
      return;
    }
    setFile(next);
  };
  const upload = useMutation({
    mutationKey,
    mutationFn: async ({file}: {file: File; select: typeof onSelect}) => {
      if (client.isMutating({mutationKey}) > 1)
        throw new LocalizedError("exams:templates.contentBusy");
      const fingerprint = idempotencyFingerprint({
        kind,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
      });
      return unwrapData(
        await idempotency.run(
          `mock-media-${templateId}-${versionId}-${kind}`,
          fingerprint,
          (key) =>
            mockExamApiService.uploadTenantMedia(
              templateId,
              versionId,
              kind,
              file,
              key,
            ),
        ),
        'tenantMediaUpload',
      );
    },
    onSuccess: async (created, variables) => {
      // Mutation options can change during navigation; use the originating target.
      variables.select(created.mediaId);
      setFile(null);
      if (input.current) input.current.value = '';
      await client.invalidateQueries({queryKey});
    },
  });
  const previewMedia = useMutation({
    mutationFn: async (id: number) => ({
      id,
      blob: await mockExamApiService.previewTenantMedia(
        templateId,
        versionId,
        id,
      ),
    }),
    onSuccess: (result) =>
      setPreview({id: result.id, url: URL.createObjectURL(result.blob)}),
  });
  const remove = useMutation({
    mutationKey,
    mutationFn: async (id: number) => {
      if (client.isMutating({mutationKey}) > 1)
        throw new LocalizedError("exams:templates.contentBusy");
      await mockExamApiService.deleteTenantMedia(templateId, versionId, id);
      return id;
    },
    onSuccess: async (id) => {
      onDeleted(id);
      client.setQueryData<typeof media.data>(queryKey, (current) =>
        current?.filter((item) => item.mediaId !== id),
      );
      if (preview?.id === id) setPreview(null);
      await client.invalidateQueries({queryKey});
    },
  });
  const items = (media.data ?? []).filter((item) => item.kind === kind);
  return (
    <div className={styles.media}>
      <div
        className={styles.dropzone}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!contentBusy) choose(event.dataTransfer.files[0] ?? null);
        }}
      >
        <FileUp size={30} />
        <strong>
          {file?.name ??
            translate(kind === 'LISTENING_AUDIO' ? 'exams:media.dropAudio' : 'exams:media.dropImage')}
        </strong>
        <small>{translate(rule.labelKey)}</small>
        <input
          ref={input}
          type="file"
          className={ui.srOnly}
          aria-label={translate("exams:media.choose")}
          accept={rule.accept}
          disabled={contentBusy}
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
        <div className={ui.actions}>
          <button
            type="button"
            className={ui.primaryButton}
            disabled={contentBusy}
            onClick={() => input.current?.click()}
          >
            {file ? translate("exams:media.change") : translate("exams:media.chooseFile")}
          </button>
          {file ? (
            <button
              type="button"
              className={ui.primaryButton}
              disabled={contentBusy}
              onClick={() => upload.mutate({file, select: onSelect})}
            >
              {upload.isPending ? translate("assessment:submission.uploading") : translate("exams:media.uploadUse")}
            </button>
          ) : null}
        </div>
      </div>
      {media.isPending ? (
        <p className={ui.hint}>{translate("exams:media.loading")}</p>
      ) : null}
      {items.map((item) => (
        <article
          className={styles.mediaRow}
          data-selected={item.mediaId === selectedMediaId}
          key={item.mediaId}
        >
          <label>
            <input
              type="radio"
              name={name}
              checked={item.mediaId === selectedMediaId}
              disabled={contentBusy || item.status !== 'UPLOADED'}
              onChange={() => onSelect(item.mediaId)}
            />
            <Headphones size={18} />
            <span>
              <strong>{item.fileName ?? translate('exams:media.fallbackName', {id: formatNumber(item.mediaId)})}</strong>
              <small>
                {item.sizeBytes == null
                  ? ''
                  : `${formatFileSize(item.sizeBytes)} · `}
                {item.status === 'UPLOADED'
                  ? translate("exams:media.ready")
                  : translate("exams:media.bound")}
              </small>
            </span>
          </label>
          <div className={ui.actions}>
            <button
              type="button"
              className={ui.iconButton}
              aria-label={translate('course:materials.previewNamed', {name: item.fileName ?? translate('exams:media.fallbackName', {id: formatNumber(item.mediaId)})})}
              disabled={previewMedia.isPending}
              onClick={() => previewMedia.mutate(item.mediaId)}
            >
              <Eye size={17} />
            </button>
            <button
              type="button"
              className={ui.iconButton}
              aria-label={translate('common:actions.deleteNamed', {name: item.fileName ?? translate('exams:media.fallbackName', {id: formatNumber(item.mediaId)})})}
              disabled={contentBusy || item.status !== 'UPLOADED'}
              onClick={() => remove.mutate(item.mediaId)}
            >
              <Trash2 size={17} />
            </button>
          </div>
        </article>
      ))}
      {selectedMediaId ? (
        <button
          type="button"
          className={ui.textButton}
          disabled={contentBusy}
          onClick={() => onSelect(null)}
        >
          {translate("exams:media.clear")}</button>
      ) : null}
      {preview ? (
        kind === 'LISTENING_AUDIO' ? (
          <audio className={styles.mediaPreview} src={preview.url} controls />
        ) : (
          <img
            className={styles.mediaPreview}
            src={preview.url}
            alt={translate("exams:media.selectedAlt")}
          />
        )
      ) : null}
      {invalidFile ||
      upload.error ||
      previewMedia.error ||
      remove.error ||
      media.error ? (
        <p className={ui.inlineError} role="alert">
          {invalidFile ? translate('exams:media.invalidFile', {formats: translate(rule.labelKey)}) :
            getApiErrorMessage(
              upload.error || previewMedia.error || remove.error || media.error,
              translate('exams:media.failed'),
            )}
        </p>
      ) : null}
    </div>
  );
}
