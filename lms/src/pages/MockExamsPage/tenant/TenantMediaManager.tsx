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
  const client = useQueryClient();
  const mutationKey = tenantContentWriteKey(templateId, versionId);
  const contentBusy = useIsMutating({mutationKey}) > 0;
  const input = useRef<HTMLInputElement>(null);
  const name = useId();
  const idempotency = useIdempotencyCheckpoint();
  const rule = MEDIA_RULES[kind];
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
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
    setError('');
    if (!next) return;
    if (
      next.size > rule.maxBytes ||
      !rule.extensions.includes(next.name.split('.').pop()?.toLowerCase() ?? '')
    ) {
      setError(`Choose ${rule.label}.`);
      setFile(null);
      return;
    }
    setFile(next);
  };
  const upload = useMutation({
    mutationKey,
    mutationFn: async ({file}: {file: File; select: typeof onSelect}) => {
      if (client.isMutating({mutationKey}) > 1)
        throw new Error('Wait for the current content operation to finish.');
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
        throw new Error('Wait for the current content operation to finish.');
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
            `Drag & drop ${kind === 'LISTENING_AUDIO' ? 'audio' : 'an image'}`}
        </strong>
        <small>{rule.label}</small>
        <input
          ref={input}
          type="file"
          className={ui.srOnly}
          aria-label="Choose media file"
          accept={rule.accept}
          disabled={contentBusy}
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
        <div className={ui.actions}>
          <button
            type="button"
            className={ui.secondaryButton}
            disabled={contentBusy}
            onClick={() => input.current?.click()}
          >
            {file ? 'Change file' : 'Choose file'}
          </button>
          {file ? (
            <button
              type="button"
              className={ui.primaryButton}
              disabled={contentBusy}
              onClick={() => upload.mutate({file, select: onSelect})}
            >
              {upload.isPending ? 'Uploading…' : 'Upload and use'}
            </button>
          ) : null}
        </div>
      </div>
      {media.isPending ? (
        <p className={ui.hint}>Loading uploaded media…</p>
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
              <strong>{item.fileName ?? `Media #${item.mediaId}`}</strong>
              <small>
                {item.sizeBytes == null
                  ? ''
                  : `${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB · `}
                {item.status === 'UPLOADED'
                  ? 'Ready to use'
                  : 'Bound to saved content'}
              </small>
            </span>
          </label>
          <div className={ui.actions}>
            <button
              type="button"
              className={ui.iconButton}
              aria-label={`Preview ${item.fileName ?? item.mediaId}`}
              disabled={previewMedia.isPending}
              onClick={() => previewMedia.mutate(item.mediaId)}
            >
              <Eye size={17} />
            </button>
            <button
              type="button"
              className={ui.iconButton}
              aria-label={`Delete ${item.fileName ?? item.mediaId}`}
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
          Clear media selection
        </button>
      ) : null}
      {preview ? (
        kind === 'LISTENING_AUDIO' ? (
          <audio className={styles.mediaPreview} src={preview.url} controls />
        ) : (
          <img
            className={styles.mediaPreview}
            src={preview.url}
            alt="Selected exam media"
          />
        )
      ) : null}
      {error ||
      upload.error ||
      previewMedia.error ||
      remove.error ||
      media.error ? (
        <p className={ui.inlineError} role="alert">
          {error ||
            getApiErrorMessage(
              upload.error || previewMedia.error || remove.error || media.error,
              'Media could not be processed. Try again; saved media remains protected.',
            )}
        </p>
      ) : null}
    </div>
  );
}
