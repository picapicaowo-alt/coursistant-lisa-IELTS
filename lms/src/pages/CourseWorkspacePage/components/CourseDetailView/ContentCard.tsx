import React, {useState} from "react";
import {Download, ExternalLink, Eye} from 'lucide-react';
import styles from "./index.module.scss";
import {CourseMaterial, CourseWeek} from "@/apis";
import {courseApiService} from '@/apis/services/course-api';
import {isNotFound} from '@/utils/apiError';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';

const formatSize = (bytes: number | null): string => {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const zipFilename = (week: CourseWeek) => {
  const safeTitle = week.title.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${safeTitle || `week-${week.id}`}-materials.zip`;
};

/**
 * The Course Content card — the selected week and what is in it.
 *
 * The design shows a paragraph of description under the title. A week has no
 * description field; it holds materials. So the card lists those instead of
 * leaving the space blank or padding it with text the course never wrote.
 */
export const ContentCard: React.FC<{week: CourseWeek | null; onOpenMaterial?: (id: number) => void}> = ({week, onOpenMaterial}) => (
  <ContentCardBody week={week} onOpenMaterial={onOpenMaterial}/>
);

const ContentCardBody: React.FC<{week: CourseWeek | null; onOpenMaterial?: (id: number) => void}> = ({week, onOpenMaterial}) => {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadWeek = async () => {
    if (!week) return;
    setActiveAction('download-week');
    setError(null);

    try {
      const blob = await courseApiService.downloadWeekMaterials(week.courseId, week.id);
      saveBlob(blob, zipFilename(week));
    } catch (err) {
      setError(isNotFound(err)
        ? 'This week is no longer available.'
        : `Could not download all materials for ${week.title}.`);
    } finally {
      setActiveAction(null);
    }
  };

  const download = async (material: CourseMaterial) => {
    if (!week) return;
    setActiveAction(`download-${material.id}`);
    setError(null);

    try {
      const blob = await courseApiService.downloadMaterial(week.courseId, week.id, material.id);
      saveBlob(blob, material.originalFilename || material.displayName);
    } catch (err) {
      if (isNotFound(err)) {
        setError('This material is no longer available.');
      } else {
        setError(`Could not download ${material.displayName}.`);
      }
    } finally {
      setActiveAction(null);
    }
  };

  const preview = async (material: CourseMaterial) => {
    if (!week) return;
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setError('Allow pop-ups to preview this file.');
      return;
    }
    setActiveAction(`preview-${material.id}`);
    setError(null);

    try {
      const blob = await courseApiService.previewMaterial(week.courseId, week.id, material.id);
      showBlobInPreviewWindow(previewWindow, blob);
    } catch (err) {
      previewWindow.close();
      if (isNotFound(err)) {
        setError('This material is no longer available.');
      } else {
        setError(`Could not preview ${material.displayName}.`);
      }
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <p className={styles.cardLabel}>Course Content</p>
        {week?.materials.some(material => material.materialType === 'FILE') ? (
          <button
            type="button"
            className={styles.downloadWeekButton}
            onClick={() => void downloadWeek()}
            disabled={activeAction !== null}
          >
            <Download size={16}/>
            {activeAction === 'download-week' ? 'Preparing ZIP…' : 'Download all'}
          </button>
        ) : null}
      </div>

      {!week ? (
        <p className={styles.cardEmpty}>Select a week to see its content.</p>
      ) : (
        <>
          <h2 className={styles.contentTitle}>{week.title}</h2>

          {week.materials.length === 0 ? (
            <p className={styles.cardEmpty}>No materials in this week yet.</p>
          ) : (
            <ul className={styles.materialList}>
              {week.materials.map((material) => (
                <li key={material.id} className={styles.material}>
                  <span className={styles.materialIcon} aria-hidden="true">
                    {material.materialType === 'LINK' ? 'LINK' : (material.extension ?? 'file').toUpperCase()}
                  </span>
                  {onOpenMaterial ? <button type="button" className={styles.materialName} onClick={() => onOpenMaterial(material.id)}>{material.displayName}</button> : <span className={styles.materialName} title={material.displayName}>{material.displayName}</span>}
                  {material.materialType === 'FILE' && material.sizeBytes !== null ? (
                    <span className={styles.materialMeta}>{formatSize(material.sizeBytes)}</span>
                  ) : null}
                  <span className={styles.materialActions}>
                    {material.materialType === 'LINK' && material.linkUrl ? (
                      <a href={material.linkUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={15}/> Open
                      </a>
                    ) : null}
                    {material.materialType === 'FILE' && material.previewAvailable ? (
                      <button
                        type="button"
                        onClick={() => void preview(material)}
                        disabled={activeAction !== null}
                        aria-label={`Preview ${material.displayName}`}
                      >
                        <Eye size={15}/>
                        {activeAction === `preview-${material.id}` ? 'Opening…' : 'Preview'}
                      </button>
                    ) : null}
                    {material.materialType === 'FILE' ? (
                      <button
                        type="button"
                        onClick={() => void download(material)}
                        disabled={activeAction !== null}
                        aria-label={`Download ${material.displayName}`}
                      >
                        <Download size={15}/>
                        {activeAction === `download-${material.id}` ? 'Downloading…' : 'Download'}
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className={styles.materialError} role="alert">{error}</p> : null}
        </>
      )}
    </section>
  );
};
