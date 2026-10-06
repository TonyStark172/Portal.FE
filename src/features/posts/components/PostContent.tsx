/**
 * A post's text. The HTML was sanitized by Portal.BE (formatting and mentions only), so it is rendered as is;
 * images and videos are the album (PostMedia).
 */
export function PostContent({ html }: { html: string }) {
  return <div className="post-content text-foreground" dangerouslySetInnerHTML={{ __html: html }} />;
}
