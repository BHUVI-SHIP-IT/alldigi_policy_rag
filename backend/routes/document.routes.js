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

const upload = multer({ storage });

router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const objectName = file.filename;

    // 1. Upload to MinIO
    await uploadFile(objectName, file.path);

    // 2. Save metadata to Postgres
    const result = await db.query(
      'INSERT INTO documents (filename, object_name, status) VALUES ($1, $2, $3) RETURNING *',
      [file.originalname, objectName, 'uploaded']
    );

    const documentId = result.rows[0].id;

    // 3. Clean up local temp file - wait, we need it for extraction!
    // Instead of deleting it here, we process it, then delete it.
    res.json({ message: 'File uploaded successfully. Processing started.', document: result.rows[0] });

    // Trigger async embedding extraction job
    const { processDocument } = require('../services/rag.service');
    processDocument(file.path, file.mimetype, documentId).then(async () => {
       await db.query('UPDATE documents SET status = $1 WHERE id = $2', ['processed', documentId]);
       fs.unlinkSync(file.path);
    }).catch(async (err) => {
       console.error(err);
       await db.query('UPDATE documents SET status = $1 WHERE id = $2', ['error', documentId]);
       if(fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
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
