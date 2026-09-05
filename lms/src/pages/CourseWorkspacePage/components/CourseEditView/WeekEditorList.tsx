import {useTranslation} from 'react-i18next';
import React, {useState} from "react";
import {useMutation} from "@tanstack/react-query";
import {ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2} from 'lucide-react';
import styles from "../CourseDetailView/index.module.scss";
import editStyles from "./index.module.scss";
import {CourseWeek} from "@/apis";
import {courseApiService} from "@/apis/services/course-api";

interface WeekEditorListProps {
  courseId: number;
  weeks: CourseWeek[];
  activeWeekId: number | null;
  onSelect: (weekId: number) => void;
  onChanged: () => void;
  canEditStructure?: boolean;
}

/**
 * The editable week outline.
 *
 * The design's trailing slot reads "Enter the name of the course" next to a
 * `+`. It creates a week, so the placeholder here says so instead — naming a
 * course from the week list would be misleading, and the course title is
 * edited in place above.
 *
 * Deleting only works on an empty week; the API refuses one that still holds
 * materials, and the error says which case it was rather than failing silently.
 */
export const WeekEditorList: React.FC<WeekEditorListProps> = ({
                                                                courseId,
                                                                weeks,
                                                                activeWeekId,
                                                                onSelect,
                                                                onChanged,
                                                                canEditStructure = true,
                                                              }) => {
  const {t: translate} = useTranslation();
  const [draftTitle, setDraftTitle] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const createWeek = useMutation({
    mutationFn: ({title, idempotencyKey}: {title: string; idempotencyKey: string}) =>
      courseApiService.createWeek(courseId, title, idempotencyKey),
    retry: 1,
    onSuccess: () => {
      setDraftTitle('');
      setFailure(null);
      onChanged();
    },
    onError: () => setFailure("Couldn't add the week."),
  });

  const renameWeek = useMutation({
    mutationFn: ({weekId, title}: {weekId: number; title: string}) =>
      courseApiService.renameWeek(courseId, weekId, title),
    onSuccess: () => {
      setEditingId(null);
      setFailure(null);
      onChanged();
    },
    onError: () => setFailure("Couldn't rename the week."),
  });

  const deleteWeek = useMutation({
    mutationFn: (weekId: number) => courseApiService.deleteWeek(courseId, weekId),
    onSuccess: () => {
      setConfirmDeleteId(null);
      setFailure(null);
      onChanged();
    },
    // The usual cause is materials still in the week, which the API refuses.
    onError: () => setFailure("Couldn't delete the week. Empty it first."),
  });

  const togglePublish = useMutation({
    mutationFn: (week: CourseWeek) => week.state === 'Published'
      ? courseApiService.unpublishWeek(courseId, week.id)
      : courseApiService.publishWeek(courseId, week.id),
    onSuccess: () => {
      setFailure(null);
      onChanged();
    },
    onError: () => setFailure("Couldn't change the week's visibility."),
  });

  const reorderWeeks = useMutation({
    mutationFn: (weekIds: number[]) => courseApiService.reorderWeeks(courseId, weekIds),
    onSuccess: () => {
      setFailure(null);
      onChanged();
    },
    onError: () => setFailure("Couldn't reorder the weeks."),
  });

  const moveWeek = (index: number, offset: -1 | 1) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= weeks.length) return;

    const weekIds = weeks.map(week => week.id);
    [weekIds[index], weekIds[targetIndex]] = [weekIds[targetIndex], weekIds[index]];
    reorderWeeks.mutate(weekIds);
  };

  const commitRename = (weekId: number) => {
    const title = editingTitle.trim();
    if (!title) {
      setEditingId(null);
      return;
    }
    renameWeek.mutate({weekId, title});
  };

  return (
    <>
      <ul className={styles.weekList}>
        {weeks.map((week, index) => (
          <li key={week.id}>
            <div
              className={`${styles.weekCard} ${week.id === activeWeekId ? styles.weekCardActive : ''}`}
              onClick={() => onSelect(week.id)}
            >
              <span className={styles.weekLabel}>
                {translate("course:card.weeksSingular")}{' '}{week.orderPosition + 1}
                {week.state === "Draft" && <span className={styles.draftTag}>{translate("common:status.DRAFT")}</span>}
              </span>

              {canEditStructure && editingId === week.id ? (
                <input
                  className={editStyles.weekInput}
                  value={editingTitle}
                  autoFocus
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setEditingTitle(event.target.value)}
                  onBlur={() => commitRename(week.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename(week.id);
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <span className={styles.weekTitle}>{week.title}</span>
              )}

              {canEditStructure ? <div className={editStyles.weekActions}>
                <button
                  type="button"
                  disabled={index === 0 || reorderWeeks.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    moveWeek(index, -1);
                  }}
                  aria-label={translate('course:weeks.moveNamedUp', {title: week.title})}
                >
                  <ArrowUp size={14}/> {' '}{translate("course:workspace.up")}</button>
                <button
                  type="button"
                  disabled={index === weeks.length - 1 || reorderWeeks.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    moveWeek(index, 1);
                  }}
                  aria-label={translate('course:weeks.moveNamedDown', {title: week.title})}
                >
                  <ArrowDown size={14}/> {' '}{translate("course:workspace.down")}</button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingId(week.id);
                    setEditingTitle(week.title);
                  }}
                >
                  <Pencil size={14}/> {' '}{translate("course:workspace.renameAction")}</button>
                <button
                  type="button"
                  disabled={togglePublish.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePublish.mutate(week);
                  }}
                >
                  {week.state === "Published" ? <EyeOff size={14}/> : <Eye size={14}/>}
                  {week.state === "Published" ? translate("assessment:quiz.unpublish") : translate("course:addContent.publishButton")}
                </button>
                {confirmDeleteId === week.id ? (
                  <span className={editStyles.deleteConfirm} onClick={event => event.stopPropagation()}>
                    <button
                      type="button"
                      className={editStyles.dangerAction}
                      disabled={deleteWeek.isPending}
                      onClick={() => deleteWeek.mutate(week.id)}
                    >
                      {translate("common:actions.confirm")}</button>
                    <button type="button" onClick={() => setConfirmDeleteId(null)}>{translate("common:actions.cancel")}</button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={editStyles.dangerAction}
                    disabled={deleteWeek.isPending}
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmDeleteId(week.id);
                    }}
                  >
                    <Trash2 size={14}/> {' '}{translate("common:actions.delete")}</button>
                )}
              </div> : null}
            </div>
          </li>
        ))}

        {canEditStructure ? <li>
          <div className={editStyles.newWeekCard}>
            <span className={styles.weekLabel}>{translate("course:card.weeksSingular")}{' '}{weeks.length + 1}</span>
            <div className={editStyles.newWeekRow}>
              <input
                className={editStyles.weekInput}
                placeholder={translate("course:weeks.newTitle")}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && draftTitle.trim()) {
                    createWeek.mutate({
                      title: draftTitle.trim(),
                      idempotencyKey: crypto.randomUUID(),
                    });
                  }
                }}
              />
              <button
                type="button"
                className={editStyles.addButton}
                disabled={!draftTitle.trim() || createWeek.isPending}
                onClick={() => createWeek.mutate({
                  title: draftTitle.trim(),
                  idempotencyKey: crypto.randomUUID(),
                })}
                aria-label={translate("course:weeks.add")}
              >
                <Plus size={16}/>
              </button>
            </div>
          </div>
        </li> : null}
      </ul>

      {failure && <p className={editStyles.error} role="alert">{failure}</p>}
    </>
  );
};
