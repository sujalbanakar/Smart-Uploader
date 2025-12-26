import express from "express";
import cors from 'cors';
import db from './config/mongoose-connection.js';
import uploadRouter from './routes/uploadRouter.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

// Middleware
app.use(cors()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.raw({ 
  type: 'application/octet-stream', 
  limit: '10mb' 
}));

// Routes
app.use('/api/upload', uploadRouter);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});