import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  videoId: String,
  author: String,
  text: String,
  likes: Number,
  publishedAt: Date
});

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
