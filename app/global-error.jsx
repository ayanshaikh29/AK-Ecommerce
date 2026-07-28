'use client'

import React from 'react'

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0b0f19', color: '#fff', display: 'flex', alignItems: 'center', justify: 'center', minHeight: '100vh', padding: '24px' }}>
        <div style={{ maxWidth: '440px', width: '100%', background: '#131927', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '40px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justify: 'center', margin: '0 auto 20px', color: '#ef4444', fontSize: '28px' }}>
            ⚠️
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', margin: 0 }}>
            Critical Error Caught
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5', marginBottom: '28px' }}>
            A system-level error occurred in the root layout. You can safely recover below.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => reset()}
              style={{ background: 'linear-[#F5B52D,#E59A00]', backgroundColor: '#f59e0b', color: '#000', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '12px 20px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
            >
              Go to Home
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
