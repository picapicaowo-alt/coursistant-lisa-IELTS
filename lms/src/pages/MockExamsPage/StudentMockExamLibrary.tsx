import {Link} from 'react-router-dom'
import {Headphones, PenLine, BookOpenText, ArrowUpRight, Clock3} from 'lucide-react'
import {RecordSummaryList} from '@/components/RecordSummaryList'
import {isRecord} from '@/pages/MockExamSessionPage/runner/api/runtimeData'
import styles from './index.module.scss'

type Section = 'listening' | 'reading' | 'writing'

type StudentExamSummary = {
  id: number
  title: string
  label: string
  status: string
  assignedAt: string | null
  sections: Section[]
}

const SECTION_META = {
  listening: {label: 'Listening', detail: 'Audio-led paper', Icon: Headphones},
  reading: {label: 'Reading', detail: 'Passages and questions', Icon: BookOpenText},
  writing: {label: 'Writing', detail: 'Timed task editor', Icon: PenLine},
} satisfies Record<Section, {label: string; detail: string; Icon: typeof Headphones}>

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function listItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return []
  for (const key of ['content', 'items', 'exams', 'mockExams', 'records']) {
    const candidate = value[key]
    if (Array.isArray(candidate)) return candidate
  }
  return []
}

function nestedString(record: Record<string, unknown>, key: string): string | null {
  const direct = asString(record[key])
  if (direct) return direct
  const template = isRecord(record.template) ? record.template : null
  return template ? asString(template[key]) : null
}

function includesSection(record: Record<string, unknown>, section: Section): boolean {
  const titleCase = `${section[0].toUpperCase()}${section.slice(1)}`
  return record[`${section}Selected`] === true
    || record[`has${titleCase}`] === true
    || record[section] !== undefined && record[section] !== null
}

function normalizeStudentExams(value: unknown): StudentExamSummary[] {
  return listItems(value).flatMap((item) => {
    if (!isRecord(item)) return []
    const idValue = item.studentMockExamId ?? item.id
    if (typeof idValue !== 'number' || !Number.isFinite(idValue) || idValue <= 0) return []
    const sections = (['listening', 'reading', 'writing'] as const)
      .filter((section) => includesSection(item, section))
    return [{
      id: idValue,
      title: nestedString(item, 'title') ?? `Mock exam ${idValue}`,
      label: nestedString(item, 'label') ?? 'IELTS Academic',
      status: asString(item.status) ?? 'Assigned',
      assignedAt: asString(item.assignedAt) ?? asString(item.createdAt),
      sections,
    }]
  })
}

function dateLabel(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', year: 'numeric'}).format(date)
}

export function StudentMockExamLibrary({value}: {value: unknown}) {
  const exams = normalizeStudentExams(value)

  if (exams.length === 0) {
    return (
      <section className={styles.emptyState}>
        <span className={styles.emptyMonogram} aria-hidden="true">M</span>
        <h2>No assigned papers yet</h2>
        <p>Your advisor’s published mock exams will appear here.</p>
        {listItems(value).length > 0 ? (
          <details className={styles.contractFallback}>
            <summary>View unformatted contract data</summary>
            <RecordSummaryList value={value} emptyMessage="No mock exam records are available." />
          </details>
        ) : null}
      </section>
    )
  }

  return (
    <section className={styles.library} aria-label="Assigned mock exams">
      {exams.map((exam, examIndex) => (
        <article className={styles.examCard} key={exam.id}>
          <header className={styles.examHeader}>
            <div className={styles.examIndex} aria-hidden="true">
              {String(examIndex + 1).padStart(2, '0')}
            </div>
            <div>
              <p className={styles.examLabel}>{exam.label}</p>
              <h2>{exam.title}</h2>
            </div>
            <span className={styles.statusPill}>{exam.status}</span>
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
                  <Link className={styles.sectionLink} to={`/mock-exams/${exam.id}/${section}`} key={section}>
                    <span className={styles.sectionIcon}><Icon size={19} aria-hidden="true" /></span>
                    <span>
                      <strong>{label}</strong>
                      <small>{detail}</small>
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
  )
}
