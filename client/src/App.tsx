import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#f8fafc',
    }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        LECSTU
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#94a3b8', marginBottom: '2rem' }}>
        AI-Integrated Academic Platform
      </p>
      <div style={{
        padding: '1rem 2rem',
        background: 'rgba(34, 197, 94, 0.15)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '0.5rem',
        color: '#4ade80',
        fontSize: '0.9rem',
      }}>
        Phase 1.1 Complete — Dev Environment Running
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
