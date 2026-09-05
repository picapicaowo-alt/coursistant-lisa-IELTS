import {useTranslation} from 'react-i18next';
import {LocalizedError} from '@/i18n/errors';
import React, {useRef, useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  FileText,
  FolderInput,
  Link as LinkIcon,
  Pencil,
  Plus,
  Trash2,
  Upload,
  MoreHorizontal,
} from 'lucide-react';
import type {CourseMaterial, CourseWeek} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import styles from '../CourseDetailView/index.module.scss';
import editStyles from './index.module.scss';

interface WeekContentCardProps {
  courseId: number;
  week: CourseWeek | null;
  weeks: CourseWeek[];
  currentUserId: number;
  canManageExistingMaterials: boolean;
  canUploadMaterials: boolean;
  onChanged: () => void;
  compactControls?: boolean;
}

interface UploadAttempt {
  files: File[];
  idempotencyKey: string;
}

interface LinkAttempt {
  linkUrl: string;
  linkDisplayName?: string;
  idempotencyKey: string;
}

/** Upload does not imply Course Manager permissions; own uploads remain deletable. */
export const WeekContentCard: React.FC<WeekContentCardProps> = ({
  courseId,
  week,
  weeks,
  currentUserId,
  canManageExistingMaterials,
  canUploadMaterials,
  onChanged,
  compactControls = false,
}) => {
  const {t: translate} = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotency = useIdempotencyCheckpoint();
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const finishChange = () => {
    setFailure(null);
    onChanged();
  };

  const uploadMaterials = useMutation({
    mutationFn: ({files, idempotencyKey}: UploadAttempt) => {
      if (!week) throw new LocalizedError("course:materialEditor.noWeek");
      return courseApiService.createMaterials(courseId, week.id, {files}, idempotencyKey);
    },
    retry: 1,
    onSuccess: (_, attempt) => {
      idempotency.complete(`material-upload-${courseId}-${week?.id}`, attempt.idempotencyKey);
      finishChange();
    },
    onError: () => setFailure("course:materialEditor.uploadFailed"),
  });

  const addLink = useMutation({
    mutationFn: ({linkUrl: url, linkDisplayName, idempotencyKey}: LinkAttempt) => {
      if (!week) throw new LocalizedError("course:materialEditor.noWeek");
      return courseApiService.createMaterials(
        courseId,
        week.id,
        {linkUrl: url, linkDisplayName},
        idempotencyKey
      );
    },
    retry: 1,
    onSuccess: (_, attempt) => {
      idempotency.complete(`material-link-${courseId}-${week?.id}`, attempt.idempotencyKey);
      setLinkUrl('');
      setLinkName('');
      finishChange();
    },
    onError: () => setFailure("course:materialEditor.linkFailed"),
  });

  const renameMaterial = useMutation({
    mutationFn: ({materialId, displayName}: {materialId: number; displayName: string}) => {
      if (!week) throw new LocalizedError("course:materialEditor.noWeek");
      const operation = `material-rename-${courseId}-${week.id}-${materialId}`;
      return courseApiService.renameMaterial(
        courseId,
        week.id,
        materialId,
        displayName,
        idempotency.keyFor(operation, idempotencyFingerprint({materialId, displayName})),
      );
    },
    onSuccess: (_, {materialId, displayName}) => {
      const operation = `material-rename-${courseId}-${week?.id}-${materialId}`;
      idempotency.completeFingerprint(operation, idempotencyFingerprint({materialId, displayName}));
      setEditingId(null);
      finishChange();
    },
    onError: () => setFailure("course:materialEditor.renameFailed"),
  });

  const deleteMaterial = useMutation({
    mutationFn: (materialId: number) => {
      if (!week) throw new LocalizedError("course:materialEditor.noWeek");
      const operation = `material-delete-${courseId}-${week.id}-${materialId}`;
      return courseApiService.deleteMaterial(courseId, week.id, materialId, idempotency.keyFor(operation, operation));
    },
    onSuccess: (_, materialId) => {
      const operation = `material-delete-${courseId}-${week?.id}-${materialId}`;
      idempotency.completeFingerprint(operation, operation);
      setConfirmDeleteId(null);
      finishChange();
    },
    onError: () => setFailure("course:materialEditor.deleteFailed"),
  });

  const moveMaterial = useMutation({
    mutationFn: ({materialId, targetWeekId}: {materialId: number; targetWeekId: number}) => {
      if (!week) throw new LocalizedError("course:materialEditor.noWeek");
      const operation = `material-move-${courseId}-${week.id}-${materialId}`;
      const fingerprint = idempotencyFingerprint({materialId, targetWeekId});
      return courseApiService.moveMaterial(
        courseId,
        week.id,
        materialId,
        targetWeekId,
        idempotency.keyFor(operation, fingerprint),
      );
    },
    onSuccess: (_, {materialId, targetWeekId}) => {
      const operation = `material-move-${courseId}-${week?.id}-${materialId}`;
      const fingerprint = idempotencyFingerprint({materialId, targetWeekId});
      idempotency.completeFingerprint(operation, fingerprint);
      finishChange();
    },
    onError: () => setFailure("course:materialEditor.moveFailed"),
  });

  const reorderMaterials = useMutation({
    mutationFn: (materialIds: number[]) => {
      if (!week) throw new LocalizedError("course:materialEditor.noWeek");
      const operation = `materials-reorder-${courseId}-${week.id}`;
      return courseApiService.reorderMaterials(
        courseId,
        week.id,
        materialIds,
        idempotency.keyFor(operation, idempotencyFingerprint(materialIds)),
      );
    },
    onSuccess: (_, materialIds) => {
      const operation = `materials-reorder-${courseId}-${week?.id}`;
      idempotency.completeFingerprint(operation, idempotencyFingerprint(materialIds));
      finishChange();
    },
    onError: () => setFailure("course:materialEditor.reorderFailed"),
  });

  const publishMaterial = useMutation({
    mutationFn: (materialId: number) => {
      if (!week) throw new LocalizedError("course:materialEditor.noWeek");
      const operation = `material-publish-${courseId}-${week.id}-${materialId}`;
      return courseApiService.publishMaterial(courseId, week.id, materialId, idempotency.keyFor(operation, operation));
    },
    onSuccess: (_, materialId) => {
      const operation = `material-publish-${courseId}-${week?.id}-${materialId}`;
      idempotency.completeFingerprint(operation, operation);
      finishChange();
    },
    onError: () => setFailure("course:materialEditor.publishFailed"),
  });

  const unpublishMaterial = useMutation({
    mutationFn: (materialId: number) => {
      if (!week) throw new LocalizedError("course:materialEditor.noWeek");
      const operation = `material-unpublish-${courseId}-${week.id}-${materialId}`;
      return courseApiService.unpublishMaterial(courseId, week.id, materialId, idempotency.keyFor(operation, operation));
    },
    onSuccess: (_, materialId) => {
      const operation = `material-unpublish-${courseId}-${week?.id}-${materialId}`;
      idempotency.completeFingerprint(operation, operation);
      finishChange();
    },
    onError: () => setFailure("course:materialEditor.unpublishFailed"),
  });

  const commitRename = (material: CourseMaterial) => {
    const displayName = editingName.trim();
    if (!displayName || displayName === material.displayName) {
      setEditingId(null);
      return;
    }
    renameMaterial.mutate({materialId: material.id, displayName});
  };

  const moveWithinWeek = (index: number, offset: -1 | 1) => {
    if (!week) return;
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= week.materials.length) return;

    const materialIds = week.materials.map(material => material.id);
    [materialIds[index], materialIds[targetIndex]] = [materialIds[targetIndex], materialIds[index]];
    reorderMaterials.mutate(materialIds);
  };

  return (
    <section className={styles.card} data-material-editor={compactControls || undefined}>
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.cardLabel}>{translate('course:learning.content')}</p>
          {week ? <h2 className={styles.cardTitle}>{week.title}</h2> : null}
        </div>
        {week && canUploadMaterials ? (
          <>
            <input
              ref={fileInputRef}
              className={editStyles.visuallyHidden}
              type="file"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) {
                  const operation = `material-upload-${courseId}-${week.id}`;
                  uploadMaterials.mutate({
                    files,
                    idempotencyKey: idempotency.keyFor(operation, idempotencyFingerprint(files)),
                  });
                }
                event.target.value = '';
              }}
            />
            <button
              type="button"
              className={editStyles.primaryAction}
              disabled={uploadMaterials.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16}/>
              {uploadMaterials.isPending ? translate("assessment:submission.uploading") : translate("course:materialEditor.upload")}
            </button>
          </>
        ) : null}
      </div>

      {!week ? (
        <p className={styles.cardEmpty}>{translate("course:materialEditor.selectWeek")}</p>
      ) : (
        <>
          {week.materials.length === 0 ? (
            <div className={editStyles.emptyMaterials}>
              <FileText size={22}/>
              <p>{translate("course:materials.empty")}</p>
            </div>
          ) : (
            <ul className={styles.materialList}>
              {week.materials.map((material, index) => {
                const canDelete = canManageExistingMaterials
                  || (canUploadMaterials && material.uploadedBy === currentUserId);

                return (
                  <li key={material.id} className={styles.material}>
                    <span className={styles.materialIcon} aria-hidden="true">
                      {material.materialType === 'LINK'
                        ? <LinkIcon size={16}/>
                        : <FileText size={16}/>}
                    </span>

                    {editingId === material.id ? (
                      <input
                        className={`${editStyles.weekInput} ${editStyles.materialNameInput}`}
                        aria-label={translate('course:materialEditor.nameFor', {name: material.displayName})}
                        value={editingName}
                        autoFocus
                        onChange={event => setEditingName(event.target.value)}
                        onBlur={() => commitRename(material)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') commitRename(material);
                          if (event.key === 'Escape') setEditingId(null);
                        }}
                      />
                    ) : (
                      <span className={styles.materialName}>
                        {material.displayName}
                        {material.publicationState === 'DRAFT' ? (
                          <span className={editStyles.draftBadge}>{translate("common:status.DRAFT")}</span>
                        ) : material.publicationState === 'PUBLISHED' ? (
                          week.state === "Draft" || week.publicationState === 'DRAFT' || material.effectiveStudentVisible === false ? (
                            <span className={editStyles.hiddenBadge} title={translate("course:materialEditor.draftWeekHelp")}>{translate("course:materialEditor.draftWeek")}</span>
                          ) : (
                            <span className={editStyles.publishedBadge}>{translate("common:status.PUBLISHED")}</span>
                          )
                        ) : null}
                      </span>
                    )}

                    <MaterialActionDisclosure compact={compactControls} name={material.displayName}><span className={editStyles.materialControls}>
                      {canManageExistingMaterials ? (
                        <>
                          {material.publicationState === 'PUBLISHED' ? (
                            <button
                              type="button"
                              disabled={unpublishMaterial.isPending}
                              onClick={() => unpublishMaterial.mutate(material.id)}
                              aria-label={translate('common:actions.unpublishNamed', {name: material.displayName})}
                              title={translate("course:materialEditor.unpublish")}
                            >
                              <EyeOff size={15}/>{compactControls ? translate("assessment:quiz.unpublish") : null}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={publishMaterial.isPending}
                              onClick={() => publishMaterial.mutate(material.id)}
                              aria-label={translate('common:actions.publishNamed', {name: material.displayName})}
                              title={translate("course:materialEditor.publish")}
                            >
                              <Eye size={15}/>{compactControls ? translate("course:addContent.publishButton") : null}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={index === 0 || reorderMaterials.isPending}
                            onClick={() => moveWithinWeek(index, -1)}
                            aria-label={translate('assessment:quiz.moveUp', {title: material.displayName})}
                            title={translate("course:workspace.moveUp")}
                          >
                            <ArrowUp size={15}/>{compactControls ? translate("course:workspace.moveUp") : null}
                          </button>
                          <button
                            type="button"
                            disabled={index === week.materials.length - 1 || reorderMaterials.isPending}
                            onClick={() => moveWithinWeek(index, 1)}
                            aria-label={translate('assessment:quiz.moveDown', {title: material.displayName})}
                            title={translate("course:workspace.moveDown")}
                          >
                            <ArrowDown size={15}/>{compactControls ? translate("course:workspace.moveDown") : null}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(material.id);
                              setEditingName(material.displayName);
                            }}
                            aria-label={translate('common:actions.renameNamed', {name: material.displayName})}
                            title={translate("course:workspace.renameAction")}
                          >
                            <Pencil size={15}/>{compactControls ? translate("course:workspace.renameAction") : null}
                          </button>
                          {weeks.length > 1 ? (
                            <label className={editStyles.moveControl} title={translate("course:materialEditor.moveWeek")}>
                              <FolderInput size={15}/>
                              <span className={editStyles.visuallyHidden}>{translate('courseTools:groups.moveNamed', {name: material.displayName})}</span>
                              <select
                                value=""
                                disabled={moveMaterial.isPending}
                                onChange={event => {
                                  const targetWeekId = Number(event.target.value);
                                  if (targetWeekId) moveMaterial.mutate({materialId: material.id, targetWeekId});
                                }}
                                aria-label={translate('course:materialEditor.moveNamedWeek', {name: material.displayName})}
                              >
                                <option value="">{translate("course:workspace.move")}</option>
                                {weeks.filter(item => item.id !== week.id).map(item => (
                                  <option key={item.id} value={item.id}>{item.title}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </>
                      ) : null}

                      {canDelete ? (
                        confirmDeleteId === material.id ? (
                          <span className={editStyles.deleteConfirm}>
                            <button
                              type="button"
                              className={editStyles.confirmDelete}
                              disabled={deleteMaterial.isPending}
                              onClick={() => deleteMaterial.mutate(material.id)}
                            >
                              {translate("common:actions.confirm")}</button>
                            <button type="button" onClick={() => setConfirmDeleteId(null)}>{translate("common:actions.cancel")}</button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={editStyles.deleteIcon}
                            onClick={() => setConfirmDeleteId(material.id)}
                            aria-label={translate('common:actions.deleteNamed', {name: material.displayName})}
                            title={translate("common:actions.delete")}
                          >
                            <Trash2 size={15}/>{compactControls ? translate("common:actions.delete") : null}
                          </button>
                        )
                      ) : null}
                    </span></MaterialActionDisclosure>
                  </li>
                );
              })}
            </ul>
          )}

          {canUploadMaterials ? (
            <LinkDisclosure compact={compactControls}><form
              className={editStyles.linkForm}
              onSubmit={event => {
                event.preventDefault();
                const url = linkUrl.trim();
                if (!url) return;
                const attempt = {
                  linkUrl: url,
                  linkDisplayName: linkName.trim() || undefined,
                };
                const operation = `material-link-${courseId}-${week.id}`;
                addLink.mutate({
                  ...attempt,
                  idempotencyKey: idempotency.keyFor(operation, idempotencyFingerprint(attempt)),
                });
              }}
            >
              <div className={editStyles.linkFormTitle}>
                <Plus size={16}/> {' '}{translate("course:materialEditor.externalLink")}</div>
              <input
                type="url"
                required
                placeholder={translate("course:materialEditor.linkPlaceholder")}
                value={linkUrl}
                onChange={event => setLinkUrl(event.target.value)}
                aria-label={translate("editor:linkUrl")}
              />
              <input
                type="text"
                placeholder={translate("course:materialEditor.namePlaceholder")}
                value={linkName}
                onChange={event => setLinkName(event.target.value)}
                aria-label={translate("course:materialEditor.linkName")}
              />
              <button type="submit" disabled={!linkUrl.trim() || addLink.isPending}>
                <LinkIcon size={15}/>
                {addLink.isPending ? translate("assessment:quiz.adding") : translate("course:materialEditor.addLink")}
              </button>
            </form></LinkDisclosure>
          ) : null}
        </>
      )}

      {failure ? <p className={editStyles.error} role="alert">{translate(failure)}</p> : null}
    </section>
  );
};

function MaterialActionDisclosure({compact, name, children}: {compact: boolean; name: string; children: React.ReactNode}) {
  const {t: translate} = useTranslation();
  if (!compact) return children;
  return <details className={editStyles.actionDisclosure} onKeyDown={event => {if (event.key === 'Escape') {event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus();}}} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;}}><summary aria-label={translate('course:materialEditor.manageNamed', {name})}><MoreHorizontal size={20}/></summary>{children}</details>;
}

function LinkDisclosure({compact, children}: {compact: boolean; children: React.ReactNode}) {
  const {t: translate} = useTranslation();
  return compact ? <details className={editStyles.linkDisclosure}><summary>{translate("course:materialEditor.externalLink")}</summary>{children}</details> : children;
}
