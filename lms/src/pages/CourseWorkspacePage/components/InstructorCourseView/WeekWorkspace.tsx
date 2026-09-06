import {useCourseAccess} from '@/hooks/useCourseAccess';
import {useTranslation} from 'react-i18next';
import {LocalizedError} from '@/i18n/errors';
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { generatePath, Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Settings2,
  Trash2,
} from "lucide-react";
import { unwrapData, type CourseWeek } from "@/apis";
import { courseApiService as api } from "@/apis/services/course-api";
import {
  TeachingBadge,
  TeachingDialog,
  TeachingError,
} from "@/components/TeachingWorkspace";
import { APP_ROUTE_PATHS as routes } from "@/configs/routePaths";
import { ContentCard } from "../CourseDetailView/ContentCard";
import { WeekContentCard } from "../CourseEditView/WeekContentCard";
import { WeekDirectory } from "./WeekDirectory";
import { WeekEditor } from "./WeekEditor";
import styles from "./index.module.scss";

type WeekAction = "publish" | "unpublish" | "up" | "down" | "delete";
export function WeekWorkspace({
  courseId,
  weeks,
  selectedId,
  onSelect,
  onOpenMaterial,
  canEdit,
  canUpload,
  currentUserId,
}: {
  courseId: number;
  weeks: CourseWeek[];
  selectedId?: number;
  onSelect: (id: number) => void;
  onOpenMaterial: (id: number) => void;
  canEdit: boolean;
  canUpload: boolean;
  currentUserId: number;
}) {
  const {t: translate} = useTranslation();
  const [editor, setEditor] = useState<CourseWeek | "new" | null>(null);
  const client = useQueryClient();
  const ordered = [...weeks].sort(
    (a, b) => (a.orderPosition ?? 0) - (b.orderPosition ?? 0),
  );
  const week = ordered.find((item) => item.id === selectedId) ?? ordered[0];
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["course-weeks", courseId] });
    void client.invalidateQueries({ queryKey: ["course-week", courseId] });
  };
  return (
    <div className={styles.weekWorkspace}>
      <WeekDirectory
        weeks={ordered}
        activeId={week?.id}
        onSelect={onSelect}
        onCreate={canEdit ? () => setEditor("new") : undefined}
      />
      {week ? (
        <SelectedWeek
          key={week.id}
          courseId={courseId}
          week={week}
          weeks={ordered}
          onEdit={setEditor}
          onChanged={refresh}
          onOpenMaterial={onOpenMaterial}
          canEdit={canEdit}
          canUpload={canUpload}
          currentUserId={currentUserId}
        />
      ) : (
        <section className={styles.detail} aria-label={translate("course:weeks.selected")}>
          <div className={styles.empty}>
            <BookOpen size={28} />
            <h2>{translate("course:weeks.start")}</h2>
            <p>
              {canEdit
                ? translate("course:weeks.startHelp")
                : translate("course:weeks.awaitContent")}
            </p>
          </div>
        </section>
      )}
      {editor ? (
        <WeekEditor
          courseId={courseId}
          week={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setEditor(null);
            refresh();
            onSelect(id);
          }}
        />
      ) : null}
    </div>
  );
}

function SelectedWeek({
  courseId,
  week,
  weeks,
  onEdit,
  onChanged,
  onOpenMaterial,
  canEdit,
  canUpload,
  currentUserId,
}: {
  courseId: number;
  week: CourseWeek;
  weeks: CourseWeek[];
  onEdit: (week: CourseWeek) => void;
  onChanged: () => void;
  onOpenMaterial: (id: number) => void;
  canEdit: boolean;
  canUpload: boolean;
  currentUserId: number;
}) {
  const {t: translate} = useTranslation();
  const [manage, setManage] = useState(false);
  const materialAccess = useCourseAccess(courseId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const overview = useQuery({
    queryKey: ["course-week", courseId, week.id],
    enabled: week.summary === undefined,
    queryFn: async () => {
      const result = unwrapData(
        await api.getCourseWeek(courseId, week.id),
        "get week",
      );
      if (result?.id !== week.id)
        throw new LocalizedError("course:weeks.overviewFailed");
      return result;
    },
    staleTime: 60_000,
    retry: false,
  });
  // Some list projections omit overview text even when the week detail exposes it.
  const summary =
    week.summary !== undefined ? week.summary : overview.data?.summary;
  const editWeek = () => onEdit({ ...week, summary });
  const index = weeks.findIndex((item) => item.id === week.id);
  const action = useMutation({
    mutationFn: (value: WeekAction) => {
      if (value === "publish")
        return api.publishWeek(courseId, week.id).then(() => undefined);
      if (value === "unpublish")
        return api.unpublishWeek(courseId, week.id).then(() => undefined);
      if (value === "delete")
        return api.deleteWeek(courseId, week.id).then(() => undefined);
      // The reorder contract requires every week ID, including other directory pages.
      const ids = weeks.map((item) => item.id);
      const target = index + (value === "up" ? -1 : 1);
      if (target < 0 || target >= ids.length)
        throw new LocalizedError("course:weeks.listEnd");
      [ids[index], ids[target]] = [ids[target], ids[index]];
      return api.reorderWeeks(courseId, ids).then(() => undefined);
    },
    onSuccess: () => {
      setConfirmDelete(false);
      onChanged();
    },
  });
  return (
    <section
      className={styles.detail}
      aria-label={translate("course:weeks.selected")}
      aria-busy={action.isPending}
    >
      <header className={styles.detailHeader}>
        <div>
          <h2>{week.title}</h2>
          <div className={styles.weekMeta}>
            <TeachingBadge value={week.state}>{week.state}</TeachingBadge>
            <span>{translate("calendar:views.week")}{' '}{index + 1}</span>
          </div>
        </div>
        {canEdit ? (
          <details
            className={styles.menu}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                event.currentTarget.open = false;
            }}
          >
            <summary aria-label={translate("course:weeks.actions")}>
              <MoreHorizontal size={21} />
            </summary>
            <div
              className={styles.menuItems}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button")) {
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = false;
                }
              }}
            >
              <button
                type="button"
                disabled={action.isPending}
                onClick={editWeek}
              >
                <Pencil size={16} />
                {translate("course:weeks.edit")}</button>
              <button
                type="button"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate(
                    week.state === "Published" ? "unpublish" : "publish",
                  )
                }
              >
                {week.state === "Published" ? (
                  <EyeOff size={16} />
                ) : (
                  <Eye size={16} />
                )}
                {week.state === "Published" ? translate("course:weeks.unpublish") : translate("course:weeks.publish")}
              </button>
              <button
                type="button"
                disabled={index === 0 || action.isPending}
                onClick={() => action.mutate("up")}
              >
                <ArrowUp size={16} />
                {translate("course:weeks.moveUp")}</button>
              <button
                type="button"
                disabled={index === weeks.length - 1 || action.isPending}
                onClick={() => action.mutate("down")}
              >
                <ArrowDown size={16} />
                {translate("course:weeks.moveDown")}</button>
              <button
                type="button"
                disabled={action.isPending}
                onClick={() => setConfirmDelete(true)}
                className={styles.danger}
              >
                <Trash2 size={16} />
                {translate("course:weeks.delete")}</button>
            </div>
          </details>
        ) : null}
      </header>
      {!confirmDelete ? <TeachingError error={action.error} /> : null}
      <div className={styles.overview}>
        <h3>{translate("advising:studentPlan.overview")}</h3>
        {summary ? (
          <p>{summary}</p>
        ) : (
          <p className={styles.muted}>
            {week.summary === undefined && overview.isPending
              ? translate("course:weeks.loadingOverview")
              : summary === undefined
                ? translate("course:weeks.overviewUnavailable")
                : translate("course:weeks.noOverview")}
            {overview.isError ? (
              <button
                type="button"
                className={styles.textButton}
                onClick={() => void overview.refetch()}
              >
                {translate("course:weeks.retryOverview")}</button>
            ) : null}
            {canEdit ? (
              <>
                {" "}
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={editWeek}
                >
                  {translate("course:weeks.addOverview")}</button>
              </>
            ) : null}
          </p>
        )}
      </div>
      <div className={styles.materialSection}>
        {manage ? (
          <>
            <div className={styles.materialToolbar}>
              <h3>{translate("course:materialEditor.manage")}</h3>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => setManage(false)}
              >
                {translate("common:admin.done")}</button>
            </div>
            <WeekContentCard
              key={week.id}
              courseId={courseId}
              week={week}
              weeks={weeks}
              currentUserId={currentUserId}
              canManageExistingMaterials={false}
              canDeleteOwnPublishedMaterials={materialAccess.isTa}
              canUploadMaterials={canUpload}
              onChanged={onChanged}
              compactControls
            />
          </>
        ) : (
          <>
            <ContentCard
              key={week.id}
              week={week}
              onOpenMaterial={onOpenMaterial}
              compact
              label={translate("course:materials.title")}
            />
            {canUpload || canEdit ? (
              <div className={styles.manageRow}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setManage(true)}
                >
                  <Settings2 size={16} />
                  {week.materials.length ? translate("course:materialEditor.manageAction") : translate("course:materialEditor.add")}
                </button>
                {canEdit && week.materials.length ? (
                  <Link
                    className={styles.textButton}
                    to={`${generatePath(routes.courseCourseIdOperations, { courseId: String(courseId) })}?section=content`}
                  >
                    {translate("operations:materialLinks")}</Link>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
      {confirmDelete ? (
        <TeachingDialog
          title={translate("course:weeks.deleteTitle")}
          busy={action.isPending}
          onClose={() => setConfirmDelete(false)}
          description={
            week.materials.length
              ? translate("course:weeks.deleteBlocked")
              : translate('course:weeks.deleteDescription', {title: week.title})
          }
        >
          <TeachingError error={action.error} />
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={action.isPending}
              onClick={() => setConfirmDelete(false)}
            >
              {translate("course:weeks.keep")}</button>
            <button
              type="button"
              className={styles.secondary}
              disabled={week.materials.length > 0 || action.isPending}
              onClick={() => action.mutate("delete")}
            >
              {translate("course:weeks.delete")}</button>
          </div>
        </TeachingDialog>
      ) : null}
    </section>
  );
}
