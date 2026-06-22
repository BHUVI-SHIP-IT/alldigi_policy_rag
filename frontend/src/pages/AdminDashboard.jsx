import React, { useState, useEffect, useRef, useCallback } from 'react';
import useAuthStore from '../store/useAuthStore';
import { UploadCloud, Trash2, FileText, Database, Activity, LogOut } from 'lucide-react';
import logo from '../assets/logo.png';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const { token, logout } = useAuthStore();
  const fileInputRef = useRef(null);

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/docs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      } else {
        console.error('Failed to fetch documents:', res.status, await res.text());
      }
    } catch (e) {
      console.error('Network error fetching documents:', e);
    }
  }, [token]);

  useEffect(() => {
    fetchDocuments();
    // Poll for status updates every 5 seconds
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Uploading...');

    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await fetch('/api/docs/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        setUploadStatus('File uploaded! Processing...');
        fetchDocuments(); // Refresh list immediately
      } else {
        setUploadStatus('Upload failed.');
      }
    } catch (error) {
      setUploadStatus('Network error.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document? This will remove it from all databases.')) return;
    
    try {
      const res = await fetch(`/api/docs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setDocuments(documents.filter(doc => doc.id !== id));
      } else {
        alert('Failed to delete document');
      }
    } catch (e) {
      alert('Error deleting document');
    }
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="AllDigi Logo" className="sidebar-logo" />
          <h2>Admin Portal</h2>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-item active">
            <Database size={18} /> Knowledge Base
          </button>
          <button className="nav-item">
            <Activity size={18} /> System Analytics
          </button>
        </nav>
        <div className="sidebar-footer">
          <button onClick={logout} className="nav-item text-error">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main">
        <header className="admin-header">
          <h1>Knowledge Base Management</h1>
          <p>Upload and manage the company policies that power the AI assistant.</p>
        </header>

        <div className="stats-row">
          <div className="stat-card">
            <FileText size={24} color="var(--accent-color)" />
            <div className="stat-info">
              <h3>{documents.length}</h3>
              <p>Total Documents</p>
            </div>
          </div>
          <div className="stat-card">
            <Database size={24} color="#3b82f6" />
            <div className="stat-info">
              <h3>{documents.filter(d => d.status === 'processed').length}</h3>
              <p>Indexed & Ready</p>
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="card-header">
            <h2>Document Library</h2>
            <div className="upload-container">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                accept=".pdf,.docx,.txt"
              />
              <button 
                className="btn-primary" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <UploadCloud size={18} /> 
                {isUploading ? 'Uploading...' : 'Upload Document'}
              </button>
              {uploadStatus && <span className="upload-status">{uploadStatus}</span>}
            </div>
          </div>

          <table className="documents-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>File Name</th>
                <th>Status</th>
                <th>Upload Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">No documents found. Upload one to get started.</td>
                </tr>
              ) : (
                documents.map(doc => (
                  <tr key={doc.id}>
                    <td>#{doc.id}</td>
                    <td>
                      <div className="file-name-cell">
                        <FileText size={16} /> {doc.filename}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${doc.status}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td>{new Date(doc.upload_date).toLocaleString()}</td>
                    <td>
                      <button 
                        onClick={() => handleDelete(doc.id)} 
                        className="btn-icon text-error"
                        title="Delete Document"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
