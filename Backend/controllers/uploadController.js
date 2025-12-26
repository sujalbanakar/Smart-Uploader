import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import yauzl from 'yauzl';
import { fileURLToPath } from 'url';
import Upload from '../models/Upload.js';
import Chunk from '../models/Chunk.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// INIT
export const initUpload = async (req, res) => {

  const { fileName, fileSize, totalChunks, uploadId } = req.body;
  const filePath = path.join(UPLOAD_DIR, uploadId);

  try {
    let upload = await Upload.findOne({ uploadId });

    if (!upload) {
      upload = await Upload.create({
        uploadId,
        fileName: fileName,     
        fileSize: fileSize,    
        totalChunks: totalChunks,
        status: 'UPLOADING'     
      });
      
      fs.closeSync(fs.openSync(filePath, 'w'));
    }

   const existingChunks = await Chunk.find({ uploadId: upload._id });
const uploadedIndices = existingChunks.map(c => c.chunkIndex);

    res.json({ 
      message: "Initialized", 
      uploadedIndices: uploadedIndices 
    });

  } catch (err) {
    console.error("Init Error:", err); 
    res.status(500).json({ error: "Database Init Failed", details: err.message });
  }
};

// CHUNK UPLOAD
export const uploadChunk = async (req, res) => {
  const { uploadid, index } = req.headers; 
  const chunkIndexVal = parseInt(index);   
  const filePath = path.join(UPLOAD_DIR, uploadid);
  const CHUNK_SIZE = 5 * 1024 * 1024; 

  try {
    const upload = await Upload.findOne({ uploadId: uploadid });
    if (!upload) return res.status(404).send("Upload session not found");

    const fd = fs.openSync(filePath, 'r+');
    const buffer = req.body; 
    const offset = chunkIndexVal * CHUNK_SIZE;

    fs.write(fd, buffer, 0, buffer.length, offset, async (err) => {
      fs.closeSync(fd);
      if (err) return res.status(500).send("Disk Write Error");

      try {
        await Chunk.findOneAndUpdate(
         
          { uploadId: upload._id, chunkIndex: chunkIndexVal }, 
          { status: 'STORED', received_at: new Date() },
          { upsert: true, new: true }
        );
        res.send("Chunk Uploaded");
      } catch (dbErr) {
        console.error(dbErr);
        res.status(500).send("DB Error");
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Upload Failed");
  }
};

// COMPLETE UPLOAD
export const completeUpload = async (req, res) => {
    const { uploadId } = req.body;
    const filePath = path.join(UPLOAD_DIR, uploadId);

    try {
        const upload = await Upload.findOneAndUpdate(
            { uploadId: uploadId, status: 'UPLOADING' },
            { $set: { status: 'PROCESSING' } },
            { new: true }
        );

        if (!upload) {
            const existing = await Upload.findOne({ uploadId });
            if (existing && existing.status === 'COMPLETED') {
                return res.json({ status: "Completed", hash: existing.final_hash });
            }
            return res.status(400).send("Invalid State");
        }

        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hex = hashSum.digest('hex');

        const filesInside = [];
        if (upload.fileName.endsWith('.zip')) { 
            await new Promise((resolve) => {
                yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
                    if (err) return resolve();
                    zipfile.readEntry();
                    zipfile.on('entry', (entry) => {
                        filesInside.push(entry.fileName);
                        zipfile.readEntry();
                    });
                    zipfile.on('end', resolve);
                });
            });
        }

        upload.status = 'COMPLETED';
        upload.final_hash = hex;
        await upload.save();

        const finalPath = path.join(UPLOAD_DIR, `final-${upload.fileName}`);
        if(fs.existsSync(filePath)) fs.renameSync(filePath, finalPath);

        res.json({ 
            status: "Completed", 
            hash: hex, 
            files: filesInside.slice(0, 5) 
        });

    } catch (err) {
        await Upload.updateOne({ uploadId }, { status: 'FAILED' });
        console.error(err);
        res.status(500).json({ error: "Finalization failed" });
    }
};