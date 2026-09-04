import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CourseWeek, CourseWeekPayload, unwrapData } from "@/apis";
import { courseApiService as api } from "@/apis/services/course-api";
import { TeachingDialog, TeachingError } from "@/components/TeachingWorkspace";
import {
  idempotencyFingerprint,
  useIdempotencyCheckpoint,
} from "@/hooks/useIdempotencyCheckpoint";
import styles from "./index.module.scss";

export function WeekEditor({
  courseId,
  week,
  onClose,
  onSaved,
}: {
  courseId: number;
  week?: CourseWeek;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [title, setTitle] = useState(week?.title ?? "");
  const [summary, setSummary] = useState(week?.summary ?? "");
  const [notice, setNotice] = useState("");
  const checkpoint = useIdempotencyCheckpoint();
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const payload: CourseWeekPayload = {};
      if (!week || title.trim() !== week.title) payload.title = title.trim();
      if (summary !== (week?.summary ?? "")) payload.summary = summary;
      const operation = `week-editor-${courseId}-${week?.id ?? "new"}`;
      const key = checkpoint.keyFor(operation, idempotencyFingerprint(payload));
      const saved = unwrapData(
        week
          ? await api.updateWeek(courseId, week.id, payload, key)
          : await api.createWeek(courseId, title.trim(), key, payload.summary),
        "save week",
      );
      checkpoint.complete(operation, key);
      // Older deployments may accept summary writes but omit it on reads.
      // Verify a fresh read before presenting the overview as persisted.
      const id = week?.id ?? saved?.id;
      if (!Number.isInteger(id) || id <= 0) {
        setNotice(
          "The server accepted the week but did not return its identity. Close this editor and refresh the course before making another change.",
        );
        return;
      }
      await client.invalidateQueries({ queryKey: ["course-weeks", courseId] });
      if (payload.summary !== undefined) {
        let confirmed = false;
        try {
          const read = unwrapData(
            await api.getCourseWeek(courseId, id),
            "read saved week",
          );
          confirmed = read?.id === id && read.summary === payload.summary;
        } catch {
          // The write already succeeded. Do not repeat a create when readback fails.
        }
        if (!confirmed) {
          setNotice(
            "The week was saved, but its overview could not be confirmed. Your text is kept here so you can copy it before closing.",
          );
          return;
        }
      }
      onSaved(id);
    },
  });
  const changed =
    !week || title.trim() !== week.title || summary !== (week.summary ?? "");
  return (
    <TeachingDialog
      title={week ? "Edit week" : "Add week"}
      onClose={onClose}
      busy={save.isPending}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending || notice || !title.trim() || !changed) return;
          save.mutate();
        }}
      >
        <label>
          Week title
          <input
            autoFocus
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={save.isPending}
          />
        </label>
        <label>
          Overview <span className={styles.optional}>(optional)</span>
          <textarea
            rows={5}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            disabled={save.isPending}
            placeholder="Describe the focus of this week"
          />
        </label>
        <TeachingError error={save.error} />
        {notice ? (
          <p role="status" className={styles.notice}>
            {notice}
          </p>
        ) : null}
        <footer className={styles.formActions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={save.isPending}
            onClick={onClose}
          >
            Close
          </button>
          <button
            className={styles.primary}
            disabled={
              !title.trim() || !changed || save.isPending || Boolean(notice)
            }
          >
            {save.isPending ? "Saving…" : week ? "Save week" : "Create week"}
          </button>
        </footer>
      </form>
    </TeachingDialog>
  );
}
