import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import blogPosts from '@/data/blog-posts.json';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: post.metaTitle,
    description: post.metaDescription,
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      images: [{ url: post.image, width: 1200, height: 630 }],
      type: 'article',
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) notFound();

  return (
    <article className="max-w-3xl mx-auto">
      <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-pink-600 hover:text-pink-700 mb-6 transition-colors">
        ← Back to Blog
      </Link>

      <img
        src={post.image}
        alt={post.title}
        className="w-full aspect-[2/1] object-cover rounded-2xl mb-8"
      />

      <p className="text-sm text-slate-400 mb-4">
        {new Date(post.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
      </p>

      <div
        className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-p:leading-relaxed prose-li:leading-relaxed prose-a:text-pink-600 prose-a:no-underline hover:prose-a:underline"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}
