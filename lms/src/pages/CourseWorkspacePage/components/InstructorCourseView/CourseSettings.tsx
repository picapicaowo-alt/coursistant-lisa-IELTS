import {useTranslation} from 'react-i18next';
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CourseResponse, UpdateCourseRequest } from "@/apis";
import { courseApiService } from "@/apis/services/course-api";
import { TeachingDialog, TeachingError } from "@/components/TeachingWorkspace";
import styles from "./index.module.scss";

export function CourseSettings({
  course,
  writable,
  onClose,
}: {
  course: CourseResponse;
  writable: boolean;
  onClose: () => void;
}) {
  const {t: translate} = useTranslation();
  const [title, setTitle] = useState(course.title || course.name);
  const [description, setDescription] = useState(course.description ?? "");
  const client = useQueryClient();
  const patch: UpdateCourseRequest = {};
  if (title.trim() !== (course.title || course.name))
    patch.title = title.trim();
  if (description !== (course.description ?? "")) {
    if (description.trim()) patch.description = description;
    else patch.clearDescription = true;
  }
  const save = useMutation({
    mutationFn: () => courseApiService.updateCourse(course.id, patch),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["course", course.id] });
      onClose();
    },
  });
  return (
    <TeachingDialog
      title={translate("course:workspace.editDetails")}
      onClose={onClose}
      busy={save.isPending}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !writable ||
            save.isPending ||
            !title.trim() ||
            !Object.keys(patch).length
          )
            return;
          save.mutate();
        }}
      >
        <label>
          {translate("course:form.titleLabel")}<input
            autoFocus
            required
            value={title}
            disabled={!writable || save.isPending}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          {translate("common:fields.description")}<textarea
            rows={4}
            value={description}
            disabled={!writable || save.isPending}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {!writable ? (
          <p className={styles.notice}>
            {translate("course:workspace.archived")}</p>
        ) : null}
        <TeachingError error={save.error} />
        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={save.isPending}
            onClick={onClose}
          >
            {translate("common:actions.cancel")}</button>
          <button
            className={styles.primary}
            disabled={
              !writable ||
              !title.trim() ||
              !Object.keys(patch).length ||
              save.isPending
            }
          >
            {save.isPending ? translate("common:actions.saving") : translate("common:actions.saveChanges")}
          </button>
        </div>
      </form>
    </TeachingDialog>
  );
}
