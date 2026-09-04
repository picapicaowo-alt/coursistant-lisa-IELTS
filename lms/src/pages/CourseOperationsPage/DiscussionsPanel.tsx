import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MessageSquare, Paperclip, Plus, Search } from "lucide-react";
import { unwrapData } from "@/apis";
import { courseOperationsApiService as api } from "@/apis/services/course-operations-api";
import {
  TeachingDialog,
  TeachingError,
  TeachingPagination,
  TeachingState,
} from "@/components/TeachingWorkspace";
import { useIdempotencyCheckpoint } from "@/hooks/useIdempotencyCheckpoint";
import {
  openPreviewWindow,
  saveBlob,
  showBlobInPreviewWindow,
} from "@/utils/downloadBlob";
import {
  PAGE_SIZE,
  parsePost,
  recordId,
  recordPage,
  textValue,
  dateLabel,
  type OperationRecord,
  type DiscussionPost,
} from "./records";
import s from "@/components/TeachingWorkspace/index.module.scss";

export function DiscussionsPanel({ courseId }: { courseId: number }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<DiscussionPost>();
  const query = useQuery({
    queryKey: ["discussion", courseId, "posts", page, PAGE_SIZE],
    queryFn: async () => {
      const result = recordPage(
        unwrapData(
          await api.listDiscussionPosts(courseId, page, PAGE_SIZE),
          "course discussions",
        ),
      );
      return { ...result, items: result.items.map(parsePost) };
    },
    retry: false,
  });
  const visible =
    query.data?.items.filter((item) =>
      `${item.name} ${item.body}`.toLowerCase().includes(filter.toLowerCase()),
    ) ?? [];
  return (
    <section className={s.panel} aria-label="Course discussions">
      <div className={s.toolbar}>
        <label className={s.search}>
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Filter discussions on this page"
            placeholder="Filter this page…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={s.primary}
          onClick={() => setCreate(true)}
        >
          <Plus size={18} />
          New post
        </button>
      </div>
      {query.isPending || query.isError || !visible.length ? (
        <TeachingState
          loading={query.isPending}
          error={query.error}
          empty={
            filter
              ? "No discussions on this page match your filter."
              : "No discussion posts yet. Start a conversation with your course."
          }
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className={s.recordList}>
          {visible.map((item) => {
            const lines = item.body.split("\n");
            return (
              <article className={s.record} key={item.id}>
                <div className={s.recordHeader}>
                  <div>
                    <h3 className={s.preview}>
                      {lines[0] || "Course discussion"}
                    </h3>
                    <small className={s.subline}>
                      {item.name} · {dateLabel(item.createdAt)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className={s.textButton}
                    onClick={() => setSelected(item)}
                  >
                    <MessageSquare size={17} />
                    View replies
                  </button>
                </div>
                {lines.slice(1).join("\n").trim() ? (
                  <p className={s.preview}>{lines.slice(1).join("\n")}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      <TeachingPagination
        page={page}
        size={PAGE_SIZE}
        total={query.data?.total}
        count={query.data?.items.length ?? 0}
        loading={query.isFetching}
        onChange={(value) => {
          setPage(value);
          setFilter("");
        }}
        label="Discussions"
      />
      {create ? (
        <NewPost
          courseId={courseId}
          onClose={() => setCreate(false)}
          onCreated={() => {
            setCreate(false);
            setPage(0);
          }}
        />
      ) : null}
      {selected ? (
        <DiscussionThread
          key={selected.id}
          courseId={courseId}
          post={selected}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </section>
  );
}

function NewPost({
  courseId,
  onClose,
  onCreated,
}: {
  courseId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const checkpoint = useIdempotencyCheckpoint();
  const mutation = useMutation({
    mutationFn: () =>
      checkpoint.run(
        `discussion-${courseId}`,
        { body: body.trim(), files },
        async (key, value) =>
          unwrapData(
            await api.createDiscussionPost(
              courseId,
              value.body,
              value.files,
              key,
            ),
            "new discussion",
          ),
      ),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["discussion", courseId, "posts"],
      });
      onCreated();
    },
  });
  return (
    <TeachingDialog
      title="New discussion"
      description="Share a question, update, or resource with your course."
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className={s.form}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <label className={`${s.field} ${s.full}`}>
          Message
          <textarea
            required
            rows={7}
            placeholder="Start with your question or topic, then add the details…"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <label className={`${s.field} ${s.full}`}>
          <span>
            <Paperclip size={16} /> Attach files (optional)
          </span>
          <input
            ref={input}
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </label>
        {files.length ? (
          <p className={`${s.muted} ${s.full}`}>
            {files.map((file) => file.name).join(", ")}
          </p>
        ) : null}
        <div className={s.full}>
          <TeachingError error={mutation.error} />
        </div>
        <div className={s.actions}>
          <button
            type="button"
            className={s.secondary}
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={s.primary}
            disabled={mutation.isPending || !body.trim()}
          >
            {mutation.isPending ? "Posting…" : "Post discussion"}
          </button>
        </div>
      </form>
    </TeachingDialog>
  );
}

function DiscussionThread({
  courseId,
  post,
  onClose,
}: {
  courseId: number;
  post: DiscussionPost;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [body, setBody] = useState("");
  const client = useQueryClient();
  const checkpoint = useIdempotencyCheckpoint();
  const detail = useQuery({
    queryKey: ["discussion", courseId, post.id],
    queryFn: async () =>
      parsePost(
        unwrapData(
          await api.getDiscussionPost(courseId, post.id),
          "discussion detail",
        ),
      ),
    retry: false,
  });
  const replies = useQuery({
    queryKey: ["discussion", courseId, post.id, "replies", page, PAGE_SIZE],
    queryFn: async () => {
      const result = recordPage(
        unwrapData(
          await api.listDiscussionReplies(courseId, post.id, page, PAGE_SIZE),
          "discussion replies",
        ),
      );
      return { ...result, items: result.items.map(parsePost) };
    },
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: () =>
      checkpoint.run(
        `reply-${courseId}-${post.id}`,
        body.trim(),
        async (key, value) =>
          unwrapData(
            await api.createDiscussionReply(courseId, post.id, value, key),
            "discussion reply",
          ),
      ),
    onSuccess: async () => {
      setBody("");
      await client.invalidateQueries({
        queryKey: ["discussion", courseId, post.id, "replies"],
      });
    },
  });
  return (
    <TeachingDialog
      title="Course discussion"
      description={`${post.name} · ${dateLabel(post.createdAt)}`}
      onClose={onClose}
      busy={mutation.isPending}
    >
      {detail.isPending || detail.isError ? (
        <TeachingState
          loading={detail.isPending}
          error={detail.error}
          onRetry={() => void detail.refetch()}
        />
      ) : (
        <p className={s.notice} style={{ whiteSpace: "pre-wrap" }}>
          {detail.data?.body}
        </p>
      )}
      <PostAttachments courseId={courseId} postId={post.id} />
      <h3>
        Replies{replies.data?.total != null ? ` (${replies.data.total})` : ""}
      </h3>
      {replies.isPending || replies.isError || !replies.data?.items.length ? (
        <TeachingState
          loading={replies.isPending}
          error={replies.error}
          empty="No replies yet. Add the first reply below."
          onRetry={() => void replies.refetch()}
        />
      ) : (
        <div className={s.recordList}>
          {replies.data.items.map((item) => (
            <article className={s.record} key={item.id}>
              <strong>{item.name}</strong>
              <small className={s.subline}>{dateLabel(item.createdAt)}</small>
              <p style={{ whiteSpace: "pre-wrap" }}>{item.body}</p>
            </article>
          ))}
        </div>
      )}
      <TeachingPagination
        page={page}
        size={PAGE_SIZE}
        total={replies.data?.total}
        count={replies.data?.items.length ?? 0}
        loading={replies.isFetching}
        onChange={setPage}
        label="Replies"
      />
      <form
        className={s.form}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <label className={`${s.field} ${s.full}`}>
          Your reply
          <textarea
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a thoughtful reply…"
          />
        </label>
        <div className={s.full}>
          <TeachingError error={mutation.error} />
        </div>
        <div className={s.actions}>
          <button
            className={s.primary}
            disabled={mutation.isPending || !body.trim()}
          >
            {mutation.isPending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </form>
    </TeachingDialog>
  );
}

function PostAttachments({
  courseId,
  postId,
}: {
  courseId: number;
  postId: number;
}) {
  const query = useQuery({
    queryKey: ["discussion", courseId, postId, "attachments"],
    queryFn: async () =>
      recordPage(
        unwrapData(
          await api.listDiscussionAttachments(courseId, postId),
          "discussion attachments",
        ),
      ),
    retry: false,
  });
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const open = async (item: OperationRecord, preview: boolean) => {
    const window = preview ? openPreviewWindow() : null;
    setError(undefined);
    setBusy(true);
    try {
      const id = recordId(item, "attachmentId", "id");
      if (preview) {
        if (!window)
          throw new Error("Allow pop-ups to preview this attachment.");
        showBlobInPreviewWindow(
          window,
          await api.previewDiscussionAttachment(courseId, postId, id),
        );
      } else
        saveBlob(
          await api.downloadDiscussionAttachment(courseId, postId, id),
          textValue(item, "originalFilename") ?? `attachment-${id}`,
        );
    } catch (caught) {
      window?.close();
      setError(caught);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      {query.isError ? (
        <TeachingState
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        query.data?.items.map((item) => (
          <div key={recordId(item, "attachmentId", "id")} className={s.toolbar}>
            <span>
              <Paperclip size={15} />{" "}
              {textValue(item, "originalFilename") ?? "Attachment"}
            </span>
            <div className={s.recordActions}>
              {item.previewAvailable === true ? (
                <button
                  type="button"
                  className={s.textButton}
                  disabled={busy}
                  onClick={() => void open(item, true)}
                >
                  Preview
                </button>
              ) : null}
              <button
                type="button"
                className={s.textButton}
                disabled={busy}
                onClick={() => void open(item, false)}
              >
                <Download size={15} />
                Download
              </button>
            </div>
          </div>
        ))
      )}
      <TeachingError error={error} />
    </div>
  );
}
