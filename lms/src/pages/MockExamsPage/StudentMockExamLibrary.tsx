import { useTranslation } from 'react-i18next';
import {useState} from 'react'
import {Link, generatePath} from 'react-router-dom'
import {APP_ROUTE_PATHS} from '@/configs/routePaths'
import {Headphones, PenLine, BookOpenText, ArrowUpRight, Clock3} from 'lucide-react'
import {normalizeStudentExams, listItems, type Section} from '@/utils/mockExamSummary'
import {formatDateTime} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import styles from './index.module.scss'

const SECTION_META = {
  listening: {label: 'common:status.LISTENING', detail: 'exams:library.listeningDetail', Icon: Headphones},
  reading: {label: 'common:status.READING', detail: 'exams:library.readingDetail', Icon: BookOpenText},
  writing: {label: 'common:status.WRITING', detail: 'exams:library.writingDetail', Icon: PenLine},
} satisfies Record<Section, {label: string; detail: string; Icon: typeof Headphones}>

function dateLabel(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return formatDateTime(date, {month: 'short', day: 'numeric', year: 'numeric'})
}

export function StudentMockExamLibrary({value}: {value: unknown}) {
  const { t: translate } = useTranslation();
  const exams = normalizeStudentExams(value)
  const [sectionFilter, setSectionFilter] = useState<Section | ''>('')
  const [statusFilter, setStatusFilter] = useState('')
  const statuses = [...new Set(exams.map(exam => exam.status))]
  const filteredExams = exams.filter(exam => (!sectionFilter || exam.sections.includes(sectionFilter)) && (!statusFilter || exam.status === statusFilter))

  if (exams.length === 0) {
    return (
      <section className={styles.emptyState}>
        <span className={styles.emptyMonogram} aria-hidden="true">M</span>
        <h2>{translate('exams:library.empty')}</h2>
        <p>{translate('exams:library.emptyHelp')}</p>
        {listItems(value).length > 0 ? <p role="alert">{translate('exams:library.invalidRecords')}</p> : null}
      </section>
    )
  }

  return (
    <>
      <div className={styles.filters} aria-label={translate('exams:library.filters')}>
        <button type="button" aria-pressed={!sectionFilter} onClick={() => setSectionFilter('')}>{translate('exams:library.all')}</button>
        {(['reading', 'writing', 'listening'] as const).map(section => <button type="button" key={section} aria-pressed={sectionFilter === section} onClick={() => setSectionFilter(section)}>{translate(SECTION_META[section].label)}</button>)}
        <label><select aria-label={translate('exams:library.status')} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">{translate('common:admin.allStatuses')}</option>{statuses.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
      </div>
      {filteredExams.length === 0 ? <p role="status">{translate('exams:library.noMatches')}</p> : null}
    <section className={styles.library} aria-label={translate('exams:assigned')}>
      {filteredExams.map(exam => (
        <article className={styles.examCard} key={exam.id}>
          <header className={styles.examHeader}>
            <div>
              <p className={styles.examLabel}>{exam.label}</p>
              <h2>{exam.title}</h2>
            </div>
            {/* The assignment lifecycle includes grading; an attempt stays submitted after completion. */}
            <span className={styles.statusPill}>{statusLabel(exam.status)}</span>
          </header>

          <div className={styles.examMeta}>
            <span><Clock3 size={15} aria-hidden="true" />{translate('exams:library.timing')}</span>
            {dateLabel(exam.assignedAt) ? <span>{translate('common:records.assignedAt', {date: dateLabel(exam.assignedAt)})}</span> : null}
          </div>

          {exam.sections.length > 0 ? (
            <div className={styles.sectionGrid}>
              {exam.sections.map((section) => {
                const {label, detail, Icon} = SECTION_META[section]
                return (
                  <Link data-section={section} className={styles.sectionLink} to={generatePath(APP_ROUTE_PATHS.mockExamsStudentMockExamIdSection, {studentMockExamId: String(exam.id), section})} key={section}>
                    <span className={styles.sectionIcon}><Icon size={19} aria-hidden="true" /></span>
                    <span>
                      <strong>{translate(label)}</strong>
                      <small>{exam.results[section] || translate(detail)}</small>
                    </span>
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className={styles.sectionUnavailable}>{translate('exams:library.noSections')}</p>
          )}
        </article>
      ))}
    </section>
    </>
  )
}
