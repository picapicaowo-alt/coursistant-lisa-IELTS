import {formatDateTime, formatNumber} from '@/i18n/formatting';
import {LocalizedError} from '@/i18n/errors';
import { useTranslation } from 'react-i18next';
import {useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Download, Eye, MessageCircle, Paperclip, Send, X} from 'lucide-react';
import {unwrapData} from '@/apis';
import {courseOperationsApiService as api} from '@/apis/services/course-operations-api';
import {LearningBadge, LearningEmpty, LearningQueryState} from '@/components/LearningWorkspace';
import {TeachingError, TeachingPagination} from '@/components/TeachingWorkspace';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {record, recordPage, recordId, textValue, optionalNumber, type OperationRecord} from '@/utils/operationRecords';
import {formatPersonName} from '@/utils/personName';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import s from './DiscussionPanel.module.scss';

const DISCUSSION_PAGE_SIZE = 10;

function Author({post}: {post: OperationRecord}) {
  const {t: translate} = useTranslation();
  const firstName = textValue(post, 'authorFirstName');
  const lastName = textValue(post, 'authorLastName');
  const name = formatPersonName({firstName, middleName: textValue(post, 'authorMiddleName'), lastName}, translate("operations:courseMember"));
  const initials = [firstName, lastName].map(value => Array.from(value ?? '')[0] ?? '').join('').toUpperCase();
  const createdAt = textValue(post, 'createdAt');
  const date = createdAt ? new Date(createdAt) : undefined;
  const role = textValue(post, 'authorRole', 'authorType');
  return <header className={s.author}><span className={s.avatar} aria-hidden="true">{initials || <MessageCircle size={21}/>}</span><div><div className={s.authorName}><strong>{name}</strong>{role ? <LearningBadge value={role}/> : null}</div>{date && Number.isFinite(date.valueOf()) ? <time dateTime={createdAt}>{formatDateTime(date, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}</time> : null}</div></header>;
}

function Composer({courseId, postId, onPosted}: {courseId: number; postId?: number; onPosted: () => void}) {
  const {t: translate} = useTranslation();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const checkpoint = useIdempotencyCheckpoint();
  const reply = postId != null;
  const mutation = useMutation({
    mutationFn: () => checkpoint.run(`discussion-${courseId}-${postId ?? 'new'}`, {body: body.trim(), files}, async (key, draft) => unwrapData(await (postId == null ? api.createDiscussionPost(courseId, draft.body, draft.files, key) : api.createDiscussionReply(courseId, postId, draft.body, key, draft.files)), 'discussion message')),
    onSuccess: async () => {
      setBody(''); setFiles([]); if (input.current) input.current.value = '';
      await client.invalidateQueries({queryKey: ['discussion', courseId]});
      onPosted();
    },
  });
  return <form noValidate className={`${s.composer} ${reply ? s.replyComposer : ''}`} onSubmit={event => {event.preventDefault(); if (body.trim() && !mutation.isPending) mutation.mutate();}}>
    <label><span className={reply ? s.replyLabel : s.srOnly}>{reply ? translate("course:discussion.replyLabel") : translate("course:discussion.commentLabel")}</span><textarea required value={body} onChange={event => setBody(event.target.value)} disabled={mutation.isPending} rows={reply ? 3 : 4} placeholder={reply ? translate("operations:replyPlaceholder") : translate("course:discussion.commentPlaceholder")}/></label>
    {!!files.length ? <ul className={s.selectedFiles}>{files.map((file, index) => <li key={`${file.name}-${index}`}><Paperclip size={15}/><span>{file.name}</span><button type="button" aria-label={translate('common:actions.removeItem', {item: file.name})} disabled={mutation.isPending} onClick={() => setFiles(current => current.filter((_, position) => position !== index))}><X size={16}/></button></li>)}</ul> : null}
    <div className={s.composerActions}><button className={s.attachButton} type="button" disabled={mutation.isPending} onClick={() => input.current?.click()}><Paperclip size={19}/> {' '}{translate("advising:support.attach")}</button><input className={s.srOnly} ref={input} type="file" multiple aria-label={reply ? translate("course:discussion.replyAttachments") : translate("course:discussion.postAttachments")} onChange={event => {const selectedFiles = Array.from(event.target.files ?? []); setFiles(current => [...current, ...selectedFiles]); event.target.value = '';}}/><button className={s.primary} type="submit" disabled={mutation.isPending || !body.trim()}><Send size={17}/>{mutation.isPending ? translate("operations:sending") : reply ? translate("operations:reply") : translate("course:discussion.post")}</button></div>
    <TeachingError error={mutation.error}/>
  </form>;
}

function Attachments({courseId, postId, items}: {courseId: number; postId: number; items: OperationRecord[]}) {
  const { t: translate } = useTranslation();
  const [pending, setPending] = useState<number>();
  const [error, setError] = useState<unknown>();
  const open = async (item: OperationRecord, preview: boolean) => {
    const id = recordId(item, 'attachmentId', 'id');
    const popup = preview ? openPreviewWindow() : undefined;
    setPending(id); setError(undefined);
    try {
      if (preview && !popup) throw new LocalizedError("operations:errors.attachmentPopups");
      if (popup) showBlobInPreviewWindow(popup, await api.previewDiscussionAttachment(courseId, postId, id));
      else saveBlob(await api.downloadDiscussionAttachment(courseId, postId, id), textValue(item, 'originalFilename', 'originalName') || `attachment-${id}`);
    } catch (failure) {popup?.close(); setError(failure);}
    finally {setPending(undefined);}
  };
  return items.length ? <div className={s.attachments}>{items.map((item, index) => {
    const id = optionalNumber(item, 'attachmentId', 'id');
    return <article key={id ?? index}><Paperclip size={18}/><span>{textValue(item, 'originalFilename', 'originalName') || translate("operations:attachment")}</span>{id ? <div>{item.previewAvailable === true ? <button type="button" disabled={pending != null} aria-label={translate('assessment:files.previewName', {name: textValue(item, 'originalFilename', 'originalName') || translate("operations:attachment")})} onClick={() => void open(item, true)}><Eye size={17}/> {' '}{translate("course:materials.preview")}</button> : null}<button type="button" disabled={pending != null} onClick={() => void open(item, false)}><Download size={17}/>{pending === id ? translate("course:materials.opening") : translate("common:actions.download")}</button></div> : null}</article>;
  })}<TeachingError error={error}/></div> : null;
}

function PostThread({courseId, postId}: {courseId: number; postId: number}) {
  const {t: translate} = useTranslation();
  const [page, setPage] = useState(0);
  const attachments = useQuery({queryKey: ['discussion', courseId, postId, 'attachments'], queryFn: async () => recordPage(unwrapData(await api.listDiscussionAttachments(courseId, postId), 'discussion attachments')).items, retry: false});
  const replies = useQuery({queryKey: ['discussion', courseId, postId, 'replies', page, DISCUSSION_PAGE_SIZE], queryFn: async () => {const result = recordPage(unwrapData(await api.listDiscussionReplies(courseId, postId, page, DISCUSSION_PAGE_SIZE), 'discussion replies')); result.items.forEach(item => recordId(item, 'postId', 'id')); return result;}, retry: false});
  return <section className={s.thread} aria-label={translate("course:discussion.thread")}><LearningQueryState query={attachments}/>{attachments.data ? <Attachments courseId={courseId} postId={postId} items={attachments.data}/> : null}<h3>{replies.data?.total != null ? translate('course:discussion.repliesTotal', {total: formatNumber(replies.data.total)}) : translate("operations:replies")}</h3><LearningQueryState query={replies}/>
    {replies.isSuccess && !replies.data.items.length ? <p className={s.noReplies}>{translate("course:discussion.noReplies")}</p> : null}
    <div className={s.replies}>{replies.data?.items.map(item => {
      const id = recordId(item, 'postId', 'id');
      const embeddedAttachments = Array.isArray(item.attachments) ? item.attachments.map(record) : [];
      return <article className={s.reply} key={id}><Author post={item}/><p className={s.body}>{textValue(item, 'body')}</p><Attachments courseId={courseId} postId={id} items={embeddedAttachments}/></article>;
    })}</div>
    <TeachingPagination label={translate("operations:replies")} page={page} size={DISCUSSION_PAGE_SIZE} count={replies.data?.items.length ?? 0} total={replies.data?.total} loading={replies.isFetching} onChange={setPage}/>
    <Composer courseId={courseId} postId={postId} onPosted={() => setPage(0)}/>
  </section>;
}

export function DiscussionPanel({courseId}: {courseId: number}) {
  const {t: translate} = useTranslation();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number>();
  const posts = useQuery({queryKey: ['discussion', courseId, 'posts', page, DISCUSSION_PAGE_SIZE], queryFn: async () => {const result = recordPage(unwrapData(await api.listDiscussionPosts(courseId, page, DISCUSSION_PAGE_SIZE), 'course discussions')); result.items.forEach(item => recordId(item, 'postId', 'id')); return result;}, retry: false});
  return <section className={s.panel} aria-label={translate("operations:courseDiscussion")}><Composer courseId={courseId} onPosted={() => {setPage(0); setSelected(undefined);}}/><LearningQueryState query={posts}/>
    {posts.isSuccess && !posts.data.items.length ? <LearningEmpty icon={MessageCircle} title={translate("advising:overview.startConversation")} description={translate("course:discussion.startHelp")}/> : null}
    {posts.data?.items.map(item => {
      const id = recordId(item, 'postId', 'id');
      return <article className={s.post} key={id}><Author post={item}/><p className={s.body}>{textValue(item, 'body')}</p><footer className={s.postFooter}><button type="button" aria-expanded={selected === id} onClick={() => setSelected(current => current === id ? undefined : id)}><MessageCircle size={18}/>{selected === id ? translate("course:discussion.closeThread") : translate("course:discussion.viewThread")}</button>{Array.isArray(item.attachments) && item.attachments.length ? <span><Paperclip size={16}/>{translate('course:discussion.attachments', {count: item.attachments.length, formattedCount: formatNumber(item.attachments.length)})}</span> : null}</footer>{selected === id ? <PostThread courseId={courseId} postId={id}/> : null}</article>;
    })}
    <TeachingPagination label={translate("course:learning.tabs.discussion")} page={page} size={DISCUSSION_PAGE_SIZE} count={posts.data?.items.length ?? 0} total={posts.data?.total} loading={posts.isFetching} onChange={value => {setPage(value); setSelected(undefined);}}/>
  </section>;
}
