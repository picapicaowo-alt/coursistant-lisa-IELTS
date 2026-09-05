import {useTranslation} from 'react-i18next';
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
  const {t: translate} = useTranslation();
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
          "course:weeks.missingIdentity",
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
            "course:weeks.unconfirmedOverview",
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
      title={week ? translate("course:weeks.edit") : translate("course:weeks.add")}
      onClose={onClose}
      busy={save.isPending}
    >
      <form
        noValidate
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending || notice || !title.trim() || !changed) return;
          save.mutate();
        }}
      >
        <label>
          {translate("course:weeks.title")}<input
            autoFocus
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={save.isPending}
          />
        </label>
        <label>
          {translate("advising:studentPlan.overview")}{' '}<span className={styles.optional}>{translate("course:workspace.optionalParentheses")}</span>
          <textarea
            rows={5}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            disabled={save.isPending}
            placeholder={translate("course:weeks.overviewPlaceholder")}
          />
        </label>
        <TeachingError error={save.error} />
        {notice ? (
          <p role="status" className={styles.notice}>
            {translate(notice)}
          </p>
        ) : null}
        <footer className={styles.formActions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={save.isPending}
            onClick={onClose}
          >
            {translate("common:actions.close")}</button>
          <button
            className={styles.primary}
            disabled={
              !title.trim() || !changed || save.isPending || Boolean(notice)
            }
          >
            {save.isPending ? translate("common:actions.saving") : week ? translate("course:weeks.save") : translate("course:weeks.create")}
          </button>
        </footer>
      </form>
    </TeachingDialog>
  );
}
