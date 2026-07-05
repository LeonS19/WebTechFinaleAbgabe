import * as fileService from "../../../services/file.service.js";
import { IndexCard } from "../../../models/mongo/indexCard.model.js";
import { pubsub } from "../../../graphql/pubsub.js";
import { mapCard } from "../../../graphql/resolvers/indexCard.resolver.js";

export async function uploadAttachment(req, res) {
  const cardId = req.params.cardId;
  const file = req.file;
  const userId = req.user.userId;

  try {
    const attachment = await fileService.uploadAttachment(cardId, file, userId);
    const updatedCard = await IndexCard.findById(cardId);
    pubsub.publish("INDEX_CARD_UPDATED", {
      onIndexCardUpdated: mapCard(updatedCard),
      studyGroupId: updatedCard.study_group_id,
    });

    return res.status(201).json({
      id: attachment._id.toString(),
      filename: attachment.filename,
      mimeType: attachment.mime_type,
      sizeInBytes: attachment.size_in_bytes,
      uploadedAt: attachment.uploaded_at,
      uploadedBy: attachment.uploaded_by,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function getAttachments(req, res) {
  const cardId = req.params.cardId;
  try {
    const attachment = await fileService.getAttachments(cardId);
    return res.status(200).json(attachment);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function downloadAttachment(req, res) {
  const cardId = req.params.cardId;
  const attachmentId = req.params.attachmentId;
  try {
    const attachment = await fileService.getAttachment(cardId, attachmentId);
    return res.download(attachment.file_path, attachment.filename);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
}

export async function deleteAttachment(req, res) {
  const cardId = req.params.cardId;
  const attachmentId = req.params.attachmentId;
  const userId = req.user.userId;

  try {
    await fileService.deleteAttachment(cardId, attachmentId, userId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
