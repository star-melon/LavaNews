
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArticleLink } from '@/components/article-link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;

  const group = await prisma.eventGroup.findUnique({
    where: { id },
    include: {
      articles: {
        orderBy: { publishedAt: 'desc' },
      },
    },
  });

  if (!group) {
    notFound();
  }

  const sources = [...new Set(group.articles.map((a) => a.source))];

  return (
    <div>
      {/* Event Header — Black background */}
      <section className="bg-apple-black py-12 px-4">
        <div className="max-w-apple-content mx-auto">
          <Link
            href="/"
            className="apple-pill-link mb-6 inline-block text-[14px]"
          >
            ← 返回首页
          </Link>

          <div className="mb-4 flex items-center gap-3">
            <span className="apple-source-count text-lg">{group.sourceCount}</span>
            <span className="text-[14px] text-white/60">家信源 · {group.articleCount} 篇文章</span>
          </div>

          <h1 className="apple-headline mb-4 text-3xl sm:text-4xl text-white">
            {group.representativeTitle}
          </h1>

          <p className="text-[14px] text-white/40">
            首次发现：{group.firstSeen.toLocaleString('zh-CN')} · 最后更新：{group.lastUpdated.toLocaleString('zh-CN')}
          </p>
        </div>
      </section>

      {/* Articles List — Dark surface */}
      <section className="bg-apple-dark-surface py-12 px-4">
        <div className="max-w-apple-content mx-auto">
          <h2 className="apple-section-heading mb-6 text-xl text-white/80">
            报道来源
          </h2>

          {/* Source badges */}
          <div className="mb-8 flex flex-wrap gap-2">
            {sources.map((source) => (
              <span key={source} className="apple-source-badge text-[13px]">
                {source}
              </span>
            ))}
          </div>

          {/* Article list */}
          <div className="grid gap-3 sm:grid-cols-2">
            {group.articles.map((article) => (
              <ArticleLink
                key={article.id}
                href={article.url}
                sourceName={article.sourceName}
                source={article.source}
                title={article.title}
                publishedAt={article.publishedAt.toISOString()}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
