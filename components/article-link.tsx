// components/article-link.tsx

function safeHref(href: string): string {
  return href.startsWith('http://') || href.startsWith('https://') ? href : '#';
}

interface ArticleLinkProps {
  href: string;
  sourceName: string;
  source: string;
  title: string;
  publishedAt: string;
}

export function ArticleLink({
  href,
  sourceName,
  source,
  title,
  publishedAt,
}: ArticleLinkProps) {
  const date = new Date(publishedAt);
  const timeStr = isNaN(date.getTime()) ? '未知' : date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <a
      href={safeHref(href)}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[15px] font-normal leading-snug text-white/90">
            {title}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-white/40">
            <span>{sourceName}</span>
            <span>·</span>
            <span>{timeStr}</span>
          </div>
        </div>
        <svg
          className="h-4 w-4 shrink-0 text-white/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </div>
    </a>
  );
}
