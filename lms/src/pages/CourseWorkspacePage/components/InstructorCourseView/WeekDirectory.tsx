import { useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import type { CourseWeek } from "@/apis";
import { TeachingBadge } from "@/components/TeachingWorkspace";
import styles from "./index.module.scss";

// One page remains spacious at typical laptop heights; short courses need no paging.
export const WEEK_PAGE_SIZE = 6;
type WeekFilter = "All" | CourseWeek["state"];
export function WeekDirectory({
  weeks,
  activeId,
  onSelect,
  onCreate,
}: {
  weeks: CourseWeek[];
  activeId?: number;
  onSelect: (id: number) => void;
  onCreate?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [state, setState] = useState<WeekFilter>("All");
  const [reverse, setReverse] = useState(false);
  const [pagination, setPagination] = useState(() => ({
    page: Math.max(
      0,
      Math.floor(
        weeks.findIndex((week) => week.id === activeId) / WEEK_PAGE_SIZE,
      ),
    ),
    activeId,
  }));
  const setPage = (page: number) => setPagination({ page, activeId });
  const filtered = weeks.filter(
    (week) =>
      (state === "All" || week.state === state) &&
      week.title
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const ordered = reverse ? [...filtered].reverse() : filtered;
  // Follow a newly selected or created week without resetting manual page browsing.
  const page =
    pagination.activeId === activeId
      ? pagination.page
      : Math.max(
          0,
          Math.floor(
            ordered.findIndex((week) => week.id === activeId) / WEEK_PAGE_SIZE,
          ),
        );
  const pageCount = Math.max(1, Math.ceil(ordered.length / WEEK_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = ordered.slice(
    currentPage * WEEK_PAGE_SIZE,
    (currentPage + 1) * WEEK_PAGE_SIZE,
  );
  const selectedOutsideFilter = weeks.find(
    (week) =>
      week.id === activeId && !ordered.some((item) => item.id === activeId),
  );
  return (
    <section className={styles.directory} aria-label="Course weeks">
      <header className={styles.directoryHeader}>
        <h2>Course content</h2>
        {onCreate ? (
          <button
            type="button"
            className={styles.textButton}
            onClick={onCreate}
          >
            <Plus size={17} />
            Add week
          </button>
        ) : null}
      </header>
      <button
        type="button"
        className={styles.mobileFilterToggle}
        aria-expanded={showFilters}
        onClick={() => setShowFilters(!showFilters)}
      >
        <Search size={16} />
        Search & filter
      </button>
      <div
        className={`${styles.filters} ${showFilters ? styles.filtersExpanded : ""}`}
      >
        <label className={styles.search}>
          <Search size={17} />
          <input
            type="search"
            aria-label="Search weeks"
            placeholder="Search weeks"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <div className={styles.filterRow}>
          <label>
            Status
            <select
              aria-label="Status"
              value={state}
              onChange={(event) => {
                setState(event.target.value as WeekFilter);
                setPage(0);
              }}
            >
              <option value="All">All statuses</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
            </select>
          </label>
          <label>
            Sort by
            <select
              aria-label="Sort by"
              value={reverse ? "reverse" : "order"}
              onChange={(event) => {
                setReverse(event.target.value === "reverse");
                setPage(0);
              }}
            >
              <option value="order">Week order</option>
              <option value="reverse">Reverse order</option>
            </select>
          </label>
        </div>
      </div>
      <div className={styles.mobilePicker}>
        <label>
          Selected week
          <select
            value={activeId ?? ""}
            onChange={(event) => onSelect(Number(event.target.value))}
          >
            <option value="" disabled>
              Select a week
            </option>
            {selectedOutsideFilter ? (
              <option value={selectedOutsideFilter.id}>
                {selectedOutsideFilter.title} (selected)
              </option>
            ) : null}
            {ordered.map((week, index) => (
              <option key={week.id} value={week.id}>
                {week.title || `Week ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {visible.length ? (
        <ul className={styles.weekRows}>
          {visible.map((week) => (
            <li key={week.id}>
              <button
                type="button"
                aria-pressed={week.id === activeId}
                onClick={() => onSelect(week.id)}
                className={styles.weekRow}
              >
                <span className={styles.selection} aria-hidden="true" />
                <span className={styles.weekIcon}>
                  <BookOpen size={18} />
                </span>
                <span className={styles.weekIdentity}>
                  <strong>{week.title}</strong>
                  <span>
                    Week {weeks.findIndex((item) => item.id === week.id) + 1} ·{" "}
                    {week.materials.length}{" "}
                    {week.materials.length === 1 ? "material" : "materials"}
                  </span>
                </span>
                <TeachingBadge value={week.state}>{week.state}</TeachingBadge>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <BookOpen size={24} />
          <p>
            {weeks.length
              ? "No weeks match these filters."
              : "Build your course one week at a time."}
          </p>
          {weeks.length ? (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                setSearch("");
                setState("All");
                setPage(0);
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      )}
      <footer className={styles.directoryFooter}>
        <span>
          {ordered.length
            ? `${currentPage * WEEK_PAGE_SIZE + 1}–${Math.min((currentPage + 1) * WEEK_PAGE_SIZE, ordered.length)} of ${ordered.length} weeks`
            : "0 weeks"}
        </span>
        {pageCount > 1 ? (
          <nav aria-label="Week pages">
            <button
              type="button"
              aria-label="Previous weeks"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {currentPage + 1} / {pageCount}
            </span>
            <button
              type="button"
              aria-label="Next weeks"
              disabled={currentPage === pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </nav>
        ) : null}
      </footer>
    </section>
  );
}
