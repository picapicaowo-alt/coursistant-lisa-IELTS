import {useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {courseOperationsApiService as api} from '@/apis/services/course-operations-api';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorMessage} from '@/utils/apiError';
import {saveBlob} from '@/utils/downloadBlob';
import styles from './DiscussionPanel.module.scss';

// These endpoints still declare a generic ApiResponse. Keep reads defensive;
// absent identity disables follow-up actions rather than guessing a post ID.
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RecordValue)
    : undefined;
function rows(value: unknown): RecordValue[] {
  const item = record(value);
  const list = Array.isArray(value) ? value : (item?.items ?? item?.content);
  return Array.isArray(list)
    ? list.flatMap((value) => (record(value) ? [record(value)!] : []))
    : [];
}
function identity(item: RecordValue, key: string): number | undefined {
  const value = item[key] ?? item.id;
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}
function ErrorMessage({error}: {error: unknown}) {
  return (
    <p className={styles.error} role="alert">
      {getApiErrorMessage(
        error,
        'The discussion could not be loaded. Please retry.',
      )}
    </p>
  );
}

function PostThread({courseId, postId}: {courseId: number; postId: number}) {
  const [page, setPage] = useState(0);
  const [body, setBody] = useState('');
  const [downloadError, setDownloadError] = useState<unknown>();
  const [downloading, setDownloading] = useState(false);
  const client = useQueryClient();
  const checkpoint = useIdempotencyCheckpoint();
  const detail = useQuery({
    queryKey: ['discussion', courseId, postId],
    queryFn: async () =>
      unwrapData(
        await api.getDiscussionPost(courseId, postId),
        'discussionPost',
      ),
    retry: false,
  });
  const replies = useQuery({
    queryKey: ['discussion', courseId, postId, 'replies', page],
    queryFn: async () =>
      unwrapData(
        await api.listDiscussionReplies(courseId, postId, page, 20),
        'discussionReplies',
      ),
    retry: false,
  });
  const attachments = useQuery({
    queryKey: ['discussion', courseId, postId, 'attachments'],
    queryFn: async () =>
      unwrapData(
        await api.listDiscussionAttachments(courseId, postId),
        'discussionAttachments',
      ),
    retry: false,
  });
  const reply = useMutation({
    mutationFn: () =>
      checkpoint.run(`reply-${courseId}-${postId}`, body.trim(), (key, text) =>
        api.createDiscussionReply(courseId, postId, text, key),
      ),
    onSuccess: async () => {
      setBody('');
      setPage(0);
      await client.invalidateQueries({
        queryKey: ['discussion', courseId, postId],
      });
    },
  });
  const download = async (attachment: RecordValue) => {
    const id = identity(attachment, 'attachmentId');
    if (!id) return;
    setDownloading(true);
    setDownloadError(undefined);
    try {
      saveBlob(
        await api.downloadDiscussionAttachment(courseId, postId, id),
        typeof attachment.originalName === 'string'
          ? attachment.originalName
          : `attachment-${id}`,
      );
    } catch (error) {
      setDownloadError(error);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <section className={styles.thread} aria-label="Discussion thread">
      {detail.isPending ? (
        <p role="status">Loading post…</p>
      ) : detail.isError ? (
        <ErrorMessage error={detail.error} />
      ) : (
        <RecordSummaryList value={detail.data} />
      )}
      {attachments.isError ? (
        <ErrorMessage error={attachments.error} />
      ) : (
        rows(attachments.data).map((attachment, index) => (
          <div
            key={identity(attachment, 'attachmentId') ?? index}
            className={styles.attachment}
          >
            <RecordSummaryList value={attachment} />
            {identity(attachment, 'attachmentId') ? (
              <button
                type="button"
                disabled={downloading}
                onClick={() => void download(attachment)}
              >
                Download attachment
              </button>
            ) : null}
          </div>
        ))
      )}
      {downloadError ? <ErrorMessage error={downloadError} /> : null}
      <h3>Replies</h3>
      {replies.isPending ? (
        <p role="status">Loading replies…</p>
      ) : replies.isError ? (
        <>
          <ErrorMessage error={replies.error} />
          <button type="button" onClick={() => void replies.refetch()}>
            Retry
          </button>
        </>
      ) : (
        <RecordSummaryList
          value={replies.data}
          emptyMessage="Start the conversation with a reply."
        />
      )}
      <nav className={styles.pagination} aria-label="Reply pages">
        <button
          type="button"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          type="button"
          disabled={rows(replies.data).length < 20}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </nav>
      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          reply.mutate();
        }}
      >
        <label>
          Reply to this post
          <textarea
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a reply…"
          />
        </label>
        <button
          className={styles.primary}
          disabled={reply.isPending || !body.trim()}
        >
          {reply.isPending ? 'Sending…' : 'Reply'}
        </button>
        {reply.isError ? <ErrorMessage error={reply.error} /> : null}
      </form>
    </section>
  );
}

export function DiscussionPanel({courseId}: {courseId: number}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number>();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const checkpoint = useIdempotencyCheckpoint();
  const posts = useQuery({
    queryKey: ['discussion', courseId, 'posts', page],
    queryFn: async () =>
      unwrapData(
        await api.listDiscussionPosts(courseId, page, 20),
        'discussionPosts',
      ),
    retry: false,
  });
  const create = useMutation({
    mutationFn: () =>
      checkpoint.run(
        `discussion-${courseId}`,
        {body: body.trim(), files},
        (key, value) =>
          api.createDiscussionPost(courseId, value.body, value.files, key),
      ),
    onSuccess: async () => {
      setBody('');
      setFiles([]);
      if (input.current) input.current.value = '';
      setPage(0);
      await client.invalidateQueries({
        queryKey: ['discussion', courseId, 'posts'],
      });
    },
  });
  return (
    <section className={styles.panel} aria-label="Course discussion">
      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <label>
          Add a comment
          <textarea
            required
            placeholder="Share a question or an idea with your course…"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <div className={styles.actions}>
          <label className={styles.file}>
            Attach files
            <input
              ref={input}
              type="file"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []))
              }
            />
          </label>
          <button
            className={styles.primary}
            disabled={create.isPending || !body.trim()}
          >
            {create.isPending ? 'Posting…' : 'Post comment'}
          </button>
        </div>
        {create.isError ? <ErrorMessage error={create.error} /> : null}
      </form>
      {posts.isPending ? (
        <p role="status">Loading discussion…</p>
      ) : posts.isError ? (
        <>
          <ErrorMessage error={posts.error} />
          <button type="button" onClick={() => void posts.refetch()}>
            Retry discussion
          </button>
        </>
      ) : rows(posts.data).length ? (
        rows(posts.data).map((post, index) => {
          const id = identity(post, 'postId');
          return (
            <article className={styles.post} key={id ?? index}>
              <RecordSummaryList value={post} />
              {id ? (
                <button
                  type="button"
                  aria-expanded={selected === id}
                  onClick={() =>
                    setSelected((current) => (current === id ? undefined : id))
                  }
                >
                  {selected === id
                    ? 'Close thread'
                    : 'View replies & attachments'}
                </button>
              ) : null}
              {id && selected === id ? (
                <PostThread key={id} courseId={courseId} postId={id} />
              ) : null}
            </article>
          );
        })
      ) : (
        <p className={styles.empty}>
          No discussion posts yet. Ask the first question.
        </p>
      )}
      <nav className={styles.pagination} aria-label="Discussion pages">
        <button
          type="button"
          disabled={!page || posts.isFetching}
          onClick={() => {
            setPage(page - 1);
            setSelected(undefined);
          }}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          type="button"
          disabled={rows(posts.data).length < 20 || posts.isFetching}
          onClick={() => {
            setPage(page + 1);
            setSelected(undefined);
          }}
        >
          Next
        </button>
      </nav>
    </section>
  );
}
