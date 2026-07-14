import { Response, NextFunction } from 'express';
import fs from 'fs';
import { DocumentModel } from '../models/DocumentFile';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// POST /api/documents  (multipart/form-data, field name "file")
export const uploadDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No file was uploaded', 400);

    const { meetingId, sharedWith } = req.body;

    // fileUrl is served statically from /uploads (see server.ts) - in
    // production this becomes the S3 object URL instead.
    const fileUrl = `/uploads/${req.file.filename}`;

    const doc = await DocumentModel.create({
      name: req.file.originalname,
      fileUrl,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.userId,
      meetingId: meetingId || undefined,
      sharedWith: sharedWith ? JSON.parse(sharedWith) : [],
    });

    res.status(201).json({ document: doc });
  } catch (err) {
    next(err);
  }
};

// GET /api/documents  -> documents owned by or shared with the current user
export const listDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const documents = await DocumentModel.find({
      $or: [{ uploadedBy: req.userId }, { sharedWith: req.userId }],
    })
      .populate('uploadedBy', 'name avatarUrl')
      .sort({ createdAt: -1 });

    res.status(200).json({ documents });
  } catch (err) {
    next(err);
  }
};

// GET /api/documents/:id
export const getDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doc = await DocumentModel.findById(req.params.id).populate('uploadedBy', 'name avatarUrl');
    if (!doc) throw new AppError('Document not found', 404);

    const canView =
      doc.uploadedBy._id.toString() === req.userId ||
      doc.sharedWith.some((id) => id.toString() === req.userId);
    if (!canView) throw new AppError('Forbidden', 403);

    res.status(200).json({ document: doc });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/documents/:id/share  { userIds: string[] }
export const shareDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) throw new AppError('userIds must be an array', 400);

    const doc = await DocumentModel.findById(req.params.id);
    if (!doc) throw new AppError('Document not found', 404);
    if (doc.uploadedBy.toString() !== req.userId) {
      throw new AppError('Only the uploader can change sharing', 403);
    }

    doc.sharedWith = Array.from(new Set([...doc.sharedWith.map(String), ...userIds])) as any;
    await doc.save();

    res.status(200).json({ document: doc });
  } catch (err) {
    next(err);
  }
};

// POST /api/documents/:id/sign  (multipart/form-data, field name "signature")
// Uploads a signature image (PNG from a <canvas> pad on the frontend) and
// links it to the document, moving it from draft -> signed.
export const signDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No signature image was uploaded', 400);

    const doc = await DocumentModel.findById(req.params.id);
    if (!doc) throw new AppError('Document not found', 404);

    const canSign =
      doc.uploadedBy.toString() === req.userId ||
      doc.sharedWith.some((id) => id.toString() === req.userId);
    if (!canSign) throw new AppError('Forbidden', 403);

    doc.signatureUrl = `/uploads/${req.file.filename}`;
    doc.signedBy = req.userId as any;
    doc.signedAt = new Date();
    doc.status = 'signed';
    await doc.save();

    res.status(200).json({ document: doc });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/documents/:id
export const deleteDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doc = await DocumentModel.findById(req.params.id);
    if (!doc) throw new AppError('Document not found', 404);
    if (doc.uploadedBy.toString() !== req.userId) {
      throw new AppError('Only the uploader can delete this document', 403);
    }

    // Best-effort local file cleanup (no-op / harmless once this is backed by S3)
    const localPath = `${__dirname}/../../uploads/${doc.fileUrl.split('/').pop()}`;
    fs.unlink(localPath, () => {});

    await doc.deleteOne();
    res.status(200).json({ message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
};
