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
      title="Edit course details"
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
          Course title
          <input
            autoFocus
            required
            value={title}
            disabled={!writable || save.isPending}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            rows={4}
            value={description}
            disabled={!writable || save.isPending}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {!writable ? (
          <p className={styles.notice}>
            This course is archived. Its content is read-only.
          </p>
        ) : null}
        <TeachingError error={save.error} />
        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={save.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={styles.primary}
            disabled={
              !writable ||
              !title.trim() ||
              !Object.keys(patch).length ||
              save.isPending
            }
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </TeachingDialog>
  );
}
