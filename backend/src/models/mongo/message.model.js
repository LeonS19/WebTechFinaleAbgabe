import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chat_id: {type: String, required: true},
  sender_id: {type: String, required: true},
  content: {type: String, required: true},
},{
    timestamps: { createdAt: 'sent_at', updatedAt: false }   // timestamps: Mongoose setzt created_at

});

export const Message = mongoose.model('message', messageSchema);