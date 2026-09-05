import {useTranslation} from 'react-i18next';
import {lazy, Suspense, useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {MessageSquare} from 'lucide-react';
import type {CourseMaterial, CourseWeek} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {assertFileBlob, saveBlob} from '@/utils/downloadBlob';
import {getApiErrorMessage} from '@/utils/apiError';
import styles from './MaterialReader.module.scss';

import {embeddedVideoUrl} from './materialVideo';
const PdfMaterialPreview = lazy(() => import('./PdfMaterialPreview'));
const safeLink = (value: string | null) => {
  try {
    const url = new URL(value ?? '');
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
function FilePreview({
  material,
  courseId,
}: {
  material: CourseMaterial;
  courseId: number;
}) {
  const {t: translate} = useTranslation();
  const [url, setUrl] = useState<string>();
  const [downloadError, setDownloadError] = useState<unknown>();
  const preview = useQuery({
    queryKey: ['material-preview', courseId, material.weekId, material.id],
    queryFn: async () =>
      assertFileBlob(
        await courseApiService.previewMaterial(
          courseId,
          material.weekId,
          material.id,
        ),
      ),
    enabled: material.previewAvailable,
    retry: false,
  });
  useEffect(() => {
    if (!preview.data) return;
    const next = URL.createObjectURL(preview.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [preview.data]);
  const type = preview.data?.type || material.contentType || '';
  const download = async () => {
    setDownloadError(undefined);
    try {
      saveBlob(
        await courseApiService.downloadMaterial(
          courseId,
          material.weekId,
          material.id,
        ),
        material.originalFilename || material.displayName,
      );
    } catch (error) {
      setDownloadError(error);
    }
  };
  return (
    <div className={styles.preview}>
      {!material.previewAvailable ? (
        <p>
          {translate("course:reader.noPreview")}</p>
      ) : preview.isPending ? (
        <p role="status">{translate("course:reader.loading")}</p>
      ) : preview.isError ? (
        <p role="alert">
          {getApiErrorMessage(
            preview.error,
            translate('course:reader.loadFailed'),
          )}{' '}
          <button type="button" onClick={() => void preview.refetch()}>
            {translate("common:actions.retry")}</button>
        </p>
      ) : url ? (
        type.startsWith('video/') ? (
          <video controls src={url} aria-label={material.displayName} />
        ) : type.startsWith('audio/') ? (
          <audio controls src={url} aria-label={material.displayName} />
        ) : type.startsWith('image/') ? (
          <img src={url} alt={material.displayName} />
        ) : type === 'application/pdf' ? (
          <Suspense fallback={<p role="status">{translate("course:reader.loadingPdf")}</p>}><PdfMaterialPreview blob={preview.data!} title={material.displayName} onRetry={() => preview.refetch()}/></Suspense>
        ) : (
          <p>{translate("course:reader.downloadHelp")}</p>
        )
      ) : null}
      <button
        type="button"
        className={styles.download}
        onClick={() => void download()}
      >
        {translate("course:reader.download")}</button>
      {downloadError ? (
        <p role="alert">
          {getApiErrorMessage(
            downloadError,
            translate('course:reader.downloadFailed'),
          )}
        </p>
      ) : null}
    </div>
  );
}
export function MaterialReader({
  courseId,
  title,
  weeks,
  materialId,
  onSelect,
  onClose,
  onDiscussion,
}: {
  courseId: number;
  title: string;
  weeks: CourseWeek[];
  materialId: number;
  onSelect: (id: number) => void;
  onClose: () => void;
  onDiscussion: () => void;
}) {
  const {t: translate} = useTranslation();

  const materials = weeks.flatMap((week) => week.materials);
  const index = materials.findIndex((item) => item.id === materialId);
  const material = materials[index];
  const next = materials[index + 1];
  if (!material)
    return (
      <section className={styles.reader}>
        <p role="alert">{translate("course:reader.unavailable")}</p>
        <button type="button" onClick={onClose}>
          {translate("common:navigationControls.backToCourse")}</button>
      </section>
    );
  const embed = embeddedVideoUrl(material.linkUrl);
  return (
    <section className={styles.reader} aria-label={translate("course:reader.title")}>
      <header>
        <button type="button" onClick={onClose}>
          {translate("common:navigationControls.backToCourse")}
        </button>
        {next ? (
          <button
            type="button"
            className={styles.primary}
            onClick={() => onSelect(next.id)}
          >
            {translate("common:navigationControls.nextMaterial")}
          </button>
        ) : null}
      </header>
      <div className={styles.layout}>
        <aside>
          <h2>{title}</h2>
          {weeks.map((week) => (
            <section key={week.id}>
              <h3>{week.title}</h3>
              <ul>
                {week.materials.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={item.id === materialId ? 'true' : undefined}
                      onClick={() => onSelect(item.id)}
                    >
                      <span>{item.displayName}</span>
                      <small>
                        {item.materialType === 'LINK'
                          ? translate("common:status.LINK")
                          : item.extension || translate("common:status.FILE")}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </aside>
        <div className={styles.content}>
          <h1>{material.displayName}</h1>
          {material.materialType === 'FILE' ? (
            <FilePreview
              key={material.id}
              courseId={courseId}
              material={material}
            />
          ) : embed ? (
            <iframe
              className={styles.video}
              src={embed}
              title={material.displayName}
              allow="fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className={styles.linkResource}>
              <p>{translate("course:reader.linkHelp")}</p>
              {safeLink(material.linkUrl) ? (
                <a
                  className={styles.primary}
                  href={safeLink(material.linkUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {translate("course:reader.openLink")}</a>
              ) : (
                <p role="alert">
                  {translate("course:reader.invalidLink")}</p>
              )}
            </div>
          )}
          <footer role="toolbar" aria-label={translate("course:reader.tools")}>
            <button type="button" onClick={onDiscussion}>
              <MessageSquare size={16} aria-hidden="true"/>{translate("course:learning.tabs.discussion")}</button>
          </footer>
        </div>

      </div>
    </section>
  );
}
