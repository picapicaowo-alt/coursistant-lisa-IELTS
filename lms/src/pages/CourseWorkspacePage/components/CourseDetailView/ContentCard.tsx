import { useTranslation } from 'react-i18next';
import React, {useState} from "react";
import {Download, ExternalLink, Eye, FileText} from 'lucide-react';
import styles from "./index.module.scss";
import {CourseMaterial, CourseWeek} from "@/apis";
import {courseApiService} from '@/apis/services/course-api';
import {formatFileSize} from '@/utils/file-utils';
import {formatNumber} from '@/i18n/formatting';
import {isNotFound} from '@/utils/apiError';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';

const zipFilename = (week: CourseWeek) => {
  const safeTitle = week.title.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${safeTitle || `week-${week.id}`}-materials.zip`;
};

type MaterialError =
  | {key: 'weekUnavailable' | 'unavailable' | 'allowPopups'}
  | {key: 'downloadWeekFailed'; title: string}
  | {key: 'downloadFailed' | 'previewFailed'; name: string};

interface ContentCardProps {
  week: CourseWeek | null;
  onOpenMaterial?: (id: number) => void;
  compact?: boolean;
  label?: string;
  embedded?: boolean;
  showDownloadAll?: boolean;
}

/** Read-only material actions; the enclosing week workspace owns its overview. */
export const ContentCard: React.FC<ContentCardProps> = (props) => <ContentCardBody {...props}/>;

const ContentCardBody: React.FC<ContentCardProps> = ({week, onOpenMaterial, compact, label, embedded = false, showDownloadAll = true}) => {
  const { t: translate } = useTranslation();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<MaterialError | null>(null);

  const downloadWeek = async () => {
    if (!week) return;
    setActiveAction('download-week');
    setError(null);

    try {
      const blob = await courseApiService.downloadWeekMaterials(week.courseId, week.id);
      saveBlob(blob, zipFilename(week));
    } catch (err) {
      setError(isNotFound(err)
        ? {key: 'weekUnavailable'}
        : {key: 'downloadWeekFailed', title: week.title});
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
        setError({key: 'unavailable'});
      } else {
        setError({key: 'downloadFailed', name: material.displayName});
      }
    } finally {
      setActiveAction(null);
    }
  };

  const preview = async (material: CourseMaterial) => {
    if (!week) return;
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setError({key: 'allowPopups'});
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
        setError({key: 'unavailable'});
      } else {
        setError({key: 'previewFailed', name: material.displayName});
      }
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <section className={styles.card} data-material-list={true} aria-label={label ?? translate("course:materials.title")}>
      <div className={styles.cardHeader}>
        <div><h3 className={styles.cardLabel}>{label ?? translate("course:materials.title")}</h3>{compact ? <p className={styles.cardEmpty}>{translate("course:materials.count", {count: week?.materials.length ?? 0, total: formatNumber(week?.materials.length ?? 0)})}</p> : null}</div>
        {showDownloadAll && week?.materials.some(material => material.materialType === 'FILE') ? (
          <button
            type="button"
            className={styles.downloadWeekButton}
            onClick={() => void downloadWeek()}
            disabled={activeAction !== null}
          >
            <Download aria-hidden="true" size={16}/>
            {translate(activeAction === 'download-week' ? 'course:materials.preparingZip' : 'course:materials.downloadAll')}
          </button>
        ) : null}
      </div>

      {!week ? (
        <p className={styles.cardEmpty}>{translate("course:materials.selectWeek")}</p>
      ) : (
        <>
          {!compact && !embedded ? <h2 className={styles.contentTitle}>{week.title}</h2> : null}

          {week.materials.length === 0 ? (
            <p className={styles.cardEmpty}>{translate("course:materials.empty")}</p>
          ) : (
            <ul className={styles.materialList}>
              {week.materials.map((material) => (
                <li key={material.id} className={styles.material} data-material-type={material.teachingType || material.materialType}>
                  <span className={styles.materialIcon} aria-hidden="true">
                    {material.materialType === 'LINK' ? <ExternalLink aria-hidden="true" size={20}/> : compact || !material.extension ? <FileText size={20} aria-hidden="true"/> : material.extension.toUpperCase()}
                  </span>
                  {onOpenMaterial ? <button type="button" className={styles.materialName} onClick={() => onOpenMaterial(material.id)} aria-label={translate("course:materials.openNamed", {name: material.displayName})}>{material.displayName}</button> : <span className={styles.materialName} title={material.displayName}>{material.displayName}</span>}
                  {material.materialType === 'FILE' && material.sizeBytes != null ? (
                    <span className={styles.materialMeta}>{formatFileSize(material.sizeBytes)}</span>
                  ) : null}
                  <span className={styles.materialActions}>
                    {material.materialType === 'LINK' && material.linkUrl ? (
                      <a href={material.linkUrl} target="_blank" rel="noreferrer" aria-label={translate("course:materials.openLinkNamed", {name: material.displayName})}>
                        <ExternalLink aria-hidden="true" size={15}/> {translate("common:status.OPEN")}</a>
                    ) : null}
                    {material.materialType === 'FILE' && material.previewAvailable ? (
                      <button
                        type="button"
                        onClick={() => void preview(material)}
                        disabled={activeAction !== null}
                        aria-label={translate("course:materials.previewNamed", {name: material.displayName})}
                      >
                        <Eye aria-hidden="true" size={15}/>
                        {translate(activeAction === `preview-${material.id}` ? 'course:materials.opening' : 'course:materials.preview')}
                      </button>
                    ) : null}
                    {material.materialType === 'FILE' ? (
                      <button
                        type="button"
                        onClick={() => void download(material)}
                        disabled={activeAction !== null}
                        aria-label={translate("course:materials.downloadNamed", {name: material.displayName})}
                      >
                        <Download aria-hidden="true" size={15}/>
                        {activeAction === `download-${material.id}` ? translate("course:materials.downloading") : translate("common:actions.download")}
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className={styles.materialError} role="alert">{translate(`course:materials.${error.key}`, error)}</p> : null}
          {compact && onOpenMaterial && week.materials[0] ? <button type="button" className={styles.openMaterials} onClick={() => onOpenMaterial(week.materials[0].id)}>{translate("course:materials.openLearning")}</button> : null}
        </>
      )}
    </section>
  );
};
