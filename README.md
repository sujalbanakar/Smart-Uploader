# 🚀 Resilient Large File Uploader

A robust, fault-tolerant file upload system engineered to handle large datasets (GBs) over unstable networks. Features **chunk-based streaming**, **concurrency control**, and **automatic resumability**.

## 📸 Project Screenshots

<p align="center">
  <img src="./assets/Screenshot2.png" width="45%" />
  <img src="./assets/Screenshot1.png" width="45%" />
</p>

## 🌟 Key Features

* **Chunk-Based Uploading:** Splits large files into **5MB chunks** using the `Blob.slice()` API, preventing memory crashes.
* **Smart Concurrency:** Implements a custom queue manager to limit active requests to **3 parallel uploads**, preventing browser freezing.
* **Automatic Resumability:** "Handshakes" with the server before uploading. If a user refreshes or loses internet, the upload resumes exactly where it left off (zero data loss).
* **Network Resilience:** Features an **Exponential Backoff Retry** mechanism (retries failed chunks 3 times with increasing delays).
* **Visual Analytics:** Real-time calculation of **Upload Speed**, **ETA**, and a **Chunk Visualization Grid** to monitor individual part status.

## 🛠️ Tech Stack

**Frontend:**
* React.js (Vite)
* Tailwind CSS (Styling)
* Lucide React (Icons)
* Axios (HTTP Requests)

**Backend:**
* Node.js & Express
* MongoDB (Mongoose) - Stores upload state & metadata
* FS (File System) - Uses `fs.write` with offsets for random access writing
* Yauzl - Stream-based ZIP inspection

## 🧠 Technical Architecture & Design Decisions

### 1. Data Integrity & Hashing
To guarantee zero corruption during transmission, the system implements **End-to-End Integrity Verification**:
* **Client-Side:** Each file is hashed using `spark-md5` before upload.
* **Server-Side:** Upon assembly, the server re-calculates the hash. The upload is only marked "Success" if the server hash matches the client hash.

### 2. Deep Dive: Pause/Resume Logic
The resumability is not just a UI toggle; it relies on a **State-Aware Handshake Protocol**:
* **Pre-Flight Check:** Before uploading, the client sends a `GET /status` request.
* **Offset Recovery:** The server returns the number of bytes already stored on disk.
* **Slicing:** The client uses `Blob.slice(server_offset)` to skip already uploaded bytes and resumes the stream immediately from the missing chunk.

### 3. Key Trade-offs
* **Consistency vs. Speed:** I chose to store temporary chunks on the **disk** (using `fs`) rather than in **RAM**.
    * *Pro:* Prevents server memory leaks when hundreds of users upload simultaneously.
    * *Con:* Slightly slower due to Disk I/O latency compared to in-memory streams.
* **MD5 vs. SHA-256:** MD5 was selected for hashing because it is significantly faster to compute in the browser for multi-GB files, which is an acceptable trade-off for non-cryptographic file integrity checks.

### 4. Future Roadmap
* [ ] **S3 Integration:** Move from local filesystem storage to AWS S3 Multipart Uploads for infinite scalability.
* [ ] **WebSockets:** Replace HTTP polling for progress updates with real-time WebSocket events.
* [ ] **Drag & Drop:** Enhance UI to support dropping folders.

## 🚀 Getting Started

Follow these steps to run the project locally.

### Prerequisites
* Node.js (v16+)
* MongoDB (Running locally or Atlas URL)

### 1. Clone the Repository
```bash
git clone [https://github.com/sujalbanakar/resilient-file-uploader.git](https://github.com/sujalbanakar/resilient-file-uploader.git)
cd resilient-file-uploader