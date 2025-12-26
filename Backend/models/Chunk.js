import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
  uploadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Upload', required: true },
  chunkIndex: { type: Number, required: true },
  status: { type: String, default: 'STORED' },
  received_at: { type: Date, default: Date.now }
});
chunkSchema.index({ uploadId: 1, chunkIndex: 1 }, { unique: true });

export default mongoose.model('Chunk', chunkSchema);