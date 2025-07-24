import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import commentRoutes from './routes/comments.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // or even '50mb' if needed

const PORT = 5001;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.use('/api/comments', commentRoutes);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
