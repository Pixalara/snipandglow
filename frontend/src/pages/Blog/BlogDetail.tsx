import { useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import posts from '@/data/blog-posts.json';
import './BlogDetail.css';

export default function BlogDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const post = posts.find(p => p.slug === slug);

  useEffect(() => {
    if (post) {
      document.title = post.metaTitle;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', post.metaDescription);
      }
    }
  }, [post]);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

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
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button 
            onClick={() => navigate('/blog')}
            style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
          >
            All Articles
          </button>
          <button 
            onClick={() => navigate('/signup')}
            style={{ padding: '8px 16px', backgroundColor: '#E11D48', color: '#FFFFFF', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
          >
            Start Free Trial
          </button>
        </div>
      </header>

      <article style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 20px', backgroundColor: '#FFFFFF', borderRadius: '16px', marginTop: '40px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <button 
          onClick={() => navigate('/blog')} 
          style={{ background: 'none', border: 'none', color: '#E11D48', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginBottom: '24px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          ← Back to Blog
        </button>

        <img 
          src={post.image} 
          alt={post.title} 
          style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '12px', marginBottom: '40px' }} 
        />

        <div className="blog-content" dangerouslySetInnerHTML={{ __html: post.content }} />
        
        {/* Author Bio / Bottom CTA */}
        <div style={{ marginTop: '60px', paddingTop: '40px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: '800', color: '#0F172A', marginBottom: '16px' }}>Ready to Automate Your Salon?</h3>
          <p style={{ fontSize: '16px', color: '#475569', marginBottom: '24px', maxWidth: '500px' }}>Join hundreds of Indian salon owners who save time and increase revenue with SnipandGlow's WhatsApp automation.</p>
          <button 
            onClick={() => navigate('/signup')}
            style={{ padding: '12px 24px', backgroundColor: '#E11D48', color: '#FFFFFF', borderRadius: '8px', fontSize: '16px', fontWeight: '700', border: 'none', cursor: 'pointer' }}
          >
            Start 14-Day Free Trial
          </button>
        </div>
      </article>
      
      {/* Footer buffer */}
      <div style={{ height: '80px' }} />
    </div>
  );
}
