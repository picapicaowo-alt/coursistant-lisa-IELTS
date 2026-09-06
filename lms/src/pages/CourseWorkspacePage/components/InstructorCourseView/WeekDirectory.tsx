import {formatNumber} from '@/i18n/formatting';
import { useTranslation } from 'react-i18next';
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
  const { t: translate } = useTranslation();
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
    <section className={styles.directory} aria-label={translate("course:weeks.directory")}>
      <header className={styles.directoryHeader}>
        <h2>{translate("course:learning.content")}</h2>
        {onCreate ? (
          <button
            type="button"
            className={styles.textButton}
            onClick={onCreate}
          >
            <Plus size={17} />
            {translate("course:weeks.add")}</button>
        ) : null}
      </header>
      <button
        type="button"
        className={styles.mobileFilterToggle}
        aria-expanded={showFilters}
        onClick={() => setShowFilters(!showFilters)}
      >
        <Search size={16} />
        {translate("course:weeks.searchFilter")}</button>
      <div
        className={`${styles.filters} ${showFilters ? styles.filtersExpanded : ""}`}
      >
        <label className={styles.search}>
          <Search size={17} />
          <input
            type="search"
            aria-label={translate("course:weeks.search")}
            placeholder={translate("course:weeks.search")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <div className={styles.filterRow}>
          <label>
            {translate("common:fields.status")}<select
              aria-label={translate("common:fields.status")}
              value={state}
              onChange={(event) => {
                setState(event.target.value as WeekFilter);
                setPage(0);
              }}
            >
              <option value="All">{translate("common:admin.allStatuses")}</option>
              <option value="Published">{translate("common:status.PUBLISHED")}</option>
              <option value="Draft">{translate("common:status.DRAFT")}</option>
            </select>
          </label>
          <label>
            {translate("course:weeks.sort")}<select
              aria-label={translate("course:weeks.sort")}
              value={reverse ? "reverse" : "order"}
              onChange={(event) => {
                setReverse(event.target.value === "reverse");
                setPage(0);
              }}
            >
              <option value="order">{translate("course:weeks.order")}</option>
              <option value="reverse">{translate("course:weeks.reverse")}</option>
            </select>
          </label>
        </div>
      </div>
      <div className={styles.mobilePicker}>
        <label>
          {translate("course:weeks.selected")}<select
            value={activeId ?? ""}
            onChange={(event) => onSelect(Number(event.target.value))}
          >
            <option value="" disabled>
              {translate("course:weeks.select")}</option>
            {selectedOutsideFilter ? (
              <option value={selectedOutsideFilter.id}>
                {translate('course:weeks.selectedNamed', {name: selectedOutsideFilter.title})}
              </option>
            ) : null}
            {ordered.map((week, index) => (
              <option key={week.id} value={week.id}>
                {week.title || translate('common:records.week', {number: formatNumber(index + 1)})}
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
                    {translate('common:records.week', {number: formatNumber(weeks.findIndex((item) => item.id === week.id) + 1)})} ·{" "}
                    {translate('courseTools:subject.materialCount', {count: week.materials.length, number: formatNumber(week.materials.length)})}
                  </span>
                </span>
                <TeachingBadge value={week.state}/>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <BookOpen size={24} />
          <p>
            {weeks.length
              ? translate("course:weeks.emptyFilter")
              : translate("course:weeks.empty")}
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
              {translate("common:actions.clearFilters")}</button>
          ) : null}
        </div>
      )}
      <footer className={styles.directoryFooter}>
        <span>
          {ordered.length
            ? translate('course:weeks.range', {start: formatNumber(currentPage * WEEK_PAGE_SIZE + 1), end: formatNumber(Math.min((currentPage + 1) * WEEK_PAGE_SIZE, ordered.length)), total: formatNumber(ordered.length)})
            : translate('course:weeks.count', {count: 0, formattedCount: formatNumber(0)})}
        </span>
        {pageCount > 1 ? (
          <nav aria-label={translate("course:weeks.pages")}>
            <button
              type="button"
              aria-label={translate('common:navigationControls.previousWeeks')} title={translate('common:navigationControls.previousWeeks')}
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17}  aria-hidden="true"/>
            </button>
            <span>
              {translate('common:pagination.pageOf', {page: formatNumber(currentPage + 1), total: formatNumber(pageCount)})}
            </span>
            <button
              type="button"
              aria-label={translate('common:navigationControls.nextWeeks')} title={translate('common:navigationControls.nextWeeks')}
              disabled={currentPage === pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17}  aria-hidden="true"/>
            </button>
          </nav>
        ) : null}
      </footer>
    </section>
  );
}
