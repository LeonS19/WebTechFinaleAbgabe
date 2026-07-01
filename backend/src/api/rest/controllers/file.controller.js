import * as fileService from '../../../services/file.service.js';

export async function uploadAttachment(req, res) {
  const cardId = req.params.cardId
  const file = req.file
  const userId = req.user.userId

  try {
    const attachment = await fileService.uploadAttachment(cardId, file, userId);
    return res.status(201).json(attachment);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function getAttachments(req, res) {
    const cardId = req.params.cardId
    try {
        const attachment = await fileService.getAttachments(cardId);
        return res.status(200).json(attachment);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
}

export async function downloadAttachment(req, res) {
    const cardId = req.params.cardId
    const attachmentId = req.params.attachmentId
    try {
        const attachment = await fileService.getAttachment(cardId, attachmentId)
        return res.download(attachment.file_path, attachment.filename)
    } catch (err) {
        return res.status(404).json({ error: err.message });
    }
}

export async function deleteAttachment(req, res) {
    const cardId = req.params.cardId
    const attachmentId = req.params.attachmentId
    const userId = req.user.userId

    try {
        await fileService.deleteAttachment(cardId, attachmentId, userId)
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
}