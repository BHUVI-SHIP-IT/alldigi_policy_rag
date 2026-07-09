const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('../services/db.service');
const { uploadFile } = require('../services/storage.service');

const router = express.Router();

// Configure multer for temporary local storage before moving to MinIO
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only PDF, DOCX, and TXT are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB
});

router.post('/upload', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Switch to SSE so we can stream progress back in real time
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders();

  const emit = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const file = req.file;
  const objectName = file.filename;

  try {
    // Phase 1 — save to MinIO
    emit({ phase: 'uploading', pct: 5, message: 'Saving file to storage...' });
    await uploadFile(objectName, file.path);
    emit({ phase: 'uploading', pct: 25, message: 'File saved to storage.' });

    // Phase 2 — record in Postgres
    emit({ phase: 'uploading', pct: 30, message: 'Recording document metadata...' });
    const result = await db.query(
      'INSERT INTO documents (filename, object_name, status) VALUES ($1, $2, $3) RETURNING *',
      [file.originalname, objectName, 'processing']
    );
    const documentId = result.rows[0].id;
    emit({ phase: 'saved', pct: 35, message: 'Metadata recorded.', documentId });

    // Phase 3 — process (extract → embed → index) with progress callback
    const { processDocument } = require('../services/rag.service');
    await processDocument(file.path, file.mimetype, documentId, (progress) => {
      emit(progress);
    }, file.originalname);

    // Phase 4 — finalise
    await db.query('UPDATE documents SET status = $1 WHERE id = $2', ['processed', documentId]);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    emit({ phase: 'done', pct: 100, message: 'Document indexed and ready!', documentId });
    res.end();
  } catch (error) {
    console.error('Upload/processing error:', error);
    emit({ phase: 'error', pct: 0, message: error.message || 'Processing failed.' });
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.end();
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM documents ORDER BY upload_date DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch document details to get the object_name
    const result = await db.query('SELECT * FROM documents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = result.rows[0];

    // Delete from MinIO
    const { deleteFile } = require('../services/storage.service');
    await deleteFile(doc.object_name);

    // Delete from Qdrant
    const { deleteDocumentChunks } = require('../services/rag.service');
    await deleteDocumentChunks(id);

    // Delete from Postgres
    await db.query('DELETE FROM documents WHERE id = $1', [id]);

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
