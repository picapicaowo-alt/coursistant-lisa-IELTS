import {describe, expect, it} from 'vitest';
import {embeddedVideoUrl} from './materialVideo';

describe('course video embeds', () => {
  it('maps supported video links to privacy-enhanced embed hosts', () => {
    expect(embeddedVideoUrl('https://youtu.be/abcdefghijk')).toBe(
      'https://www.youtube-nocookie.com/embed/abcdefghijk',
    );
    expect(
      embeddedVideoUrl('https://www.youtube.com/watch?v=abcdefghijk&t=30'),
    ).toBe('https://www.youtube-nocookie.com/embed/abcdefghijk');
    expect(embeddedVideoUrl('https://vimeo.com/1234567')).toBe(
      'https://player.vimeo.com/video/1234567',
    );
  });
  it('rejects executable URLs, lookalike hosts and invalid identifiers', () => {
    for (const url of [
      'javascript:alert(1)',
      'https://youtube.com.evil.test/watch?v=abcdefghijk',
      'https://youtu.be/abc',
      'https://example.test/video',
      null,
    ])
      expect(embeddedVideoUrl(url)).toBeUndefined();
  });
});
