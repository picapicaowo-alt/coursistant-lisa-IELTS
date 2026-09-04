import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { unwrapData } from "@/apis";
import { courseApiService } from "@/apis/services/course-api";
import { formatPersonName } from "@/utils/personName";
import {
  TeachingPagination,
  TeachingState,
} from "@/components/TeachingWorkspace";
import { PAGE_SIZE } from "./records";
import s from "@/components/TeachingWorkspace/index.module.scss";
import local from "./picker.module.scss";

export interface SelectedStudent {
  id: number;
  name: string;
}
export function CourseStudentPicker({
  courseId,
  selected,
  onSelect,
}: {
  courseId: number;
  selected?: SelectedStudent;
  onSelect: (student?: SelectedStudent) => void;
}) {
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQueryText(search.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const query = useQuery({
    queryKey: ["course-members", courseId, "report-picker", queryText, page],
    queryFn: async () =>
      unwrapData(
        await courseApiService.listCourseMembers(courseId, {
          courseRole: "Student",
          q: queryText || undefined,
          page,
          size: PAGE_SIZE,
        }),
        "course students",
      ),
    enabled: open,
    retry: false,
  });
  return (
    <div
      ref={ref}
      className={local.picker}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <div className={s.search}>
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="Search course students"
          placeholder="Search students…"
          value={open ? search : (selected?.name ?? search)}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
        />
        {selected ? (
          <button
            type="button"
            className={s.iconButton}
            aria-label="Clear student filter"
            onClick={() => {
              onSelect(undefined);
              setSearch("");
            }}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
      {open ? (
        <div
          className={local.options}
          aria-label="Course student search results"
        >
          {query.isPending || query.isError || !query.data?.items.length ? (
            <TeachingState
              loading={query.isPending}
              error={query.error}
              empty="No students match this search."
              onRetry={() => void query.refetch()}
            />
          ) : (
            query.data.items.map((item) => {
              const name = formatPersonName(
                {
                  firstName: item.userFirstName,
                  middleName: item.userMiddleName,
                  lastName: item.userLastName,
                },
                item.userName || `Student #${item.userId}`,
              );
              return (
                <button
                  type="button"
                  key={item.userId}
                  className={local.option}
                  onClick={() => {
                    onSelect({ id: item.userId, name });
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <strong>{name}</strong>
                  {item.userEmail ? <small>{item.userEmail}</small> : null}
                </button>
              );
            })
          )}
          <TeachingPagination
            page={page}
            size={PAGE_SIZE}
            total={query.data?.total}
            count={query.data?.items.length ?? 0}
            loading={query.isFetching}
            onChange={setPage}
            label="Students"
          />
        </div>
      ) : null}
    </div>
  );
}
