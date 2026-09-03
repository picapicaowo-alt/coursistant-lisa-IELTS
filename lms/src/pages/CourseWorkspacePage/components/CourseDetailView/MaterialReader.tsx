import {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {MessageSquare, Sparkles} from 'lucide-react';
import type {CourseMaterial, CourseWeek} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {assertFileBlob, saveBlob} from '@/utils/downloadBlob';
import {getApiErrorMessage} from '@/utils/apiError';
import styles from './MaterialReader.module.scss';

import {embeddedVideoUrl} from './materialVideo';
const CourseAssistant = lazy(() => import('@/components/ChatContent'));
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
          A browser preview is not available for this file. Download it to
          continue reading.
        </p>
      ) : preview.isPending ? (
        <p role="status">Loading material…</p>
      ) : preview.isError ? (
        <p role="alert">
          {getApiErrorMessage(
            preview.error,
            'This material could not be loaded.',
          )}{' '}
          <button type="button" onClick={() => void preview.refetch()}>
            Retry
          </button>
        </p>
      ) : url ? (
        type.startsWith('video/') ? (
          <video controls src={url} aria-label={material.displayName} />
        ) : type.startsWith('audio/') ? (
          <audio controls src={url} aria-label={material.displayName} />
        ) : type.startsWith('image/') ? (
          <img src={url} alt={material.displayName} />
        ) : type === 'application/pdf' ? (
          <Suspense fallback={<p role="status">Loading PDF viewer…</p>}><PdfMaterialPreview blob={preview.data!} title={material.displayName} onRetry={() => preview.refetch()}/></Suspense>
        ) : (
          <p>Download this file to view it in a compatible application.</p>
        )
      ) : null}
      <button
        type="button"
        className={styles.download}
        onClick={() => void download()}
      >
        Download material
      </button>
      {downloadError ? (
        <p role="alert">
          {getApiErrorMessage(
            downloadError,
            'The file could not be downloaded.',
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
  const [assistantOpen, setAssistantOpen] = useState(false);
  const assistantButton = useRef<HTMLButtonElement>(null);
  const closeAssistant = () => {setAssistantOpen(false); assistantButton.current?.focus();};
  const materials = weeks.flatMap((week) => week.materials);
  const index = materials.findIndex((item) => item.id === materialId);
  const material = materials[index];
  const next = materials[index + 1];
  if (!material)
    return (
      <section className={styles.reader}>
        <p role="alert">This learning material is unavailable.</p>
        <button type="button" onClick={onClose}>
          Back to course
        </button>
      </section>
    );
  const embed = embeddedVideoUrl(material.linkUrl);
  return (
    <section className={styles.reader} aria-label="Course learning viewer">
      <header>
        <button type="button" onClick={onClose}>
          ‹ Back to course
        </button>
        {next ? (
          <button
            type="button"
            className={styles.primary}
            onClick={() => onSelect(next.id)}
          >
            Go to next item ›
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
                          ? 'Link'
                          : item.extension || 'File'}
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
              <p>Open this learning resource to read the published material.</p>
              {safeLink(material.linkUrl) ? (
                <a
                  className={styles.primary}
                  href={safeLink(material.linkUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open learning resource ↗
                </a>
              ) : (
                <p role="alert">
                  This resource does not contain a supported link.
                </p>
              )}
            </div>
          )}
          <footer role="toolbar" aria-label="Learning tools">
            <button type="button" onClick={onDiscussion}>
              <MessageSquare size={16} aria-hidden="true"/>Discussion
            </button>
            <button className={styles.assistantToggle} ref={assistantButton} type="button" aria-expanded={assistantOpen} aria-controls="course-assistant" onClick={() => setAssistantOpen(open => !open)}><Sparkles size={16} aria-hidden="true"/>AI Course</button>
          </footer>
        </div>
        {assistantOpen ? <section id="course-assistant" className={styles.assistant} aria-label="Course AI assistant" onKeyDown={event => {if (event.key === 'Escape') closeAssistant();}}>
          <Suspense fallback={<p role="status">Loading course assistant…</p>}><CourseAssistant isIntroTop={false} isDashboard={false} isWorkspace isCompact onClose={closeAssistant} courseId={courseId}/></Suspense>
        </section> : null}
      </div>
    </section>
  );
}
