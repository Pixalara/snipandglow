import React, { useRef, useEffect } from 'react';

const inlineKeyframes = `
  @keyframes clippingRollOut {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0%);
    }
  }
`;

const PrimaryButton = ({ children }: { children: React.ReactNode }) => (
  <button style={{
    backgroundColor: '#00D084',
    color: '#080C14',
    borderRadius: '10px',
    padding: '10px 24px',
    fontWeight: 700,
    boxShadow: '0 4px 16px rgba(0,208,132,0.3)',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '16px'
  }}>
    {children}
  </button>
);

const GhostButton = ({ children }: { children: React.ReactNode }) => (
  <button style={{
    backgroundColor: 'transparent',
    border: '1px solid #1E2D45',
    color: '#64748B',
    borderRadius: '10px',
    padding: '10px 20px',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '16px',
    fontWeight: 600
  }}>
    {children}
  </button>
);

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(e => console.error("Video autoplay failed:", e));
    }
  }, []);

  return (
    <>
      <style>{inlineKeyframes}</style>
      <div className="relative flex" style={{ 
        width: '100%', 
        height: '400px', 
        borderRadius: '14px', 
        overflow: 'hidden',
        marginBottom: '28px'
      }}>
        {/* Video Background */}
        <video 
          ref={videoRef}
          autoPlay 
          loop 
          muted={true} 
          playsInline 
          className="absolute"
          style={{ width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
        
        {/* Visual Overlay */}
        <div 
          className="absolute z-10" 
          style={{ 
            top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(8, 12, 20, 0.6)' 
          }} 
        />
        
        {/* Content Box */}
        <div 
          className="relative z-20 flex flex-col justify-center items-center" 
          style={{ 
            width: '100%', 
            height: '100%', 
            padding: '20px 24px',
            textAlign: 'center'
          }}
        >
          <div style={{ overflow: 'hidden', paddingBottom: '2px', marginBottom: '12px' }}>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: '12px',
              color: '#00D084',
              letterSpacing: '0.1em',
              animation: 'clippingRollOut 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transform: 'translateY(100%)',
              animationDelay: '0s'
            }}>
              INDIA'S #1 WHATSAPP REVENUE ENGINE
            </div>
          </div>
          
          <div style={{ overflow: 'hidden', paddingBottom: '4px', margin: '0 0 16px 0' }}>
            <h1 style={{ 
              fontFamily: "'Syne', sans-serif", 
              fontWeight: 700, 
              fontSize: '48px', 
              color: '#F0F6FF',
              lineHeight: 1.1,
              margin: 0,
              animation: 'clippingRollOut 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transform: 'translateY(100%)',
              animationDelay: '0s'
            }}>
              STOP CHASING RENEWALS.
            </h1>
          </div>

          <div style={{ overflow: 'hidden', paddingBottom: '4px', margin: '0 0 32px 0', maxWidth: '600px' }}>
            <p style={{ 
              fontFamily: "'DM Sans', sans-serif", 
              fontWeight: 400, 
              fontSize: '18px', 
              color: '#94A3B8',
              margin: 0,
              animation: 'clippingRollOut 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transform: 'translateY(100%)',
              animationDelay: '0.2s'
            }}>
              Automate your member lifecycle. From D-3 reminders to instant WhatsApp invoices—engineered to scale your fitness business.
            </p>
          </div>

          <div style={{ overflow: 'hidden', paddingBottom: '8px' }}>
            <div style={{
              animation: 'clippingRollOut 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transform: 'translateY(100%)',
              animationDelay: '0.4s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <div className="flex" style={{ display: 'flex', gap: '16px' }}>
                <PrimaryButton>Automate My Gym</PrimaryButton>
                <GhostButton>Watch Demo</GhostButton>
              </div>
              
              {/* Trust Badge */}
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                color: '#64748B',
                marginTop: '16px'
              }}>
                ✓ 7-Day Free Trial &nbsp; • &nbsp; ✓ No Credit Card &nbsp; • &nbsp; ✓ Setup in 2 Mins
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
