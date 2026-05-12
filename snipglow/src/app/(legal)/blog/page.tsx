import type { Metadata } from 'next';
import Link from 'next/link';
import blogPosts from '@/data/blog-posts.json';

export const metadata: Metadata = {
  title: 'Blog — Salon Management Tips & Guides',
  description: 'Expert tips on salon management, WhatsApp automation, appointment booking, and growing your salon business in India.',
};

export default function BlogPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Blog</h1>
        <p className="text-slate-500 mt-2">Expert tips on salon management, WhatsApp automation, and growing your business.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {blogPosts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all"
          >
            <div className="aspect-[16/9] overflow-hidden">
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-400">{new Date(post.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <h2 className="text-base font-semibold text-slate-900 group-hover:text-pink-600 transition-colors line-clamp-2">
                {post.title}
              </h2>
              <p className="text-sm text-slate-500 line-clamp-2">{post.excerpt}</p>
              <span className="inline-flex items-center text-xs font-medium text-pink-600">
                Read more →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
