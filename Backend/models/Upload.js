import mongoose from 'mongoose';

const uploadSchema = new mongoose.Schema({
  uploadId: { type: String, required: true, unique: true },
  fileName: { type: String, required: true }, 
  fileSize: { type: Number, required: true }, 
  totalChunks: { type: Number, required: true },
  
  status: { 
    type: String, 
    enum: ['UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED'], 
    default: 'UPLOADING' 
  },
  
  final_hash: { type: String, default: null }
}, { timestamps: true });

export default mongoose.model('Upload', uploadSchema);