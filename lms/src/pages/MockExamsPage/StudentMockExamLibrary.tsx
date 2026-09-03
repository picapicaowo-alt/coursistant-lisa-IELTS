import {useState} from 'react'
import {Link, generatePath} from 'react-router-dom'
import {APP_ROUTE_PATHS} from '@/configs/routePaths'
import {Headphones, PenLine, BookOpenText, ArrowUpRight, Clock3} from 'lucide-react'
import {normalizeStudentExams, listItems, type Section} from '@/utils/mockExamSummary'
import styles from './index.module.scss'

const SECTION_META = {
  listening: {label: 'Listening', detail: 'Audio-led paper', Icon: Headphones},
  reading: {label: 'Reading', detail: 'Passages and questions', Icon: BookOpenText},
  writing: {label: 'Writing', detail: 'Timed task editor', Icon: PenLine},
} satisfies Record<Section, {label: string; detail: string; Icon: typeof Headphones}>

function dateLabel(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', year: 'numeric'}).format(date)
}

export function StudentMockExamLibrary({value, serverStatusFilter = false}: {value: unknown; serverStatusFilter?: boolean}) {
  const exams = normalizeStudentExams(value)
  const [sectionFilter, setSectionFilter] = useState<Section | ''>('')
  const [statusFilter, setStatusFilter] = useState('')
  const statuses = [...new Set(exams.map(exam => exam.status))]
  const filteredExams = exams.filter(exam => (!sectionFilter || exam.sections.includes(sectionFilter)) && (!statusFilter || exam.status === statusFilter))

  if (exams.length === 0) {
    return (
      <section className={styles.emptyState}>
        <span className={styles.emptyMonogram} aria-hidden="true">M</span>
        <h2>No assigned papers yet</h2>
        <p>Your advisor’s published mock exams will appear here.</p>
        {listItems(value).length > 0 ? <p role="alert">Some assigned papers could not be displayed. Refresh the page to try again.</p> : null}
      </section>
    )
  }

  return (
    <>
      <div className={styles.filters} aria-label="Filter exams">
        <button type="button" aria-pressed={!sectionFilter} onClick={() => setSectionFilter('')}>All exams</button>
        {(['reading', 'writing', 'listening'] as const).map(section => <button type="button" key={section} aria-pressed={sectionFilter === section} onClick={() => setSectionFilter(section)}>{SECTION_META[section].label}</button>)}
        {!serverStatusFilter ? <label><select aria-label="Exam status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">All states</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></label> : null}
      </div>
      {filteredExams.length === 0 ? <p role="status">No papers match these filters.</p> : null}
    <section className={styles.library} aria-label="Assigned mock exams">
      {filteredExams.map(exam => (
        <article className={styles.examCard} key={exam.id}>
          <header className={styles.examHeader}>
            <div>
              <p className={styles.examLabel}>{exam.label}</p>
              <h2>{exam.title}</h2>
            </div>
            <span className={styles.statusPill}>{(exam.attemptStatus || exam.status).replace(/_/g, ' ')}</span>
          </header>

          <div className={styles.examMeta}>
            <span><Clock3 size={15} aria-hidden="true" /> Official section timing</span>
            {dateLabel(exam.assignedAt) ? <span>Assigned {dateLabel(exam.assignedAt)}</span> : null}
          </div>

          {exam.sections.length > 0 ? (
            <div className={styles.sectionGrid}>
              {exam.sections.map((section) => {
                const {label, detail, Icon} = SECTION_META[section]
                return (
                  <Link data-section={section} className={styles.sectionLink} to={generatePath(APP_ROUTE_PATHS.mockExamsStudentMockExamIdSection, {studentMockExamId: String(exam.id), section})} key={section}>
                    <span className={styles.sectionIcon}><Icon size={19} aria-hidden="true" /></span>
                    <span>
                      <strong>{label}</strong>
                      <small>{exam.results[section] || detail}</small>
                    </span>
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className={styles.sectionUnavailable}>Section availability is not included in the current response.</p>
          )}
        </article>
      ))}
    </section>
    </>
  )
}
