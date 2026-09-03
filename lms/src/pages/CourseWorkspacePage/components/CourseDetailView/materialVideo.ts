/** Only known video providers receive an embed URL; ordinary links retain their original destination. */
export function embeddedVideoUrl(value: string | null): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return;
    const host = url.hostname.replace(/^www\./, '');
    const id =
      host === 'youtu.be'
        ? url.pathname.slice(1)
        : ['youtube.com', 'm.youtube.com'].includes(host)
          ? (url.searchParams.get('v') ??
            url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1])
          : undefined;
    if (id && /^[\w-]{11}$/.test(id))
      return `https://www.youtube-nocookie.com/embed/${id}`;
    if (host === 'vimeo.com' && /^\/\d+$/.test(url.pathname))
      return `https://player.vimeo.com/video${url.pathname}`;
  } catch {
    return;
  }
}
