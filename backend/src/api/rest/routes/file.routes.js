import { Router } from 'express';
import { upload } from '../middleware/upload.middleware.js';
import * as fileController from '../controllers/file.controller.js';

export const fileRoutes = Router();


fileRoutes.post('/:cardId/attachments', upload.single('file'), fileController.uploadAttachment)
fileRoutes.get('/:cardId/attachments', fileController.getAttachments)
fileRoutes.get('/:cardId/attachments/:attachmentId', fileController.downloadAttachment)
fileRoutes.delete('/:cardId/attachments/:attachmentId', fileController.deleteAttachment)
