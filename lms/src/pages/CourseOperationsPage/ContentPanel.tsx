import { LocalizedError } from "@/i18n/errors";
import { useTranslation } from "react-i18next";
import { teachingLabel } from "@/components/TeachingWorkspace/presentation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Search } from "lucide-react";
import { unwrapData, type CourseMaterial, type CourseWeek } from "@/apis";
import { courseApiService } from "@/apis/services/course-api";
import { courseOperationsApiService as api } from "@/apis/services/course-operations-api";
import { assignmentApiService } from "@/apis/services/assignment-api";
import {
  TeachingBadge,
  TeachingDialog,
  TeachingError,
  TeachingPagination,
  TeachingState,
} from "@/components/TeachingWorkspace";
import { RecordSummaryList } from "@/components/RecordSummaryList";
import { useIdempotencyCheckpoint } from "@/hooks/useIdempotencyCheckpoint";
import {
  openPreviewWindow,
  saveBlob,
  showBlobInPreviewWindow,
} from "@/utils/downloadBlob";
import { useCourseWeeks } from "./useCourseRecords";
import {
  dateLabel,
  PAGE_SIZE,
  record,
  recordId,
  recordPage,
  optionalNumber,
  textValue,
} from "./records";
import s from "@/components/TeachingWorkspace/index.module.scss";

type MaterialRow = { material: CourseMaterial; week: CourseWeek };
export function ContentPanel({ courseId }: { courseId: number }) {
  const { t: translate } = useTranslation();
  const weeks = useCourseWeeks(courseId);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MaterialRow | "attach">();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const materials: MaterialRow[] = (weeks.data ?? []).flatMap((week) =>
    (week.materials ?? []).map((material) => ({ material, week })),
  );
  // A secondary lecture can repeat the same material; its immutable weekId identifies the origin.
  const unique = [
    ...new Map(
      materials.map((item) => [
        item.material.id,
        {
          material: item.material,
          week:
            weeks.data?.find((week) => week.id === item.material.weekId) ??
            item.week,
        },
      ]),
    ).values(),
  ];
  const filtered = unique.filter((item) =>
    `${item.material.displayName} ${item.week.title}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const open = async ({ material, week }: MaterialRow, preview: boolean) => {
    const popup = preview ? openPreviewWindow() : null;
    setError(undefined);
    setBusy(true);
    try {
      if (preview) {
        if (!popup)
          throw new LocalizedError("operations:errors.materialPopups");
        showBlobInPreviewWindow(
          popup,
          await courseApiService.previewMaterial(
            courseId,
            material.weekId ?? week.id,
            material.id,
          ),
        );
      } else
        saveBlob(
          await courseApiService.downloadMaterial(
            courseId,
            material.weekId ?? week.id,
            material.id,
          ),
          material.originalFilename || material.displayName,
        );
    } catch (caught) {
      popup?.close();
      setError(caught);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className={s.panel}
      aria-label={translate("operations:courseMaterials")}
    >
      <div className={s.toolbar}>
        <label className={s.search}>
          <Search size={18} aria-hidden="true" />
          <input
            aria-label={translate("operations:searchMaterials")}
            placeholder={translate("operations:searchMaterialsPlaceholder")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <button
          type="button"
          className={s.primary}
          onClick={() => setSelected("attach")}
        >
          <Plus size={18} />
          {translate("operations:attachMaterial")}
        </button>
      </div>
      <TeachingError error={error} />
      {weeks.isPending || weeks.isError || !filtered.length ? (
        <TeachingState
          loading={weeks.isPending}
          error={weeks.error}
          empty={
            search
              ? translate("operations:noMatchingMaterials")
              : translate("operations:noMaterials")
          }
          onRetry={() => void weeks.refetch()}
        />
      ) : (
        <div className={s.tableWrap}>
          <table className={`${s.table} ${s.responsive}`}>
            <thead>
              <tr>
                <th>{translate("operations:dateAdded")}</th>
                <th>{translate("operations:materialTitle")}</th>
                <th>{translate("common:fields.type")}</th>
                <th>{translate("operations:linkedContext")}</th>
                <th>{translate("common:fields.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.material.id}>
                  <td data-label={translate("operations:dateAdded")}>
                    <span className={s.muted}>
                      {dateLabel(item.material.createdAt)}
                    </span>
                  </td>
                  <td data-label={translate("operations:material")}>
                    <strong>{item.material.displayName}</strong>
                  </td>
                  <td data-label={translate("common:fields.type")}>
                    <TeachingBadge>
                      {teachingLabel(
                        item.material.teachingType ||
                          item.material.materialType,
                      )}
                    </TeachingBadge>
                  </td>
                  <td data-label={translate("operations:linkedContext")}>
                    <span className={s.muted}>
                      {item.week.title}
                      <small className={s.subline}>
                        {translate("operations:originLecture")}
                      </small>
                    </span>
                  </td>
                  <td data-label={translate("common:fields.actions")}>
                    <div className={s.recordActions}>
                      {item.material.previewAvailable ? (
                        <button
                          type="button"
                          className={s.textButton}
                          disabled={busy}
                          onClick={() => void open(item, true)}
                        >
                          {translate("common:actions.view")}
                        </button>
                      ) : null}
                      {item.material.materialType === "LINK" &&
                      item.material.linkUrl &&
                      /^https?:\/\//i.test(item.material.linkUrl) ? (
                        <a
                          className={s.textButton}
                          href={item.material.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {translate("operations:openLink")}
                        </a>
                      ) : item.material.materialType !== "LINK" ? (
                        <button
                          type="button"
                          className={s.iconButton}
                          aria-label={translate(
                            "course:materials.downloadNamed",
                            { name: item.material.displayName },
                          )}
                          disabled={busy}
                          onClick={() => void open(item, false)}
                        >
                          <Download size={17} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={s.textButton}
                        onClick={() => setSelected(item)}
                      >
                        {translate("operations:manageLinks")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TeachingPagination
        page={page}
        size={PAGE_SIZE}
        total={filtered.length}
        count={visible.length}
        onChange={setPage}
        label={translate("operations:materials")}
      />
      {selected ? (
        <MaterialLinks
          courseId={courseId}
          rows={unique}
          initial={selected === "attach" ? undefined : selected}
          weeks={weeks.data ?? []}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </section>
  );
}

function MaterialLinks({
  courseId,
  rows,
  initial,
  weeks,
  onClose,
}: {
  courseId: number;
  rows: MaterialRow[];
  initial?: MaterialRow;
  weeks: CourseWeek[];
  onClose: () => void;
}) {
  const { t: translate } = useTranslation();
  const [materialId, setMaterialId] = useState(initial?.material.id ?? 0);
  const [kind, setKind] = useState<"lecture" | "assignment">("lecture");
  const [targetId, setTargetId] = useState("");
  const [detaching, setDetaching] = useState<{
    kind: "lecture" | "assignment";
    id: number;
    title: string;
  }>();
  const [saved, setSaved] = useState("");
  const client = useQueryClient();
  const checkpoint = useIdempotencyCheckpoint();
  const selected = rows.find((item) => item.material.id === materialId);
  const assignments = useQuery({
    queryKey: ["instructor-course", courseId, "assignment-choices"],
    queryFn: async () =>
      recordPage(
        unwrapData(
          await assignmentApiService.listAssignments(courseId),
          "course assignments",
        ),
      ).items.map((item) => ({
        id: recordId(item, "assignmentId", "id"),
        title: textValue(item, "title"),
      })),
    enabled: kind === "assignment",
    retry: false,
  });
  const links = useQuery({
    queryKey: ["material-links", courseId, materialId],
    queryFn: async () =>
      unwrapData(
        await api.getMaterialLinks(courseId, materialId),
        "material links",
      ),
    enabled: materialId > 0,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (action: "attach" | "detach") => {
      const selection =
        action === "detach" ? detaching : { kind, id: Number(targetId) };
      if (!selection || !selected || !selection.id)
        throw new LocalizedError("operations:errors.selectLink");
      if (
        selection.kind === "lecture" &&
        selection.id === (selected.week.lectureId ?? selected.week.id)
      )
        throw new LocalizedError("operations:errors.permanentOrigin");
      return checkpoint.run(
        `${action}-material-link`,
        { courseId, materialId, kind: selection.kind, targetId: selection.id },
        async (key, value) => {
          // Successful unlink writes have a null payload; only reads require data.
          if (action === "detach")
            return value.kind === "lecture"
              ? api.detachMaterialFromLecture(
                  courseId,
                  materialId,
                  value.targetId,
                  key,
                )
              : api.detachMaterialFromAssignment(
                  courseId,
                  materialId,
                  value.targetId,
                  key,
                );
          const response =
            value.kind === "lecture"
              ? await api.attachMaterialToLecture(
                  courseId,
                  materialId,
                  value.targetId,
                  key,
                )
              : await api.attachMaterialToAssignment(
                  courseId,
                  materialId,
                  value.targetId,
                  key,
                );
          return response;
        },
      );
    },
    onSuccess: async (_value, action) => {
      setSaved(
        action === "detach"
          ? "operations:materialDetached"
          : "operations:materialLinked",
      );
      setDetaching(undefined);
      setTargetId("");
      await client.invalidateQueries({
        queryKey: ["material-links", courseId, materialId],
      });
    },
  });
  // The links endpoint is still generically typed. Only enable detach when an explicit linked-record identity is returned.
  const knownLinks: Array<{
    kind: "lecture" | "assignment";
    id: number;
    title: string;
  }> = [];
  if (
    links.data &&
    !Array.isArray(links.data) &&
    typeof links.data === "object"
  ) {
    const value = record(links.data);
    for (const linkKind of ["lecture", "assignment"] as const) {
      const source = value[`${linkKind}Links`] ?? value[`${linkKind}s`];
      if (!Array.isArray(source)) continue;
      for (const raw of source) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const item = record(raw);
        // A bare id may identify the relationship rather than its target.
        const id = optionalNumber(item, `${linkKind}Id`);
        if (
          id &&
          !(
            linkKind === "lecture" &&
            id === (selected?.week.lectureId ?? selected?.week.id)
          )
        )
          knownLinks.push({
            kind: linkKind,
            id,
            title:
              textValue(item, "title") ||
              (linkKind === "lecture"
                ? weeks.find((week) => (week.lectureId ?? week.id) === id)
                    ?.title
                : assignments.data?.find((assignment) => assignment.id === id)
                    ?.title) ||
              `${teachingLabel(linkKind)} ${id}`,
          });
      }
    }
  }
  return (
    <TeachingDialog
      title={translate("operations:materialLinks")}
      description={translate("operations:materialLinksHelp")}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className={s.form}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate("attach");
        }}
      >
        <label className={`${s.field} ${s.full}`}>
          {translate("operations:material")}
          <select
            value={materialId || ""}
            onChange={(event) => {
              setMaterialId(Number(event.target.value));
              setDetaching(undefined);
              setTargetId("");
              setSaved("");
            }}
          >
            <option value="">{translate("operations:chooseMaterial")}</option>
            {rows.map((item) => (
              <option key={item.material.id} value={item.material.id}>
                {item.material.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          {translate("operations:linkTo")}
          <select
            value={kind}
            onChange={(event) => {
              setKind(
                event.target.value === "assignment" ? "assignment" : "lecture",
              );
              setTargetId("");
            }}
          >
            <option value="lecture">{translate("operations:lecture")}</option>
            <option value="assignment">
              {translate("course:assignmentList.badgeFallback")}
            </option>
          </select>
        </label>
        <label className={s.field}>
          {translate("operations:selectTarget", {
            target: teachingLabel(kind),
          })}
          <select
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            <option value="">
              {translate("common:actions.chooseTarget", {
                target: teachingLabel(kind),
              })}
            </option>
            {kind === "lecture"
              ? weeks
                  .filter((item) => item.id !== selected?.week.id)
                  .map((item) => (
                    <option key={item.id} value={item.lectureId ?? item.id}>
                      {item.title}
                    </option>
                  ))
              : assignments.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title ||
                      translate("operations:assignmentNumber", { id: item.id })}
                  </option>
                ))}
          </select>
        </label>
        <div className={s.full}>
          <TeachingError error={assignments.error || mutation.error} />
          {saved ? (
            <p className={s.success} role="status">
              {translate(saved)}
            </p>
          ) : null}
        </div>
        <div className={s.actions}>
          <button
            className={s.primary}
            disabled={!materialId || !targetId || mutation.isPending}
          >
            {translate("operations:attachMaterial")}
          </button>
        </div>
      </form>
      {selected ? (
        <>
          <p className={s.notice}>
            {translate("operations:originRetained", {
              title: selected.week.title,
            })}
          </p>
          {links.isPending || links.isError ? (
            <TeachingState
              loading={links.isPending}
              error={links.error}
              onRetry={() => void links.refetch()}
            />
          ) : knownLinks.length ? (
            <div className={s.recordList}>
              {knownLinks.map((item) => (
                <div className={s.toolbar} key={`${item.kind}-${item.id}`}>
                  <span>
                    {item.title}
                    <small className={s.subline}>
                      {teachingLabel(item.kind)}
                    </small>
                  </span>
                  <button
                    type="button"
                    className={`${s.textButton} ${s.dangerText}`}
                    disabled={mutation.isPending}
                    onClick={() => setDetaching(item)}
                  >
                    {translate("operations:detach")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <RecordSummaryList
              value={links.data}
              emptyMessage={translate("operations:noAdditionalLinks")}
            />
          )}
        </>
      ) : null}
      {detaching ? (
        <section className={s.notice}>
          <p>
            {translate("operations:detachConfirmation", {
              title: detaching.title,
            })}
          </p>
          <div className={s.actions}>
            <button
              type="button"
              className={s.secondary}
              disabled={mutation.isPending}
              onClick={() => setDetaching(undefined)}
            >
              {translate("operations:keepLink")}
            </button>
            <button
              type="button"
              className={s.danger}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("detach")}
            >
              {translate("operations:confirmDetach")}
            </button>
          </div>
        </section>
      ) : null}
    </TeachingDialog>
  );
}
