import { IndexCard } from '../models/mongo/indexCard.model.js';
import { checkPermission } from './permission.service.js';


export async function uploadAttachment(cardId, file, userId){
    const card = await IndexCard.findById(cardId);
    if(!card){
        throw new Error("Karteikarte nicht gefunden");
    }

    await checkPermission(userId, card.study_group_id, ['ADMIN', 'MODERATOR'])

    card.attachments.push({
        filename: file.originalname,
        file_path: file.path,
        mime_type: file.mimetype,
        size_in_bytes: file.size,
        uploaded_by: userId,
    });

    await card.save();
    return card.attachments[card.attachments.length -1];
}

export async function getAttachments(cardId, userId) {
    const card = await IndexCard.findById(cardId);
    if (!card) {
        throw new Error("Karteikarte nicht gefunden");
    }

    await checkPermission(userId, card.study_group_id, ['ADMIN', 'MODERATOR', 'MEMBER']);
    return card.attachments;
}

export async function getAttachment(cardId, attachmentId, userId) {
    const card = await IndexCard.findById(cardId);
    if (!card) {
        throw new Error("Karteikarte nicht gefunden");
    }

    await checkPermission(userId, card.study_group_id, ['ADMIN', 'MODERATOR', 'MEMBER']);
    const attachment = card.attachments.id(attachmentId);
    if (!attachment) {
        throw new Error("Anhang nicht gefunden");
    }

    return attachment;
}

export async function deleteAttachment(cardId, attachmentId, userId) {
    const card = await IndexCard.findById(cardId);
    if(!card){
        throw new Error("Karteikarte nicht gefunden");
    }

    const attachment = card.attachments.id(attachmentId);
    if (!attachment){
        throw new Error("Anhang nicht gefunden");
    }

    await checkPermission(userId, card.study_group_id, ['ADMIN', 'MODERATOR'])

    attachment.deleteOne();
    await card.save()
}