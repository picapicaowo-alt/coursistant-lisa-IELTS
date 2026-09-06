import {useTranslation} from 'react-i18next';
import {statusLabel} from '@/i18n/presentation';
import {useEffect} from 'react'
import {useQuery} from '@tanstack/react-query'
import {Navigate, useNavigate, useParams} from 'react-router-dom'
import {unwrapData, type StudentMockExamDetail} from '@/apis'
import {mockExamApiService} from '@/apis/services/mock-exam-api'
import {useRequiredAuth} from '@/contexts/RequiredAuthContext'
import {advisingErrorMessage} from '@/pages/advising/advisingErrors'
import {mapListeningDetail} from './runner/api/mapListening'
import {mapReadingDetail} from './runner/api/mapReading'
import {
  parseListeningDetail,
  parseReadingDetail,
  parseWritingDetail,
  readExamTitle,
} from './runner/api/runtimeData'
import {rememberWritingTaskImageUrl} from './runner/api/writings'
import type {ListeningPaper} from './runner/data/listening/types'
import type {ReadingTest} from './runner/data/reading'
import type {ApiWritingDetail} from './runner/api/types'
import {ExamPage} from './runner/pages/ExamPage'
import {ListeningExamPage} from './runner/pages/ListeningExamPage'
import {WritingExamPage} from './runner/pages/WritingExamPage'
import styles from './runner.module.scss'
import {SubmittedExamSection} from './SubmittedExamSection'
import {isSectionSubmitted, type MockExamSection} from './submissionState'

type LoadedSession =
  | {section: 'submitted'; exam: StudentMockExamDetail; submittedSection: MockExamSection; objectUrls: string[]}
  | {section: 'reading'; title: string; reading: ReadingTest; objectUrls: string[]}
  | {section: 'listening'; title: string; paper: ListeningPaper; objectUrls: string[]}
  | {section: 'writing'; title: string; writing: ApiWritingDetail; objectUrls: string[]}

function isMockExamSection(value: string | undefined): value is MockExamSection {
  return value === 'listening' || value === 'reading' || value === 'writing'
}

async function loadSession(studentMockExamId: number, section: MockExamSection, signal: AbortSignal): Promise<LoadedSession> {
  const examResponse = await mockExamApiService.getStudentExam(studentMockExamId)
  signal.throwIfAborted()
  const exam = unwrapData(examResponse, 'getStudentMockExam')
  if (isSectionSubmitted(exam, section)) return {section: 'submitted', exam, submittedSection: section, objectUrls: []}
  const sectionResponse = await mockExamApiService.getStudentSection(studentMockExamId, section)
  signal.throwIfAborted()
  const sectionPayload = unwrapData(sectionResponse, `getStudentMockExam${section}`)
  const title = readExamTitle(exam, '')

  if (section === 'reading') {
    const detail = parseReadingDetail(sectionPayload, studentMockExamId)
    const reading = mapReadingDetail(detail)
    const objectUrls: string[] = []
    const images = await Promise.all(reading.passages.flatMap((passage, passageIndex) =>
      passage.sections.flatMap((questionSection, questionIndex) => {
        if (questionSection.kind !== 'diagram') return []
        const source = detail.passages[passageIndex]
        return [mockExamApiService.getStudentReadingImage(
          studentMockExamId,
          source.seq,
          source.questions[questionIndex].sortOrder ?? questionIndex + 1,
        ).then(blob => ({blob, questionSection}))]
      }),
    ))
    // Allocate URLs only after every read succeeds and the route still owns the
    // result. A failed or abandoned load has no mounted effect to clean them up.
    signal.throwIfAborted()
    for (const {blob, questionSection} of images) {
      const url = URL.createObjectURL(blob)
      objectUrls.push(url)
      questionSection.imageSrc = url
    }
    return {section, title, reading, objectUrls}
  }

  if (section === 'listening') {
    const detail = parseListeningDetail(sectionPayload, studentMockExamId)
    const paper = mapListeningDetail(detail)
    const blobs = await Promise.all(detail.parts.map((part, index) =>
      mockExamApiService.getStudentListeningAudio(studentMockExamId, part.seq || index + 1),
    ))
    signal.throwIfAborted()
    const objectUrls = blobs.map(blob => URL.createObjectURL(blob))
    paper.parts.forEach((part, index) => {
      part.audioSrc = objectUrls[index]
    })
    return {section, title, paper, objectUrls}
  }

  const writing = parseWritingDetail(sectionPayload, studentMockExamId)
  const objectUrls: string[] = []
  const images = await Promise.all(writing.tasks.filter(task => task.hasImage).map(async (task) => {
    const blob = await mockExamApiService.getStudentWritingImage(studentMockExamId, task.seq)
    return {task, blob}
  }))
  signal.throwIfAborted()
  for (const {task, blob} of images) {
    const url = URL.createObjectURL(blob)
    objectUrls.push(url)
    rememberWritingTaskImageUrl(writing.id, task.seq, url)
  }
  return {section, title, writing, objectUrls}
}

const MockExamSessionPage = () => {
  const {t: translate} = useTranslation();
  const {studentMockExamId: idParam, section: sectionParam} = useParams<{
    studentMockExamId: string
    section: string
  }>()
  const navigate = useNavigate()
  const {user} = useRequiredAuth()
  const studentMockExamId = Number(idParam)
  const section = isMockExamSection(sectionParam) ? sectionParam : null

  const session = useQuery({
    queryKey: ['mock-exam-session', studentMockExamId, section],
    enabled: Number.isFinite(studentMockExamId) && studentMockExamId > 0 && section !== null,
    retry: false,
    gcTime: 0,
    // The runner owns unsent answers, its clock and media. Background query
    // refreshes must not replace that active session or unmount it on failure.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({signal}) => loadSession(studentMockExamId, section as MockExamSection, signal),
  })

  useEffect(() => () => {
    session.data?.objectUrls.forEach((url) => URL.revokeObjectURL(url))
  }, [session.data])

  if (!Number.isFinite(studentMockExamId) || studentMockExamId <= 0 || section === null) {
    return <Navigate to="/mock-exams" replace />
  }

  if (session.isPending) {
    return (
      <main className={styles.statusPage} role="status">
        <span className={styles.statusMark} aria-hidden="true">M</span>
        <h1>{translate('exams:session.preparing', {section: statusLabel(section)})}</h1>
        <p>{translate("exams:session.loadingMedia")}</p>
      </main>
    )
  }

  if (session.isError || !session.data) {
    return (
      <main className={styles.statusPage}>
        <span className={styles.statusMark} aria-hidden="true">!</span>
        <h1>{translate("exams:session.openError")}</h1>
        <p role="alert">{advisingErrorMessage(session.error, translate('exams:session.unavailable'))}</p>
        <div className={styles.statusActions}>
          <button type="button" onClick={() => session.refetch()}>{translate("common:actions.tryAgain")}</button>
          <button type="button" onClick={() => navigate('/mock-exams')}>{translate("exams:session.back")}</button>
        </div>
      </main>
    )
  }

  const candidateLabel = user.name || user.email || translate('exams:session.candidate')
  const onExit = () => navigate('/mock-exams')

  if (session.data.section === 'submitted') {
    return <SubmittedExamSection exam={session.data.exam} section={session.data.submittedSection} onExit={onExit}/>
  }

  return (
    <div className={styles.root} key={`${studentMockExamId}:${section}`}>
      {session.data.section === 'reading' ? (
        <ExamPage
          reading={session.data.reading}
          testId={studentMockExamId}
          testTitle={session.data.title || translate('exams:untitled', {id: studentMockExamId})}
          candidateLabel={candidateLabel}
          onExit={onExit}
        />
      ) : null}
      {session.data.section === 'listening' ? (
        <ListeningExamPage
          paper={session.data.paper}
          testId={studentMockExamId}
          testTitle={session.data.title || translate('exams:untitled', {id: studentMockExamId})}
          candidateLabel={candidateLabel}
          onExit={onExit}
        />
      ) : null}
      {session.data.section === 'writing' ? (
        <WritingExamPage
          writing={session.data.writing}
          testId={studentMockExamId}
          testTitle={session.data.title || translate('exams:untitled', {id: studentMockExamId})}
          candidateLabel={candidateLabel}
          onExit={onExit}
        />
      ) : null}
    </div>
  )
}

export default MockExamSessionPage
