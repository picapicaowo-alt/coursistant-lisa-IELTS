import {useEffect, useRef, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {Archive, BookOpenText, CheckCircle2, Copy, Eye, FilePenLine, Headphones, Image as ImageIcon, PenLine, Send, Trash2, Upload, Users} from 'lucide-react'
import {type MockExamMediaKind, unwrapData} from '@/apis'
import {advisorApiService} from '@/apis/services/advisor-api'
import {mockExamApiService} from '@/apis/services/mock-exam-api'
import {RecordSummaryList} from '@/components/RecordSummaryList'
import {advisingErrorMessage} from '../advising/advisingErrors'
import {recordLabel, runtimeItems, runtimeNumber, runtimeString, templateItems, type RuntimeRecord} from './staffRuntime'
import styles from './staff.module.scss'
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint'

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

function nestedRecords(value: unknown, key: string): RuntimeRecord[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const nested = (value as RuntimeRecord)[key]
  return Array.isArray(nested) ? nested.filter((item): item is RuntimeRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []
}

type MediaState = {loading?: boolean; url?: string; error?: string}

function TenantSectionMedia({templateId, versionId, section, value}: {templateId: number; versionId: number; section: Section; value: unknown}) {
  const [media, setMedia] = useState<Record<string, MediaState>>({})
  const objectUrls = useRef(new Set<string>())

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrls.current.clear()
  }, [])

  const loadMedia = async (key: string, request: () => Promise<Blob>) => {
    setMedia((current) => ({...current, [key]: {loading: true}}))
    try {
      const blob = await request()
      const url = URL.createObjectURL(blob)
      objectUrls.current.add(url)
      setMedia((current) => ({...current, [key]: {url}}))
    } catch (error) {
      setMedia((current) => ({...current, [key]: {error: advisingErrorMessage(error, 'The protected media could not be loaded.')}}))
    }
  }

  const items = section === 'listening'
    ? nestedRecords(value, 'parts').map((part, index) => ({
      key: `listening-${runtimeNumber(part, 'seq') ?? index + 1}`,
      label: runtimeString(part, 'label') || `Listening part ${index + 1}`,
      type: 'audio' as const,
      load: () => mockExamApiService.getTenantListeningAudio(templateId, versionId, runtimeNumber(part, 'seq') ?? index + 1),
    }))
    : section === 'reading'
      ? nestedRecords(value, 'passages').flatMap((passage, passageIndex) => {
        const passageSeq = runtimeNumber(passage, 'seq') ?? passageIndex + 1
        return nestedRecords(passage, 'questions').map((question, questionIndex) => {
          const sortOrder = runtimeNumber(question, 'sortOrder') ?? questionIndex + 1
          return {
            key: `reading-${passageSeq}-${sortOrder}`,
            label: runtimeString(question, 'title') || `Passage ${passageSeq}, question group ${sortOrder}`,
            type: 'image' as const,
            load: () => mockExamApiService.getTenantReadingImage(templateId, versionId, passageSeq, sortOrder),
          }
        })
      })
      : nestedRecords(value, 'tasks')
        .filter((task) => task.hasImage === true || Boolean(runtimeString(task, 'imageSrc')))
        .map((task, index) => {
          const taskSeq = runtimeNumber(task, 'seq') ?? index + 1
          return {
            key: `writing-${taskSeq}`,
            label: runtimeString(task, 'title') || `Writing task ${taskSeq}`,
            type: 'image' as const,
            load: () => mockExamApiService.getTenantWritingImage(templateId, versionId, taskSeq),
          }
        })

  if (!items.length) return null

  return <section className={styles.mediaReview} aria-label={`${SECTION_META[section].label} protected media`}>
    <div><h4>Protected media</h4><p>Media is loaded through the authenticated Tenant Mock Exam endpoint only when requested.</p></div>
    <div className={styles.mediaList}>{items.map((item) => {
      const state = media[item.key]
      return <article key={item.key}>
        <div><strong>{item.label}</strong><button type="button" className={styles.secondary} disabled={state?.loading} onClick={() => void loadMedia(item.key, item.load)}>{item.type === 'audio' ? <Headphones size={16}/> : <ImageIcon size={16}/>} {state?.loading ? 'Loading…' : state?.url ? 'Reload media' : item.type === 'audio' ? 'Load audio' : 'Load image'}</button></div>
        {state?.url && item.type === 'audio' ? <audio controls preload="none" src={state.url}>Your browser does not support audio playback.</audio> : null}
        {state?.url && item.type === 'image' ? <img src={state.url} alt={`${item.label} reference`}/> : null}
        {state?.error ? <p role="alert">{state.error}</p> : null}
      </article>
    })}</div>
  </section>
}

const MEDIA_RULES: Record<MockExamMediaKind, {accept: string; label: string; maxBytes: number}> = {
  LISTENING_AUDIO: {accept: '.mp3,.wav,audio/mpeg,audio/wav', label: 'MP3 or WAV · up to 100 MB', maxBytes: 100 * 1024 * 1024},
  READING_IMAGE: {accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp', label: 'PNG, JPG, JPEG, or WEBP · up to 10 MB', maxBytes: 10 * 1024 * 1024},
  WRITING_IMAGE: {accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp', label: 'PNG, JPG, JPEG, or WEBP · up to 10 MB', maxBytes: 10 * 1024 * 1024},
}

function TenantMediaManager({
  templateId,
  versionId,
  kind,
  selectedMediaId,
  onSelect,
  required,
}: {
  templateId: number;
  versionId: number;
  kind: MockExamMediaKind;
  selectedMediaId: number | null;
  onSelect: (mediaId: number | null) => void;
  required?: boolean;
}) {
  const queryClient = useQueryClient()
  const idempotency = useIdempotencyCheckpoint()
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState('')
  const [preview, setPreview] = useState<{mediaId: number; url: string} | null>(null)
  const rule = MEDIA_RULES[kind]
  const mediaQueryKey = ['mock-exams', 'tenant', templateId, versionId, 'media']
  const media = useQuery({
    queryKey: mediaQueryKey,
    queryFn: async () => unwrapData(await mockExamApiService.listTenantMedia(templateId, versionId), 'listTenantMockExamMedia'),
    retry: false,
  })

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url)
  }, [preview])

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first.')
      if (file.size > rule.maxBytes) throw new Error(`This file exceeds the ${Math.round(rule.maxBytes / 1024 / 1024)} MB limit.`)
      const fingerprint = idempotencyFingerprint({kind, name: file.name, size: file.size, lastModified: file.lastModified})
      const key = idempotency.keyFor(`mock-media-${templateId}-${versionId}-${kind}`, fingerprint)
      return unwrapData(await mockExamApiService.uploadTenantMedia(templateId, versionId, kind, file, key), 'uploadTenantMockExamMedia')
    },
    onSuccess: async created => {
      setFile(null)
      setValidationError('')
      onSelect(created.mediaId)
      await queryClient.invalidateQueries({queryKey: mediaQueryKey})
    },
    onError: error => setValidationError(advisingErrorMessage(error, 'The media file could not be uploaded.')),
  })
  const previewMedia = useMutation({
    mutationFn: async (mediaId: number) => ({mediaId, blob: await mockExamApiService.previewTenantMedia(templateId, versionId, mediaId)}),
    onSuccess: result => {
      if (preview) URL.revokeObjectURL(preview.url)
      setPreview({mediaId: result.mediaId, url: URL.createObjectURL(result.blob)})
    },
  })
  const remove = useMutation({
    mutationFn: async (mediaId: number) => {
      await mockExamApiService.deleteTenantMedia(templateId, versionId, mediaId)
      return mediaId
    },
    onSuccess: async mediaId => {
      if (selectedMediaId === mediaId) onSelect(null)
      if (preview?.mediaId === mediaId) {
        URL.revokeObjectURL(preview.url)
        setPreview(null)
      }
      await queryClient.invalidateQueries({queryKey: mediaQueryKey})
    },
  })
  const items = (media.data ?? []).filter(item => item.kind === kind)

  return <div className={styles.mediaManager}>
    <div className={styles.mediaManagerHeading}><div><strong>{required ? 'Required media' : 'Optional media'}</strong><small>{rule.label}</small></div><label className={styles.fileButton}><Upload size={16}/><span>{file ? 'Change file' : 'Choose file'}</span><input type="file" accept={rule.accept} onChange={event => { const next = event.target.files?.[0] ?? null; setFile(next); setValidationError('') }}/></label></div>
    {file ? <div className={styles.pendingFile}><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button type="button" className={styles.primary} disabled={upload.isPending} onClick={() => upload.mutate()}>{upload.isPending ? 'Uploading…' : 'Upload and use'}</button></div> : null}
    {media.isPending ? <p className={styles.status}>Loading uploaded media…</p> : null}
    {media.isError ? <ErrorNotice error={media.error} fallback="Uploaded media could not be loaded."/> : null}
    {items.length > 0 ? <div className={styles.mediaChoices}>{items.map(item => <article className={selectedMediaId === item.mediaId ? styles.selectedMedia : ''} key={item.mediaId}><label><input type="radio" name={`${kind}-media`} checked={selectedMediaId === item.mediaId} onChange={() => onSelect(item.mediaId)}/><span><strong>{item.originalFilename || `${kind.replace(/_/g, ' ').toLowerCase()} #${item.mediaId}`}</strong><small>{[item.status, item.sizeBytes ? `${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ''].filter(Boolean).join(' · ')}</small></span></label><div><button type="button" className={styles.iconAction} aria-label={`Preview ${item.originalFilename || `media ${item.mediaId}`}`} disabled={previewMedia.isPending} onClick={() => previewMedia.mutate(item.mediaId)}><Eye size={16}/></button><button type="button" className={styles.iconAction} aria-label={`Delete ${item.originalFilename || `media ${item.mediaId}`}`} disabled={remove.isPending} onClick={() => remove.mutate(item.mediaId)}><Trash2 size={16}/></button></div></article>)}</div> : !media.isPending && !media.isError ? <p className={styles.mediaEmpty}>No matching upload yet.</p> : null}
    {preview ? kind === 'LISTENING_AUDIO' ? <audio className={styles.mediaPreview} controls preload="metadata" src={preview.url}>Your browser does not support audio playback.</audio> : <img className={styles.mediaPreview} src={preview.url} alt="Selected exam media preview"/> : null}
    {validationError ? <p className={styles.error} role="alert">{validationError}</p> : null}
    {previewMedia.isError ? <ErrorNotice error={previewMedia.error} fallback="Media preview could not be loaded."/> : null}
    {remove.isError ? <ErrorNotice error={remove.error} fallback="This media cannot be deleted. Bound media remains protected by the backend."/> : null}
  </div>
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

function TenantSectionComposer({templateId, versionId, existingSections, onSaved}: {templateId: number; versionId: number; existingSections: Record<Section, boolean>; onSaved: () => void}) {
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
  const [mediaIds, setMediaIds] = useState<Record<Section, number | null>>({listening: null, reading: null, writing: null})
  const [paragraphs, setParagraphs] = useState('[]')
  const [validationError, setValidationError] = useState('')
  const [confirmCreate, setConfirmCreate] = useState(false)
  const isExisting = existingSections[section]
  const sectionDetail = useQuery({
    queryKey: ['mock-exams', 'tenant', templateId, versionId, section],
    queryFn: async () => unwrapData(await mockExamApiService.getTenantSection(templateId, versionId, section), `tenantMockExam${section}`),
    enabled: isExisting,
    retry: false,
  })

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
            imageMediaId: mediaIds.writing ?? undefined,
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
        if (!mediaIds.listening) throw new Error('Upload and select Listening audio before saving this section.')
        return mockExamApiService.createTenantListening(templateId, versionId, {
          totalMinutes,
          parts: [{seq: 1, label: label.trim(), audioMediaId: mediaIds.listening, sections: [question]}],
        })
      }
      let parsedParagraphs: unknown
      try {
        parsedParagraphs = JSON.parse(paragraphs)
      } catch {
        throw new Error('Reading paragraphs must be valid JSON.')
      }
      if (!Array.isArray(parsedParagraphs)) throw new Error('Reading paragraphs must be a JSON array.')
      return mockExamApiService.createTenantReading(templateId, versionId, {
        totalMinutes,
        passages: [{seq: 1, shortLabel: label.trim(), title: title.trim(), intro: instruction.trim(), paragraphs: parsedParagraphs, questions: [{...question, imageMediaId: mediaIds.reading ?? undefined}]}],
      })
    },
    onSuccess: () => {
      setValidationError('')
      setConfirmCreate(false)
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
          return <button type="button" role="tab" aria-selected={section === key} className={section === key ? styles.activeTab : ''} onClick={() => { setSection(key); setConfirmCreate(false); setValidationError('') }} key={key}><Icon size={16}/>{sectionLabel}{existingSections[key] ? ' · Read only' : ''}</button>
        })}
      </div>
      {isExisting ? <div className={styles.readonlySection}>{sectionDetail.isPending ? <p className={styles.status}>Loading {SECTION_META[section].label}…</p> : sectionDetail.isError ? <ErrorNotice error={sectionDetail.error} fallback={`${SECTION_META[section].label} could not be loaded.`}/> : <><RecordSummaryList value={sectionDetail.data} emptyMessage={`No readable ${SECTION_META[section].label} content was returned.`}/><TenantSectionMedia templateId={templateId} versionId={versionId} section={section} value={sectionDetail.data}/></>}<p>This section is locked after creation. This phase does not provide edit or replacement controls.</p></div> : <form className={styles.editorForm} onSubmit={(event) => { event.preventDefault(); setConfirmCreate(true) }}>
        <label><span>Duration (minutes)</span><input required type="number" min="1" value={minutes} onChange={(event) => setMinutes(event.target.value)}/></label>
        <label><span>{section === 'listening' ? 'Part label' : section === 'reading' ? 'Passage label' : 'Task title'}</span><input required value={section === 'writing' ? title : label} onChange={(event) => section === 'writing' ? setTitle(event.target.value) : setLabel(event.target.value)}/></label>
        {section === 'writing' ? (
          <>
            <label className={styles.full}><span>Candidate prompt</span><textarea required rows={6} value={prompt} onChange={(event) => setPrompt(event.target.value)}/></label>
            <label><span>Minimum words</span><input required type="number" min="0" value={minWords} onChange={(event) => setMinWords(event.target.value)}/></label>
            <div className={styles.full}><TenantMediaManager templateId={templateId} versionId={versionId} kind="WRITING_IMAGE" selectedMediaId={mediaIds.writing} onSelect={mediaId => setMediaIds(current => ({...current, writing: mediaId}))}/></div>
          </>
        ) : (
          <>
            <label className={styles.full}><span>Question group title</span><input required value={title} onChange={(event) => setTitle(event.target.value)}/></label>
            <label className={styles.full}><span>Candidate instruction</span><textarea rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)}/></label>
            <label><span>Question kind</span><input required value={kind} onChange={(event) => setKind(event.target.value)} placeholder="Contract-defined kind"/></label>
            <div className={styles.full}><TenantMediaManager templateId={templateId} versionId={versionId} kind={section === 'listening' ? 'LISTENING_AUDIO' : 'READING_IMAGE'} required={section === 'listening'} selectedMediaId={mediaIds[section]} onSelect={mediaId => setMediaIds(current => ({...current, [section]: mediaId}))}/></div>
            <label><span>First question</span><input required type="number" min="1" value={questionStart} onChange={(event) => setQuestionStart(event.target.value)}/></label>
            <label><span>Last question</span><input required type="number" min="1" value={questionEnd} onChange={(event) => setQuestionEnd(event.target.value)}/></label>
            <label className={styles.full}><span>Contract payload (JSON)</span><textarea className={styles.codeField} rows={5} value={payload} onChange={(event) => setPayload(event.target.value)}/><small>The OpenAPI leaves this JsonNode open; its shape must match the selected backend question kind.</small></label>
            {section === 'reading' ? <label className={styles.full}><span>Passage paragraphs (JSON array)</span><textarea className={styles.codeField} rows={5} value={paragraphs} onChange={(event) => setParagraphs(event.target.value)}/></label> : null}
          </>
        )}
        <div className={styles.formActions}><button className={styles.primary} disabled={save.isPending}><FilePenLine size={16}/>Review and save {SECTION_META[section].label}</button></div>
      </form>
      }
      {confirmCreate && !isExisting ? <div className={styles.confirmCreate}><p>Save this {SECTION_META[section].label} section to the draft? The current backend makes section content read-only immediately after creation.</p><div><button type="button" className={styles.primary} disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : `Save ${SECTION_META[section].label} to draft`}</button><button type="button" className={styles.secondary} onClick={() => setConfirmCreate(false)}>Back to form</button></div></div> : null}
      {validationError ? <p className={styles.error} role="alert">{validationError}</p> : null}
    </section>
  )
}

export function TenantWorkspace({value}: {value: unknown}) {
  const queryClient = useQueryClient()
  const builderRef = useRef<HTMLDivElement>(null)
  const shouldOpenBuilder = useRef(false)
  const templates = templateItems(value)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(templates[0]?.id ?? null)
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId) ?? null
  const templateDetail = useQuery({
    queryKey: ['mock-exams', 'tenant', 'template', selectedTemplateId],
    queryFn: async () => unwrapData(await mockExamApiService.getTenantTemplate(selectedTemplateId as number), 'tenantMockExamTemplate'),
    enabled: Boolean(selectedTemplateId),
    initialData: selectedTemplate ?? undefined,
    retry: false,
  })
  const workingTemplate = templateDetail.data ?? selectedTemplate
  const initialVersion = workingTemplate?.versions?.find((item) => item.status === 'DRAFT') ?? workingTemplate?.versions?.[0]
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(initialVersion?.id ?? null)
  const [template, setTemplate] = useState({label: '', title: ''})
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const versions = workingTemplate?.versions ?? []
    if (!versions.some((item) => item.id === selectedVersionId)) {
      setSelectedVersionId((versions.find((item) => item.status === 'DRAFT') ?? versions[0])?.id ?? null)
    }
  }, [selectedVersionId, workingTemplate])

  const selectedVersion = workingTemplate?.versions?.find((item) => item.id === selectedVersionId) ?? null
  const versionDetail = useQuery({
    queryKey: ['mock-exams', 'tenant', selectedTemplateId, 'version', selectedVersionId],
    queryFn: async () => unwrapData(await mockExamApiService.getTenantVersion(selectedTemplateId as number, selectedVersionId as number), 'tenantMockExamVersion'),
    enabled: Boolean(selectedTemplateId && selectedVersionId),
    retry: false,
  })

  const refresh = async () => queryClient.invalidateQueries({queryKey: ['mock-exams', 'tenant']})
  useEffect(() => {
    if (!shouldOpenBuilder.current || selectedVersion?.status !== 'DRAFT') return
    shouldOpenBuilder.current = false
    requestAnimationFrame(() => builderRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'}))
  }, [selectedTemplateId, selectedVersion?.status, selectedVersionId])

  const create = useMutation({
    mutationFn: () => mockExamApiService.createTenantTemplate({label: template.label.trim(), title: template.title.trim()}),
    onSuccess: async response => {
      const created = unwrapData(response, 'createTenantMockExamTemplate')
      setTemplate({label: '', title: ''})
      shouldOpenBuilder.current = true
      if (created.id) setSelectedTemplateId(created.id)
      const draft = created.versions?.find(version => version.status === 'DRAFT') ?? created.versions?.[0]
      setSelectedVersionId(draft?.id ?? null)
      await refresh()
    },
  })
  const lifecycle = useMutation({
    mutationFn: async (action: 'publish' | 'archive') => {
      if (!selectedTemplateId || !selectedVersionId) throw new Error('Select a template version first.')
      if (action === 'publish') {
        await Promise.all((Object.keys(SECTION_META) as Section[]).map(section => mockExamApiService.getTenantSection(selectedTemplateId, selectedVersionId, section)))
        return mockExamApiService.publishTenantVersion(selectedTemplateId, selectedVersionId)
      }
      if (action === 'archive') return mockExamApiService.archiveTenantVersion(selectedTemplateId, selectedVersionId)
      throw new Error('Unsupported lifecycle action.')
    },
    onSuccess: refresh,
  })
  const versionAction = useMutation({
    mutationFn: async (action: 'copy' | 'delete') => {
      if (!selectedTemplateId || !selectedVersionId) throw new Error('Select a template version first.')
      if (action === 'delete') {
        await mockExamApiService.deleteTenantDraft(selectedTemplateId, selectedVersionId)
        return {action, versionId: null}
      }
      const copied = unwrapData(await mockExamApiService.copyTenantVersion(selectedTemplateId, selectedVersionId, selectedVersionId), 'copyTenantMockExamVersion')
      return {
        action,
        versionId: copied && typeof copied === 'object' && !Array.isArray(copied)
          ? runtimeNumber(copied as RuntimeRecord, 'id', 'versionId')
          : null,
      }
    },
    onSuccess: async result => {
      setConfirmDelete(false)
      shouldOpenBuilder.current = result.action === 'copy'
      if (result.versionId) setSelectedVersionId(result.versionId)
      else setSelectedVersionId(null)
      await refresh()
    },
  })

  const selectTemplate = (templateId: number) => {
    const next = templates.find(item => item.id === templateId)
    const version = next?.versions?.find(item => item.status === 'DRAFT') ?? next?.versions?.[0]
    setSelectedTemplateId(templateId)
    setSelectedVersionId(version?.id ?? null)
    setConfirmDelete(false)
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.hero}><div><h1>Build and release IELTS papers</h1><p>Create an empty template, add Listening, Reading, and Writing once, review the locked content, then publish.</p></div></section>
      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Library</p><h2>Template versions</h2></div></div>
          <TemplateCards value={value} selectedId={selectedTemplateId} onSelect={selectTemplate}/>
          <form className={styles.compactForm} onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
            <h3>New draft template</h3>
            <label><span>Internal label</span><input required value={template.label} onChange={(event) => setTemplate((current) => ({...current, label: event.target.value}))}/></label>
            <label><span>Candidate title</span><input required value={template.title} onChange={(event) => setTemplate((current) => ({...current, title: event.target.value}))}/></label>
            <button className={styles.primary} disabled={create.isPending}>{create.isPending ? 'Creating draft…' : 'Create and open draft'}</button>
          </form>
          <ErrorNotice error={create.error} fallback="The template could not be created."/>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Release control</p><h2>{workingTemplate?.title || 'Select a template'}</h2></div></div>
          {templateDetail.isError ? <ErrorNotice error={templateDetail.error} fallback="Template details could not be loaded."/> : null}
          {workingTemplate?.versions?.length ? (
            <>
              <label className={styles.selectLabel}><span>Working version</span><select value={selectedVersionId ?? ''} onChange={(event) => { setSelectedVersionId(Number(event.target.value)); setConfirmDelete(false) }}>{workingTemplate.versions.map((version) => <option value={version.id} key={version.id}>v{version.versionNo ?? '—'} · {version.status || 'UNKNOWN'}</option>)}</select></label>
              <div className={styles.versionStatus}>{workingTemplate.versions.map((version) => <button type="button" className={version.id === selectedVersionId ? styles.activeVersion : ''} onClick={() => { setSelectedVersionId(version.id ?? null); setConfirmDelete(false); if (version.status === 'DRAFT') { shouldOpenBuilder.current = true; requestAnimationFrame(() => builderRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})) } }} key={version.id}><strong>v{version.versionNo ?? '—'}</strong><span>{version.status || 'Unknown'}</span><small>{[version.hasListening && 'Listening', version.hasReading && 'Reading', version.hasWriting && 'Writing'].filter(Boolean).join(' · ') || 'No sections'}</small></button>)}</div>
              {versionDetail.isPending ? <p className={styles.status}>Loading version detail…</p> : versionDetail.isError ? <ErrorNotice error={versionDetail.error} fallback="Version details could not be loaded."/> : null}
              <div className={styles.actionRow}>
                <button type="button" className={styles.primary} onClick={() => lifecycle.mutate('publish')} disabled={lifecycle.isPending || selectedVersion?.status !== 'DRAFT' || !selectedVersion.hasListening || !selectedVersion.hasReading || !selectedVersion.hasWriting}><CheckCircle2 size={16}/>{lifecycle.isPending ? 'Checking sections…' : 'Publish complete draft'}</button>
                <button type="button" className={styles.secondary} onClick={() => lifecycle.mutate('archive')} disabled={lifecycle.isPending || selectedVersion?.status !== 'PUBLISHED'}><Archive size={16}/>Archive release</button>
                <button type="button" className={styles.secondary} onClick={() => versionAction.mutate('copy')} disabled={versionAction.isPending}><Copy size={16}/>{versionAction.isPending ? 'Working…' : 'Copy to new draft'}</button>
                {selectedVersion?.status === 'DRAFT' ? <button type="button" className={styles.danger} onClick={() => setConfirmDelete(true)} disabled={versionAction.isPending}><Trash2 size={16}/>Delete draft</button> : null}
              </div>
              <p className={styles.status}>Saved sections are read only under the current create-only API. A copied draft can add sections that are still missing.</p>
              {confirmDelete ? <div className={styles.confirmCreate}><p>Delete this draft version? This cannot be undone, and its draft media will enter backend cleanup.</p><div><button type="button" className={styles.danger} disabled={versionAction.isPending} onClick={() => versionAction.mutate('delete')}>{versionAction.isPending ? 'Deleting…' : 'Confirm delete draft'}</button><button type="button" className={styles.secondary} onClick={() => setConfirmDelete(false)}>Keep draft</button></div></div> : null}
            </>
          ) : <Empty>This template does not include a version that can be edited.</Empty>}
          <ErrorNotice error={lifecycle.error} fallback="The version lifecycle action could not be completed."/>
          <ErrorNotice error={versionAction.error} fallback="The version action could not be completed."/>
        </section>
      </div>
      <div ref={builderRef} className={styles.builderAnchor}>{selectedTemplateId && selectedVersionId && selectedVersion?.status === 'DRAFT'
        ? <TenantSectionComposer templateId={selectedTemplateId} versionId={selectedVersionId} existingSections={{listening: selectedVersion.hasListening === true, reading: selectedVersion.hasReading === true, writing: selectedVersion.hasWriting === true}} onSaved={refresh}/>
        : selectedVersion ? <section className={styles.panel}><Empty>Published and archived versions are read only.</Empty></section> : null}
      </div>
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
