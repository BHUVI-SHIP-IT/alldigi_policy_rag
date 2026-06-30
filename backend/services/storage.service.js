const Minio = require('minio');
require('dotenv').config();

const minioClient = new Minio.Client({
  endPoint: (process.env.MINIO_ENDPOINT || 'localhost').trim(),
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: (process.env.MINIO_USE_SSL || '').trim() === 'true',
  accessKey: (process.env.MINIO_ACCESS_KEY || 'minioadmin').trim(),
  secretKey: (process.env.MINIO_SECRET_KEY || 'minioadmin').trim(),
});

const BUCKET_NAME = 'policy-documents';

const initializeStorage = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`Bucket ${BUCKET_NAME} created successfully`);
    } else {
      console.log(`Bucket ${BUCKET_NAME} already exists`);
    }
  } catch (error) {
    console.error('Error initializing MinIO:', error);
  }
};

initializeStorage();

const uploadFile = async (objectName, filePath) => {
  try {
    await minioClient.fPutObject(BUCKET_NAME, objectName, filePath);
    console.log(`File ${objectName} uploaded successfully`);
    return true;
  } catch (error) {
    console.error('Error uploading to MinIO:', error);
    throw error;
  } c
};

const deleteFile = async (objectName) => {
  try {
    await minioClient.removeObject(BUCKET_NAME, objectName);
    console.log(`File ${objectName} deleted from MinIO successfully`);
    return true;
  } catch (error) {
    console.error('Error deleting from MinIO:', error);
    throw error;
  }
};

module.exports = {
  minioClient,
  uploadFile,
  deleteFile,
  BUCKET_NAME
};
