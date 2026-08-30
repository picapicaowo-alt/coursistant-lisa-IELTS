import {useEffect, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {Archive, BookOpenText, CheckCircle2, Copy, FilePenLine, Headphones, PenLine, Send, Users} from 'lucide-react'
import {unwrapData} from '@/apis'
import {advisorApiService} from '@/apis/services/advisor-api'
import {mockExamApiService} from '@/apis/services/mock-exam-api'
import {RecordSummaryList} from '@/components/RecordSummaryList'
import {advisingErrorMessage} from '../advising/advisingErrors'
import {recordLabel, runtimeItems, runtimeNumber, runtimeString, templateItems, type RuntimeRecord} from './staffRuntime'
import styles from './staff.module.scss'

type Section = 'listening' | 'reading' | 'writing'

const SECTION_META = {
  listening: {label: 'Listening', Icon: Headphones},
  reading: {label: 'Reading', Icon: BookOpenText},
  writing: {label: 'Writing', Icon: PenLine},
} satisfies Record<Section, {label: string; Icon: typeof Headphones}>

function ErrorNotice({error, fallback}: {error: unknown; fallback: string}) {
  return error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, fallback)}</p> : null
}

function Empty({children}: {children: string}) {
  return <p className={styles.empty}>{children}</p>
}

function idFrom(record: RuntimeRecord, ...keys: string[]): number | null {
  return runtimeNumber(record, ...keys, 'id')
}

function TemplateCards({value, selectedId, onSelect}: {value: unknown; selectedId: number | null; onSelect: (id: number) => void}) {
  const templates = templateItems(value)
  if (!templates.length) return <Empty>No mock-exam templates are available.</Empty>
  return (
    <div className={styles.cardList}>
      {templates.map((template) => {
        if (!template.id) return null
        const active = selectedId === template.id
        return (
          <button type="button" className={active ? styles.selectedCard : styles.selectCard} onClick={() => onSelect(template.id as number)} key={template.id}>
            <span className={styles.cardTopline}>{template.label || 'IELTS Academic'}<small>Template {template.id}</small></span>
            <strong>{template.title || `Mock exam ${template.id}`}</strong>
            <span>{template.versions?.length ?? 0} version{template.versions?.length === 1 ? '' : 's'}{template.publishedVersionNo ? ` · v${template.publishedVersionNo} published` : ' · no published version'}</span>
          </button>
        )
      })}
    </div>
  )
}

function TenantSectionComposer({templateId, versionId, onSaved}: {templateId: number; versionId: number; onSaved: () => void}) {
  const [section, setSection] = useState<Section>('listening')
  const [minutes, setMinutes] = useState('40')
  const [title, setTitle] = useState('')
  const [label, setLabel] = useState('')
  const [instruction, setInstruction] = useState('')
  const [kind, setKind] = useState('')
  const [questionStart, setQuestionStart] = useState('1')
  const [questionEnd, setQuestionEnd] = useState('10')
  const [payload, setPayload] = useState('{}')
  const [prompt, setPrompt] = useState('')
  const [minWords, setMinWords] = useState('150')
  const [mediaPath, setMediaPath] = useState('')
  const [validationError, setValidationError] = useState('')

  const save = useMutation({
    mutationFn: async () => {
      const totalMinutes = Number(minutes)
      if (!Number.isInteger(totalMinutes) || totalMinutes <= 0) throw new Error('Enter a valid section duration.')
      if (section === 'writing') {
        return mockExamApiService.createTenantWriting(templateId, versionId, {
          totalMinutes,
          tasks: [{
            seq: 1,
            taskKey: 'task-1',
            title: title.trim(),
            prompt: prompt.trim(),
            minWords: Number(minWords),
            imagePath: mediaPath.trim() || undefined,
          }],
        })
      }
      let parsedPayload: unknown
      try {
        parsedPayload = JSON.parse(payload)
      } catch {
        throw new Error('Question payload must be valid JSON.')
      }
      const question = {
        sortOrder: 1,
        title: title.trim(),
        instruction: instruction.trim(),
        kind: kind.trim(),
        questionStart: Number(questionStart),
        questionEnd: Number(questionEnd),
        payload: parsedPayload,
      }
      if (section === 'listening') {
        return mockExamApiService.createTenantListening(templateId, versionId, {
          totalMinutes,
          parts: [{seq: 1, label: label.trim(), audioPath: mediaPath.trim() || undefined, sections: [question]}],
        })
      }
      return mockExamApiService.createTenantReading(templateId, versionId, {
        totalMinutes,
        passages: [{seq: 1, shortLabel: label.trim(), title: title.trim(), intro: instruction.trim(), paragraphs: [], questions: [question]}],
      })
    },
    onSuccess: () => {
      setValidationError('')
      onSaved()
    },
    onError: (error) => setValidationError(error instanceof Error ? error.message : 'The section could not be saved.'),
  })

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div><p className={styles.eyebrow}>Draft builder</p><h3>Compose exam content</h3></div>
        <span className={styles.contextTag}>Template {templateId} · Version {versionId}</span>
      </div>
      <div className={styles.sectionTabs} role="tablist" aria-label="Mock exam sections">
        {(Object.keys(SECTION_META) as Section[]).map((key) => {
          const {Icon, label: sectionLabel} = SECTION_META[key]
          return <button type="button" role="tab" aria-selected={section === key} className={section === key ? styles.activeTab : ''} onClick={() => setSection(key)} key={key}><Icon size={16}/>{sectionLabel}</button>
        })}
      </div>
      <form className={styles.editorForm} onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
        <label><span>Duration (minutes)</span><input required type="number" min="1" value={minutes} onChange={(event) => setMinutes(event.target.value)}/></label>
        <label><span>{section === 'listening' ? 'Part label' : section === 'reading' ? 'Passage label' : 'Task title'}</span><input required value={section === 'writing' ? title : label} onChange={(event) => section === 'writing' ? setTitle(event.target.value) : setLabel(event.target.value)}/></label>
        {section === 'writing' ? (
          <>
            <label className={styles.full}><span>Candidate prompt</span><textarea required rows={6} value={prompt} onChange={(event) => setPrompt(event.target.value)}/></label>
            <label><span>Minimum words</span><input required type="number" min="0" value={minWords} onChange={(event) => setMinWords(event.target.value)}/></label>
            <label><span>Image path (optional)</span><input value={mediaPath} onChange={(event) => setMediaPath(event.target.value)}/></label>
          </>
        ) : (
          <>
            <label className={styles.full}><span>Question group title</span><input required value={title} onChange={(event) => setTitle(event.target.value)}/></label>
            <label className={styles.full}><span>Candidate instruction</span><textarea rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)}/></label>
            <label><span>Question kind</span><input required value={kind} onChange={(event) => setKind(event.target.value)} placeholder="Contract-defined kind"/></label>
            <label><span>{section === 'listening' ? 'Audio path' : 'Media path (optional)'}</span><input value={mediaPath} onChange={(event) => setMediaPath(event.target.value)}/></label>
            <label><span>First question</span><input required type="number" min="1" value={questionStart} onChange={(event) => setQuestionStart(event.target.value)}/></label>
            <label><span>Last question</span><input required type="number" min="1" value={questionEnd} onChange={(event) => setQuestionEnd(event.target.value)}/></label>
            <label className={styles.full}><span>Contract payload (JSON)</span><textarea className={styles.codeField} rows={5} value={payload} onChange={(event) => setPayload(event.target.value)}/><small>The OpenAPI leaves this JsonNode open; its shape must match the selected backend question kind.</small></label>
          </>
        )}
        <div className={styles.formActions}><button className={styles.primary} disabled={save.isPending}><FilePenLine size={16}/>{save.isPending ? 'Saving…' : `Save ${SECTION_META[section].label}`}</button></div>
      </form>
      {validationError ? <p className={styles.error} role="alert">{validationError}</p> : null}
    </section>
  )
}

export function TenantWorkspace({value}: {value: unknown}) {
  const queryClient = useQueryClient()
  const templates = templateItems(value)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(templates[0]?.id ?? null)
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId) ?? null
  const initialVersion = selectedTemplate?.versions?.find((item) => item.status === 'DRAFT') ?? selectedTemplate?.versions?.[0]
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(initialVersion?.id ?? null)
  const [template, setTemplate] = useState({label: '', title: ''})

  useEffect(() => {
    const versions = templates.find((item) => item.id === selectedTemplateId)?.versions ?? []
    if (!versions.some((item) => item.id === selectedVersionId)) {
      setSelectedVersionId((versions.find((item) => item.status === 'DRAFT') ?? versions[0])?.id ?? null)
    }
  }, [selectedTemplateId, selectedVersionId, templates])

  const selectedVersion = selectedTemplate?.versions?.find((item) => item.id === selectedVersionId) ?? null
  const copySourceVersionId = selectedTemplate?.publishedVersionId
    ?? selectedTemplate?.versions?.find((item) => item.id !== selectedVersionId)?.id
    ?? null

  const refresh = async () => queryClient.invalidateQueries({queryKey: ['mock-exams', 'tenant']})
  const create = useMutation({mutationFn: () => mockExamApiService.createTenantTemplate(template), onSuccess: async () => { setTemplate({label: '', title: ''}); await refresh() }})
  const lifecycle = useMutation({
    mutationFn: (action: 'publish' | 'archive' | 'copy') => {
      if (!selectedTemplateId || !selectedVersionId) throw new Error('Select a template version first.')
      if (action === 'publish') return mockExamApiService.publishTenantVersion(selectedTemplateId, selectedVersionId)
      if (action === 'archive') return mockExamApiService.archiveTenantVersion(selectedTemplateId, selectedVersionId)
      if (!copySourceVersionId) throw new Error('This template has no other version to copy from.')
      return mockExamApiService.copyTenantVersion(selectedTemplateId, selectedVersionId, copySourceVersionId)
    },
    onSuccess: refresh,
  })

  return (
    <div className={styles.workspace}>
      <section className={styles.hero}><div><p className={styles.eyebrow}>Tenant assessment studio</p><h1>Build and release IELTS papers</h1><p>Create versioned templates, compose each paper, then publish one immutable version for advisors.</p></div><div className={styles.metric}><strong>{templates.length}</strong><span>templates</span></div></section>
      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Library</p><h2>Template versions</h2></div></div>
          <TemplateCards value={value} selectedId={selectedTemplateId} onSelect={setSelectedTemplateId}/>
          <form className={styles.compactForm} onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
            <h3>New draft template</h3>
            <label><span>Internal label</span><input value={template.label} onChange={(event) => setTemplate((current) => ({...current, label: event.target.value}))}/></label>
            <label><span>Candidate title</span><input required value={template.title} onChange={(event) => setTemplate((current) => ({...current, title: event.target.value}))}/></label>
            <button className={styles.primary} disabled={create.isPending}>Create draft</button>
          </form>
          <ErrorNotice error={create.error} fallback="The template could not be created."/>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Release control</p><h2>{selectedTemplate?.title || 'Select a template'}</h2></div></div>
          {selectedTemplate?.versions?.length ? (
            <>
              <label className={styles.selectLabel}><span>Working version</span><select value={selectedVersionId ?? ''} onChange={(event) => setSelectedVersionId(Number(event.target.value))}>{selectedTemplate.versions.map((version) => <option value={version.id} key={version.id}>v{version.versionNo ?? '—'} · {version.status || 'UNKNOWN'}</option>)}</select></label>
              <div className={styles.versionStatus}>{selectedTemplate.versions.map((version) => <article className={version.id === selectedVersionId ? styles.activeVersion : ''} key={version.id}><strong>v{version.versionNo ?? '—'}</strong><span>{version.status || 'Unknown'}</span><small>{[version.hasListening && 'L', version.hasReading && 'R', version.hasWriting && 'W'].filter(Boolean).join(' · ') || 'No sections'}</small></article>)}</div>
              <div className={styles.actionRow}>
                <button type="button" className={styles.primary} onClick={() => lifecycle.mutate('publish')} disabled={lifecycle.isPending || selectedVersion?.status !== 'DRAFT'}><CheckCircle2 size={16}/>Publish draft</button>
                <button type="button" className={styles.secondary} onClick={() => lifecycle.mutate('copy')} disabled={lifecycle.isPending || selectedVersion?.status !== 'DRAFT' || !copySourceVersionId}><Copy size={16}/>Copy published content</button>
                <button type="button" className={styles.secondary} onClick={() => lifecycle.mutate('archive')} disabled={lifecycle.isPending || selectedVersion?.status !== 'PUBLISHED'}><Archive size={16}/>Archive release</button>
              </div>
            </>
          ) : <Empty>This template does not include a version that can be edited.</Empty>}
          <ErrorNotice error={lifecycle.error} fallback="The version lifecycle action could not be completed."/>
        </section>
      </div>
      {selectedTemplateId && selectedVersionId && selectedVersion?.status === 'DRAFT'
        ? <TenantSectionComposer templateId={selectedTemplateId} versionId={selectedVersionId} onSaved={refresh}/>
        : selectedVersion ? <section className={styles.panel}><Empty>Select a DRAFT version to compose or replace exam sections.</Empty></section> : null}
    </div>
  )
}

export function AdvisorWorkspace({value}: {value: unknown}) {
  const queryClient = useQueryClient()
  const templates = templateItems(value).filter((item) => item.publishedVersionId || item.publishedVersionNo)
  const students = useQuery({queryKey: ['advisor', 'students', 'mock-exam-assignment'], retry: false, queryFn: async () => unwrapData(await advisorApiService.listStudents(), 'advisorStudents')})
  const studentRows = runtimeItems(students.data)
  const [studentId, setStudentId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [instructorId, setInstructorId] = useState('')
  const [sections, setSections] = useState<Record<Section, boolean>>({listening: true, reading: true, writing: true})
  const history = useQuery({
    queryKey: ['mock-exams', 'advisor', 'student', studentId],
    enabled: Number(studentId) > 0,
    retry: false,
    queryFn: async () => unwrapData(await mockExamApiService.listAdvisorStudentExams(Number(studentId)), 'advisorStudentMockExams'),
  })
  const assign = useMutation({
    mutationFn: () => mockExamApiService.createAdvisorStudentExam(Number(studentId), {
      templateId: Number(templateId),
      listeningSelected: sections.listening,
      readingSelected: sections.reading,
      writingSelected: sections.writing,
      writingInstructorUserId: instructorId ? Number(instructorId) : undefined,
    }),
    onSuccess: async () => queryClient.invalidateQueries({queryKey: ['mock-exams', 'advisor', 'student', studentId]}),
  })
  return (
    <div className={styles.workspace}>
      <section className={styles.hero}><div><p className={styles.eyebrow}>Advisor assignment desk</p><h1>Match students to published papers</h1><p>Select from your assigned students, choose the exam sections, and review every prior assignment before creating another.</p></div><div className={styles.metric}><strong>{templates.length}</strong><span>published</span></div></section>
      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Assignment</p><h2>Prepare a mock exam</h2></div><Users size={22}/></div>
          <form className={styles.editorForm} onSubmit={(event) => { event.preventDefault(); assign.mutate() }}>
            <label className={styles.full}><span>Student</span><select required value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Select assigned student</option>{studentRows.map((student) => { const id = idFrom(student, 'studentUserId', 'userId'); return id ? <option value={id} key={id}>{recordLabel(student, `Student ${id}`)} · {runtimeString(student, 'email') || `ID ${id}`}</option> : null })}</select></label>
            <label className={styles.full}><span>Published template</span><select required value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">Select paper</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.title || template.label || `Template ${template.id}`} · v{template.publishedVersionNo ?? 'published'}</option>)}</select></label>
            <fieldset className={styles.full}><legend>Assigned sections</legend><div className={styles.checkGrid}>{(Object.keys(SECTION_META) as Section[]).map((section) => <label key={section}><input type="checkbox" checked={sections[section]} onChange={(event) => setSections((current) => ({...current, [section]: event.target.checked}))}/><span>{SECTION_META[section].label}</span></label>)}</div></fieldset>
            <label className={styles.full}><span>Writing instructor user ID (optional)</span><input inputMode="numeric" value={instructorId} onChange={(event) => setInstructorId(event.target.value)}/><small>The Mock Exam OpenAPI does not expose an instructor directory endpoint.</small></label>
            <div className={styles.formActions}><button className={styles.primary} disabled={assign.isPending || !Object.values(sections).some(Boolean)}><Send size={16}/>{assign.isPending ? 'Assigning…' : 'Assign exam'}</button></div>
          </form>
          <ErrorNotice error={students.error || assign.error} fallback="The assignment could not be completed."/>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Student history</p><h2>Assigned papers</h2></div></div>
          {!studentId ? <Empty>Select a student to review assignment history.</Empty> : history.isPending ? <p className={styles.status}>Loading history…</p> : history.isError ? <ErrorNotice error={history.error} fallback="Assignment history could not be loaded."/> : <RecordSummaryList value={history.data} emptyMessage="This student has no assigned mock exams."/>}
        </section>
      </div>
    </div>
  )
}

export function InstructorWorkspace({value}: {value: unknown}) {
  const queryClient = useQueryClient()
  const rows = runtimeItems(value)
  const [gradeId, setGradeId] = useState<number | null>(() => rows[0] ? idFrom(rows[0], 'gradeId', 'writingGradeId') : null)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const detail = useQuery({queryKey: ['mock-exams', 'instructor', 'grade', gradeId], enabled: Boolean(gradeId), retry: false, queryFn: async () => unwrapData(await mockExamApiService.getInstructorWritingGrade(gradeId as number), 'instructorWritingGrade')})
  const submit = useMutation({mutationFn: () => mockExamApiService.gradeInstructorWriting(gradeId as number, {score: Number(score), feedback: feedback.trim() || undefined}), onSuccess: async () => { setScore(''); setFeedback(''); await queryClient.invalidateQueries({queryKey: ['mock-exams', 'instructor']}); await queryClient.invalidateQueries({queryKey: ['mock-exams', 'instructor', 'grade', gradeId]}) }})
  return (
    <div className={styles.workspace}>
      <section className={styles.hero}><div><p className={styles.eyebrow}>Writing review room</p><h1>Read the script. Return a clear result.</h1><p>Work from the assigned queue, inspect the complete submission, then record a score and candidate-facing feedback.</p></div><div className={styles.metric}><strong>{rows.length}</strong><span>queue items</span></div></section>
      <div className={styles.queueLayout}>
        <section className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Queue</p><h2>Writing submissions</h2></div></div>{rows.length ? <div className={styles.cardList}>{rows.map((row, index) => { const id = idFrom(row, 'gradeId', 'writingGradeId'); return id ? <button type="button" className={gradeId === id ? styles.selectedCard : styles.selectCard} onClick={() => setGradeId(id)} key={id}><span className={styles.cardTopline}>{runtimeString(row, 'status') || 'Awaiting review'}<small>#{id}</small></span><strong>{recordLabel(row, `Writing submission ${index + 1}`)}</strong><span>{runtimeString(row, 'submittedAt', 'createdAt') || 'Submission time unavailable'}</span></button> : null })}</div> : <Empty>No writing submissions are waiting for review.</Empty>}</section>
        <section className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Assessment</p><h2>{gradeId ? `Submission #${gradeId}` : 'Select a submission'}</h2></div></div>{gradeId ? <>{detail.isPending ? <p className={styles.status}>Loading script…</p> : detail.isError ? <ErrorNotice error={detail.error} fallback="The writing script could not be loaded."/> : <div className={styles.script}><RecordSummaryList value={detail.data} emptyMessage="The response contains no readable writing detail."/></div>}<form className={styles.compactForm} onSubmit={(event) => { event.preventDefault(); submit.mutate() }}><label><span>Score</span><input required type="number" step="0.5" min="0" value={score} onChange={(event) => setScore(event.target.value)}/></label><label><span>Feedback</span><textarea required rows={6} value={feedback} onChange={(event) => setFeedback(event.target.value)}/></label><button className={styles.primary} disabled={submit.isPending}>{submit.isPending ? 'Submitting…' : 'Submit result'}</button></form><ErrorNotice error={submit.error} fallback="The writing result could not be submitted."/></> : <Empty>Choose a queue item to begin grading.</Empty>}</section>
      </div>
    </div>
  )
}

export function SystemWorkspace({value}: {value: unknown}) {
  const rows = runtimeItems(value)
  return <div className={styles.workspace}><section className={styles.hero}><div><p className={styles.eyebrow}>System oversight</p><h1>Mock exam operations</h1><p>Cross-tenant read-only visibility for contract verification, lifecycle support, and operational triage.</p></div><div className={styles.metric}><strong>{rows.length}</strong><span>visible records</span></div></section><section className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Cross-tenant index</p><h2>Exam records</h2></div></div><RecordSummaryList value={value} emptyMessage="No system mock-exam records are available."/></section></div>
}
