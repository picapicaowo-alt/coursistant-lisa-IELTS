import {useTranslation} from 'react-i18next';
import {FormEvent, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, Megaphone, Pencil, Plus, Trash2, X} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import type {CourseAnnouncement, CourseAnnouncementPayload, CourseAnnouncementSummary} from '@/apis';
import {unwrapData} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {RichTextEditor} from '@/components/RichTextEditor';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {formatUtcTimestamp} from '@/utils/datetime';
import styles from '../CourseEventsPage/index.module.scss';

const emptyDraft = (): CourseAnnouncementPayload => ({title: '', body: ''});

const CourseAnnouncementsPage = () => {
  const {t: translate} = useTranslation();
  const courseId = Number(useParams().courseId);
  const validCourse = Number.isInteger(courseId) && courseId > 0;
  const access = useCourseAccess(validCourse ? courseId : null);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CourseAnnouncementPayload>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const announcements = useQuery({
    queryKey: ['course-announcements', courseId],
    queryFn: async () => unwrapData(await courseApiService.listAnnouncements(courseId), 'List announcements'),
    enabled: validCourse,
  });

  const save = useMutation({
    mutationFn: () => editingId === null
      ? courseApiService.createAnnouncement(courseId, {title: draft.title.trim(), body: draft.body})
      : courseApiService.updateAnnouncement(courseId, editingId, {title: draft.title.trim(), body: draft.body}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: ['course-announcements', courseId]});
      setEditorOpen(false);
      setEditingId(null);
      setDraft(emptyDraft());
      setMessage('Announcement saved.');
    },
    onError: () => setMessage('The announcement could not be saved.'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => courseApiService.deleteAnnouncement(courseId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: ['course-announcements', courseId]});
      setConfirmDeleteId(null);
      setMessage('Announcement deleted.');
    },
    onError: () => setMessage('The announcement could not be deleted.'),
  });

  const beginEdit = async (item: CourseAnnouncementSummary) => {
    setMessage(null);
    try {
      const full: CourseAnnouncement = unwrapData(await courseApiService.getAnnouncement(courseId, item.id), 'Load announcement');
      setEditingId(item.id);
      setDraft({title: full.title, body: full.body});
      setEditorOpen(true);
    } catch {
      setMessage('The announcement could not be loaded for editing.');
    }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); setMessage(null); save.mutate(); };
  const items = announcements.data ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to={`/course/${courseId}`} className={styles.backLink} aria-label={translate("course:grades.back")} title={translate("course:grades.back")}><ArrowLeft size={22} aria-hidden="true"/></Link>
        <div className={styles.headerText}><p className={styles.eyebrow}>Course communications</p><h1>Announcements</h1></div>
        {access.canPostAnnouncements && !editorOpen ? <button type="button" className={styles.primaryButton} onClick={() => { setEditingId(null); setDraft(emptyDraft()); setEditorOpen(true); setMessage(null); }}><Plus size={17}/> Add announcement</button> : null}
      </header>
      {message ? <p className={message.includes('could not') ? styles.error : styles.success} role="status">{message}</p> : null}

      {editorOpen ? (
        <form className={styles.card} onSubmit={submit}>
          <div className={styles.cardHeader}><div><h2>{editingId === null ? 'Create announcement' : 'Edit announcement'}</h2><p>Formatting, headings, lists, color, links, and media are supported.</p></div><button type="button" className={styles.iconButton} aria-label="Close editor" onClick={() => setEditorOpen(false)}><X size={18}/></button></div>
          <div className={styles.formGrid}>
            <label className={styles.full}><span>Title</span><input value={draft.title} onChange={event => setDraft(current => ({...current, title: event.target.value}))} required/></label>
            <div className={styles.full}><RichTextEditor content={draft.body} onChange={body => setDraft(current => ({...current, body}))} placeholder="Write the announcement…" ariaLabel="Announcement body"/></div>
          </div>
          <div className={styles.formFooter}><button type="submit" className={styles.primaryButton} disabled={save.isPending || !draft.title.trim() || !draft.body.trim()}>{save.isPending ? 'Saving…' : 'Save announcement'}</button></div>
        </form>
      ) : (
        <section className={styles.card}>
          <div className={styles.cardHeader}><div><h2>All announcements</h2><p>{items.length} posted</p></div></div>
          {announcements.isPending ? <p className={styles.muted}>Loading announcements…</p> : announcements.isError ? <p className={styles.error}>Could not load announcements.</p> : items.length === 0 ? <p className={styles.muted}>No announcements have been posted.</p> : (
            <ul className={styles.eventList}>{items.map(item => (
              <li key={item.id}><div className={styles.announcementRow}>
                <Link to={`/course/${courseId}/announcements/${item.id}`}><span className={styles.dateTile}><Megaphone size={18}/></span><span className={styles.eventText}><strong>{item.title}</strong><small>{item.authorName} · {formatUtcTimestamp(item.postedAt)}</small></span><span aria-hidden="true">→</span></Link>
                {access.canPostAnnouncements ? <div className={styles.rowActions}><button type="button" className={styles.iconButton} aria-label={`Edit ${item.title}`} onClick={() => void beginEdit(item)}><Pencil size={16}/></button>{confirmDeleteId === item.id ? <><button type="button" className={styles.dangerButton} onClick={() => remove.mutate(item.id)}>Confirm</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmDeleteId(null)}>Cancel</button></> : <button type="button" className={styles.iconButton} aria-label={`Delete ${item.title}`} onClick={() => setConfirmDeleteId(item.id)}><Trash2 size={16}/></button>}</div> : null}
              </div></li>
            ))}</ul>
          )}
        </section>
      )}
    </main>
  );
};

export default CourseAnnouncementsPage;
