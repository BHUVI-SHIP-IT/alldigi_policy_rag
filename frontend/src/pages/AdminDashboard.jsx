import React, { useState, useEffect, useRef, useCallback } from 'react';
import useAuthStore from '../store/useAuthStore';
import { UploadCloud, Trash2, FileText, Database, Activity, LogOut, Sun, Moon, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import logo from '../assets/logo.png';
import useThemeStore from '../store/useThemeStore';
import './AdminDashboard.css';

const PHASE_LABELS = {
  uploading:  'Saving to storage',
  saved:      'Metadata recorded',
  extracting: 'Extracting text',
  chunking:   'Splitting into chunks',
  embedding:  'Generating embeddings',
  indexing:   'Indexing to vector DB',
  done:       'Complete!',
  error:      'Error',
};

const PHASE_ORDER   = ['uploading', 'saved', 'extracting', 'chunking', 'embedding', 'indexing', 'done'];
const VISIBLE_STEPS = ['uploading', 'extracting', 'embedding', 'indexing', 'done'];

const AdminDashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const { token, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const fileInputRef = useRef(null);

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/docs', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDocuments(await res.json());
    } catch (e) { console.error(e); }
  }, [token]);

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress({ phase: 'uploading', pct: 2, message: 'Connecting...' });

    const formData = new FormData();
    formData.append('document', file);

    try {
      const res = await fetch('/api/docs/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        setUploadProgress({ phase: 'error', pct: 0, message: 'Upload failed.' });
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const eventText = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (eventText.startsWith('data: ')) {
            try {
              const data = JSON.parse(eventText.slice(6));
              setUploadProgress(data);
              if (data.phase === 'done') fetchDocuments();
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error(err);
      setUploadProgress({ phase: 'error', pct: 0, message: 'Network error. Please try again.' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadProgress(null), 4000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document from all databases?')) return;
    try {
      const res = await fetch(`/api/docs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDocuments(documents.filter(d => d.id !== id));
      else alert('Failed to delete document');
    } catch { alert('Error deleting document'); }
  };

  const currentPhaseIdx = uploadProgress ? PHASE_ORDER.indexOf(uploadProgress.phase) : -1;

  return (
    <div className="admin-layout">
      <div className="admin-sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="AllDigi Logo" className="sidebar-logo" />
          <h2>Admin Portal</h2>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-item active"><Database size={18} /> Knowledge Base</button>
          <button className="nav-item"><Activity size={18} /> System Analytics</button>
        </nav>
        <div className="sidebar-footer">
          <button onClick={toggleTheme} className="nav-item">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={logout} className="nav-item text-error"><LogOut size={18} /> Logout</button>
        </div>
      </div>

      <div className="admin-main">
        <header className="admin-header">
          <h1>Knowledge Base Management</h1>
          <p>Upload and manage the company policies that power the AI assistant.</p>
        </header>

        <div className="stats-row">
          <div className="stat-card">
            <FileText size={24} color="var(--accent-color)" />
            <div className="stat-info"><h3>{documents.length}</h3><p>Total Documents</p></div>
          </div>
          <div className="stat-card">
            <Database size={24} color="#3b82f6" />
            <div className="stat-info">
              <h3>{documents.filter(d => d.status === 'processed').length}</h3>
              <p>Indexed &amp; Ready</p>
            </div>
          </div>
        </div>

        {/* ── Real-time Upload Progress Card ── */}
        {uploadProgress && (
          <div className={`upload-progress-card${uploadProgress.phase === 'error' ? ' is-error' : ''}${uploadProgress.phase === 'done' ? ' is-done' : ''}`}>
            <div className="upload-progress-header">
              <div className="upload-progress-icon">
                {uploadProgress.phase === 'done'  && <CheckCircle size={20} />}
                {uploadProgress.phase === 'error' && <AlertCircle size={20} />}
                {uploadProgress.phase !== 'done' && uploadProgress.phase !== 'error' && <Loader size={20} className="spin" />}
              </div>
              <div className="upload-progress-text">
                <span className="upload-phase-label">{PHASE_LABELS[uploadProgress.phase] ?? uploadProgress.phase}</span>
                <span className="upload-phase-message">{uploadProgress.message}</span>
              </div>
              {uploadProgress.phase === 'embedding' && uploadProgress.total > 0 && (
                <span className="upload-chunk-counter">{uploadProgress.chunk} / {uploadProgress.total} chunks</span>
              )}
              <span className="upload-pct">{uploadProgress.pct}%</span>
            </div>

            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${uploadProgress.pct}%` }} />
            </div>

            <div className="upload-phases-row">
              {VISIBLE_STEPS.map((step) => {
                const stepIdx  = PHASE_ORDER.indexOf(step);
                const isPast   = currentPhaseIdx > stepIdx;
                const isActive = currentPhaseIdx === stepIdx || (step === 'uploading' && currentPhaseIdx <= 1);
                return (
                  <div key={step} className={`phase-step${isPast ? ' done' : ''}${isActive ? ' active' : ''}`}>
                    <div className="phase-dot" />
                    <span>{PHASE_LABELS[step]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Document Library ── */}
        <div className="content-card">
          <div className="card-header">
            <h2>Document Library</h2>
            <div className="upload-container">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".pdf,.docx,.txt" />
              <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                <UploadCloud size={18} />
                {isUploading ? 'Processing...' : 'Upload Document'}
              </button>
            </div>
          </div>

          <table className="documents-table">
            <thead>
              <tr><th>ID</th><th>File Name</th><th>Status</th><th>Upload Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-4 text-muted">No documents found. Upload one to get started.</td></tr>
              ) : documents.map(doc => (
                <tr key={doc.id}>
                  <td>#{doc.id}</td>
                  <td><div className="file-name-cell"><FileText size={16} /> {doc.filename}</div></td>
                  <td><span className={`status-badge status-${doc.status}`}>{doc.status}</span></td>
                  <td>{new Date(doc.upload_date).toLocaleString()}</td>
                  <td>
                    <button onClick={() => handleDelete(doc.id)} className="btn-icon text-error" title="Delete Document">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
