import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import posts from '@/data/blog-posts.json';

export default function BlogListing() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Salon Growth Blog & Resources | SnipandGlow";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', "Read the latest tips, guides, and strategies for growing your salon, spa, or beauty business in India.");
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif" }}>
      {/* Simple Header */}
      <header style={{ padding: '20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div 
          onClick={() => navigate('/')} 
          style={{ cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          Snip &amp; Glow <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#E11D48' }} />
        </div>
        <button 
          onClick={() => navigate('/signup')}
          style={{ padding: '8px 16px', backgroundColor: '#E11D48', color: '#FFFFFF', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
        >
          Start Free Trial
        </button>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '42px', fontWeight: '900', color: '#0F172A', marginBottom: '16px' }}>
            Salon Growth <span style={{ color: '#E11D48' }}>Blog</span>
          </h1>
          <p style={{ fontSize: '18px', color: '#64748B', maxWidth: '600px', margin: '0 auto' }}>
            Actionable strategies, marketing tips, and automation guides to help your Indian salon thrive in 2026.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '32px' }}>
          {posts.map((post) => (
            <Link 
              to={`/blog/${post.slug}`} 
              key={post.id} 
              style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', backgroundColor: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', transition: 'transform 0.2s', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ height: '200px', width: '100%', position: 'relative' }}>
                <img 
                  src={post.image} 
                  alt={post.title} 
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '500', marginBottom: '8px' }}>
                  {new Date(post.date).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '700', color: '#0F172A', marginBottom: '12px', lineHeight: '1.4' }}>
                  {post.title}
                </h2>
                <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', marginBottom: '20px', flexGrow: 1 }}>
                  {post.excerpt}
                </p>
                <span style={{ color: '#E11D48', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Read Article →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
