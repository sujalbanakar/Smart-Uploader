import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  UploadCloud, 
  File, 
  CheckCircle2, 
  X, 
  Play, 
  Clock, 
  Zap, 
  Database,
  Home
} from 'lucide-react';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatTime = (seconds) => {
  if (!seconds || seconds === Infinity) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
};

const SmartUploader = () => {
  const [file, setFile] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [uploadStats, setUploadStats] = useState({ speed: 0, eta: null });
  const [isDragging, setIsDragging] = useState(false);
  
  const activeUploads = useRef(0);
  const startTimeRef = useRef(null);
  const previousUploadedBytesRef = useRef(0);
  const fileInputRef = useRef(null);

  const completedChunks = chunks.filter(c => c.status === 'success').length;
  const totalChunks = chunks.length;
  const progressPercent = totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0;
  const uploadedBytes = file ? Math.min(completedChunks * CHUNK_SIZE, file.size) : 0;

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setChunks([]);
    setUploadStats({ speed: 0, eta: null });
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const startUpload = async () => {
    if (!file) return;

    startTimeRef.current = Date.now();
    previousUploadedBytesRef.current = 0; 

    const uploadId = `${file.name}-${file.size}-${Date.now()}`;
    const totalChunksCount = Math.ceil(file.size / CHUNK_SIZE);

    try {
      const { data } = await axios.post('http://localhost:5000/api/upload/init', {
        fileName: file.name,
        fileSize: file.size,
        totalChunks: totalChunksCount,
        uploadId
      });

      const uploadedSet = new Set(data.uploadedIndices);
      const chunkArray = Array.from({ length: totalChunksCount }, (_, i) => ({
        index: i,
        status: uploadedSet.has(i) ? 'success' : 'pending'
      }));
      setChunks(chunkArray);
      

      previousUploadedBytesRef.current = uploadedSet.size * CHUNK_SIZE;

      processQueue(chunkArray, uploadId);
    } catch (error) {
      console.error("Init failed", error);
    }
  };

  const processQueue = async (allChunks, uploadId) => {
    const pending = allChunks.filter(c => c.status === 'pending');

    while (pending.length > 0 || activeUploads.current > 0) {
      if (activeUploads.current < 3 && pending.length > 0) { 
        const chunk = pending.shift();
        uploadChunk(chunk, uploadId);
      }
      await new Promise(r => setTimeout(r, 100));
    }
  };
   
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const uploadChunk = async (chunk, uploadId) => {
   activeUploads.current++;
    updateStatus(chunk.index, 'uploading');

    const start = chunk.index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);

    let attempts = 0;
    const maxRetries = 3;

    while (attempts <= maxRetries) {
      try {
        await axios.post('http://localhost:5000/api/upload/chunk', blob, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'uploadId': uploadId,
            'index': chunk.index
          }
        });
        
        // Success
        updateStatus(chunk.index, 'success');
        calculateMetrics();
        break; 

      } catch (err) {
        attempts++;
        console.warn(`Chunk ${chunk.index} failed. Attempt ${attempts}/${maxRetries}`);

        if (attempts > maxRetries) {
          updateStatus(chunk.index, 'error');
          console.error(err);
        } else {
          const delay = 1000 * Math.pow(2, attempts - 1);
          await wait(delay);
        }
      }
    }
    
    activeUploads.current--;
  };

  const updateStatus = (index, status) => {
    setChunks(prev => prev.map(c => c.index === index ? { ...c, status } : c));
  };

  const calculateMetrics = () => {
    if (!startTimeRef.current || !file) return;

    const now = Date.now();
    const timeElapsed = (now - startTimeRef.current) / 1000; 
    if (timeElapsed === 0) return;

    const currentUploaded = previousUploadedBytesRef.current + CHUNK_SIZE;
    previousUploadedBytesRef.current = currentUploaded;

    const speedBytesPerSec = currentUploaded / timeElapsed; 
    const remainingBytes = file.size - currentUploaded;
    const etaSeconds = speedBytesPerSec > 0 ? remainingBytes / speedBytesPerSec : 0;

    setUploadStats({
      speed: formatFileSize(speedBytesPerSec) + '/s',
      eta: formatTime(etaSeconds)
    });
  };

  const goHome = () => {
    setFile(null);
    setChunks([]);
    setUploadStats({ speed: 0, eta: null });
    activeUploads.current = 0;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <UploadCloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Resilient Uploader</h2>
              <p className="text-slate-400 text-xs">Chunk-based • Concurrent • Reliable</p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
             <span className="text-slate-500 text-xs font-mono">v1.0.0</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-8">

          {!file && (
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                group relative border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center cursor-pointer transition-all duration-300
                ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}
              `}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e.target.files[0])} 
                className="hidden" 
              />
              <div className="p-4 bg-slate-100 rounded-full mb-4 group-hover:bg-blue-100 transition-colors">
                <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700">Drag & Drop your file here</h3>
              <p className="text-slate-500 text-sm mt-2">or click to browse</p>
              <p className="text-slate-400 text-xs mt-4">Supports ZIP, ISO, MP4 (No Size Limit)</p>
            </div>
          )}
         
         {/* Home Button */}
          {file && (
              <div className="flex justify-end">
            <button 
              onClick={goHome}
              title="Reset / New Upload"
              className="ml-auto mb-3 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all "
            >
              <Home className="w-5 h-5 flex justify-end"/>
            </button>
            </div>
          )}

          {file && (
            
            <div className="space-y-6">
              
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <File className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-md" title={file.name}>
                      {file.name}
                    </h3>
                    <p className="text-sm text-slate-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                
                {progressPercent === 100 ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete</span>
                  </div>
                ) : (
                   <button 
                     onClick={() => setFile(null)}
                     className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-slate-400 transition-colors"
                   >
                     <X className="w-5 h-5" />
                   </button>
                )}
              </div>

              {/* Start Button*/}
              {chunks.length === 0 && (
                <button 
                  onClick={startUpload} 
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start Secure Upload
                </button>
              )}

              {/* Progress & Stats */}
              {chunks.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="text-slate-600">Global Progress</span>
                      <span className="text-blue-600">{progressPercent}%</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        style={{ width: `${progressPercent}%` }}
                      >
                         <div className="w-full h-full opacity-30 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')]"></div>
                      </div>
                    </div>
                  </div>

  
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center">
                      <div className="flex items-center gap-2 text-slate-400 text-xs uppercase font-bold mb-1">
                        <Zap className="w-3 h-3" /> Speed
                      </div>
                      <span className="text-slate-800 font-mono font-semibold">
                        {uploadStats.speed || '0 MB/s'}
                      </span>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center">
                      <div className="flex items-center gap-2 text-slate-400 text-xs uppercase font-bold mb-1">
                        <Database className="w-3 h-3" /> Uploaded
                      </div>
                      <span className="text-slate-800 font-mono font-semibold">
                        {formatFileSize(uploadedBytes)}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center">
                      <div className="flex items-center gap-2 text-slate-400 text-xs uppercase font-bold mb-1">
                        <Clock className="w-3 h-3" /> ETA
                      </div>
                      <span className={`font-mono font-semibold ${uploadStats.eta === '--' ? 'text-slate-400' : 'text-orange-600'}`}>
                        {uploadStats.eta || '--'}
                      </span>
                    </div>
                  </div>

                 
                  <div className="border-t border-slate-100 pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        Chunk Map
                      </h4>
                      <div className="flex gap-3 text-[10px] font-medium text-slate-500">
                        <div className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-200 rounded-sm"></span> Queue</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded-sm shadow-[0_0_5px_rgba(250,204,21,0.6)]"></span> Uploading</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-sm"></span> Done</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm"></span> Error</div>
                      </div>
                    </div>
                    

                    <div className="grid grid-cols-12 sm:grid-cols-16 gap-1 p-4 bg-slate-50 rounded-xl border-inner border-slate-200 max-h-60 overflow-y-auto custom-scrollbar">
                      {chunks.map(c => (
                        <div 
                          key={c.index} 
                          title={`Chunk ${c.index}`}
                          className={`
                            aspect-square rounded-[2px] transition-all duration-300
                            ${c.status === 'success' ? 'bg-green-500 shadow-sm scale-100' : 
                              c.status === 'uploading' ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] scale-110 z-10 ring-1 ring-white' : 
                              c.status === 'error' ? 'bg-red-500' : 
                              'bg-slate-200 hover:bg-slate-300'}
                          `}
                        />
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        {file && (
            <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400">
                    Chunk Size: 5MB • Total Chunks: {chunks.length} • Type: {file.type || 'Binary'}
                </p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SmartUploader;