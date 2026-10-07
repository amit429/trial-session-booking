import { Link } from "react-router-dom";

/** Message text where links back into this app become in-app links (verify, reset, manage). */
export function MessageBody({ body }: { body: string }) {
  const parts = body.split(/(https?:\/\/\S+)/g);
  return (
    <div className="whitespace-pre-wrap break-words text-[13.5px] text-muted-foreground">
      {parts.map((p, i) => {
        if (!/^https?:\/\//.test(p)) return <span key={i}>{p}</span>;
        let url: URL | null = null;
        try { url = new URL(p); } catch { /* not a URL */ }
        if (url && url.origin === window.location.origin) {
          return <Link key={i} to={`${url.pathname}${url.search}`} className="font-medium text-brand-text underline underline-offset-4">{p}</Link>;
        }
        return <span key={i} className="font-mono text-xs">{p}</span>;
      })}
    </div>
  );
}
