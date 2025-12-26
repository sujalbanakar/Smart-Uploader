import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = './uploads';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 Hours

fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return;
    const now = Date.now();

    files.forEach(file => {
        const filePath = path.join(UPLOAD_DIR, file);
        fs.stat(filePath, (err, stats) => {
            if (err) return;
            
            if (now - stats.mtimeMs > MAX_AGE_MS && !file.startsWith('final-')) {
                fs.unlink(filePath, () => console.log(`Deleted orphan: ${file}`));
            }
        });
    });
});