import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { unwrapData } from "@/apis";
import { mockExamApiService } from "@/apis/services/mock-exam-api";
import { TeachingState } from "@/components/TeachingWorkspace";
import { RecordSummaryList } from "@/components/RecordSummaryList";
import { formatNumber } from "@/i18n/formatting";
import { ExamSectionMedia } from "./StaffMockExamWorkspaces";
import { recordLabel, runtimeItems, runtimeNumber } from "./staffRuntime";
import styles from "./system.module.scss";

const SECTIONS = ["listening", "reading", "writing"] as const;
const PAGE_SIZE = 10;
export function SystemWorkspace({ value }: { value: unknown }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number>();
  const [section, setSection] =
    useState<(typeof SECTIONS)[number]>("listening");
  const rows = runtimeItems(value)
    .flatMap((row) => {
      const id = runtimeNumber(row, "testId", "id");
      return id == null
        ? []
        : [
            {
              id,
              label: recordLabel(row, t("common:admin.examNumber", { id })),
            },
          ];
    })
    .filter((row) =>
      row.label.toLowerCase().includes(search.trim().toLowerCase()),
    );
  const selected = runtimeItems(value).find(
    (row) => runtimeNumber(row, "testId", "id") === selectedId,
  );
  const detail = useQuery({
    queryKey: ["mock-exams", "system-detail", selectedId],
    queryFn: async () =>
      unwrapData(
        await mockExamApiService.getSystemExam(selectedId!),
        "systemMockExam",
      ),
    enabled: selectedId != null,
    retry: false,
  });
  const content = useQuery({
    queryKey: ["mock-exams", "system-section", selectedId, section],
    queryFn: async () =>
      unwrapData(
        await mockExamApiService.getSystemSection(selectedId!, section),
        "systemMockExamSection",
      ),
    enabled: selectedId != null && detail.isSuccess,
    retry: false,
  });
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{t("common:admin.examTitle")}</h1>
        <p>{t("common:admin.examHelp")}</p>
      </header>
      <div className={styles.layout}>
        <section
          className={styles.directory}
          aria-label={t("common:admin.examRecords")}
        >
          <label className={styles.search}>
            <span>{t("common:admin.searchExams")}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <div className={styles.records}>
            {rows.length ? (
              rows
                .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                .map((row) => (
                  <button
                    key={row.id}
                    aria-pressed={selectedId === row.id}
                    onClick={() => {
                      setSelectedId(row.id);
                      setSection("listening");
                    }}
                  >
                    <strong>{row.label}</strong>
                    <span>{t("common:admin.examNumber", { id: row.id })}</span>
                  </button>
                ))
            ) : (
              <TeachingState compact empty={t("common:admin.noExams")} />
            )}
          </div>
          {rows.length > PAGE_SIZE ? (
            <nav
              className={styles.pagination}
              aria-label={t("common:admin.examPages")}
            >
              <button disabled={!page} onClick={() => setPage(page - 1)}>
                {t("common:actions.previous")}
              </button>
              <span>
                {formatNumber(page + 1)} /{" "}
                {formatNumber(Math.ceil(rows.length / PAGE_SIZE))}
              </span>
              <button
                disabled={(page + 1) * PAGE_SIZE >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                {t("common:actions.next")}
              </button>
            </nav>
          ) : null}
        </section>
        <section
          className={styles.content}
          aria-label={t("common:admin.examContent")}
        >
          {selectedId == null ? (
            <TeachingState empty={t("common:admin.selectExam")} />
          ) : (
            <>
              <h2>
                {selected
                  ? recordLabel(
                      selected,
                      t("common:admin.examNumber", { id: selectedId }),
                    )
                  : t("common:admin.examNumber", { id: selectedId })}
              </h2>
              <nav
                className={styles.sectionTabs}
                aria-label={t("common:admin.examSection")}
              >
                {SECTIONS.map((key) => (
                  <button
                    key={key}
                    aria-pressed={section === key}
                    onClick={() => setSection(key)}
                  >
                    {t(`common:admin.examSections.${key}`)}
                  </button>
                ))}
              </nav>
              {detail.isPending || detail.isError ? (
                <TeachingState
                  loading={detail.isPending}
                  error={detail.error}
                  onRetry={() => void detail.refetch()}
                />
              ) : content.isPending || content.isError ? (
                <TeachingState
                  loading={content.isPending}
                  error={content.error}
                  onRetry={() => void content.refetch()}
                />
              ) : (
                <>
                  <RecordSummaryList
                    fieldLabel={(key) =>
                      t(`common:admin.examFields.${key}`, {
                        defaultValue: t("common:admin.examContent"),
                      })
                    }
                    scalar={(value) =>
                      typeof value === "boolean"
                        ? t(value ? "common:admin.yes" : "common:admin.no")
                        : typeof value === "number"
                          ? formatNumber(value)
                          : typeof value === "string"
                            ? value
                            : null
                    }
                    value={content.data}
                    emptyMessage={t("common:admin.noExamContent")}
                  />
                  <ExamSectionMedia
                    key={`${selectedId}-${section}`}
                    scope="system"
                    testId={selectedId}
                    section={section}
                    value={content.data}
                  />
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
