import express from 'express';
import { initUpload, uploadChunk } from '../controllers/uploadController.js';

const router = express.Router();

router.post('/init', initUpload);
router.post('/chunk', uploadChunk);

export default router;