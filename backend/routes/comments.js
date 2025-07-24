import express from 'express';
import Comment from '../models/comment.js';

const router = express.Router();

// Save comments
router.post('/save', async (req, res) => {
    try {
        const { videoId, comments } = req.body;

        if (!Array.isArray(comments)) {
            return res.status(400).json({ error: 'Comments must be an array' });
        }

        await Comment.deleteMany({ videoId });

        const cleanComments = comments
            .filter(c => c.text && c.text.trim() !== '')
            .map(c => ({
                videoId,
                author: c.authorName || 'Anonymous',
                text: c.text.trim(),
                likes: parseInt(c.likeCount || 0),  // <- FIXED THIS LINE
                publishedAt: c.publishedAt ? new Date(c.publishedAt) : new Date(),
            }));

        await Comment.insertMany(cleanComments);
        res.json({ message: 'Comments saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save comments' });
    }
});

// Get comments
router.get('/:videoId', async (req, res) => {
    try {
        const comments = await Comment.find({
            videoId: req.params.videoId,
            text: { $ne: '' },
            likeCount: { $gte: 0 },
            publishedAt: { $ne: null }
        }).limit(2500);

        res.json(comments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load comments' });
    }
});

// Get latest publishedAt for a video
router.get('/:videoId/latest', async (req, res) => {
    try {
        const latestComment = await Comment.findOne({ videoId: req.params.videoId })
            .sort({ publishedAt: -1 });

        res.json({ latestPublishedAt: latestComment?.publishedAt || null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get latest timestamp' });
    }
});

export default router;
