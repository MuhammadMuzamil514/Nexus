import { Router } from 'express';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  shareDocument,
  signDocument,
  deleteDocument,
} from '../controllers/documentController';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(protect); // every document route requires auth

/**
 * @swagger
 * /documents:
 *   post:
 *     summary: Upload a document
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               meetingId: { type: string, description: Optional - link this doc to a meeting }
 *     responses:
 *       201: { description: "Returns the document" }
 *   get:
 *     summary: List documents you own or that are shared with you
 *     tags: [Documents]
 *     responses:
 *       200: { description: "Returns the list of documents" }
 */
router.post('/', upload.single('file'), uploadDocument);
router.get('/', listDocuments);

/**
 * @swagger
 * /documents/{id}:
 *   get:
 *     summary: Get a single document (owner or shared-with only)
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "Returns the document" }
 *   delete:
 *     summary: Delete a document (owner only)
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Document deleted }
 */
router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);

/**
 * @swagger
 * /documents/{id}/share:
 *   patch:
 *     summary: Share a document with other users (owner only)
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userIds]
 *             properties:
 *               userIds: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Returns the updated document }
 */
router.patch('/:id/share', shareDocument);

/**
 * @swagger
 * /documents/{id}/sign:
 *   post:
 *     summary: Attach an e-signature image, marking the document as signed
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               signature: { type: string, format: binary, description: PNG exported from a signature pad }
 *     responses:
 *       200: { description: Returns the updated (now signed) document }
 */
router.post('/:id/sign', upload.single('signature'), signDocument);

export default router;
