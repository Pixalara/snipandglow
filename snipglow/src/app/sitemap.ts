import type { MetadataRoute } from 'next'
import blogPosts from '@/data/blog-posts.json'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://snipandglow.com'
  const now = new Date('2026-06-07')

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/refund`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // SEO landing pages - batch 1
  const seoPages1: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/salon-whatsapp-marketing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/spa-whatsapp-marketing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/salon-staff-scheduling`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/salon-membership-program`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/beauty-parlour-software-india`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
  ]

  // SEO resource pages - batch 2
  const seoPages2: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/best-salon-software-india`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/salon-software-pricing-india`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/whatsapp-appointment-booking-for-salons`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/salon-crm-software-india`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/salon-reminder-software`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
  ]

  // Blog posts
  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...seoPages1, ...seoPages2, ...blogPages]
}
