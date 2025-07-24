import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [videoLink, setVideoLink] = useState('');
  const [stickiness, setStickiness] = useState('medium');
  const [comments, setComments] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortType, setSortType] = useState('mostLiked');
  const [totalResults, setTotalResults] = useState(null);
  const [shouldStop, setShouldStop] = useState(false); // <-- ADD THIS
  const [totalLoaded, setTotalLoaded] = useState(0);

  const extractVideoId = (url) => {
    const match = url.match(/(?:v=|\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const typingTimeout = useRef(null);

  useEffect(() => {
    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    typingTimeout.current = setTimeout(() => {
      const id = extractVideoId(videoLink.trim());
      if (!id || id.length !== 11) return;

      const loadFromDatabase = async () => {
        setLoading(true);
        setVideoId(id);

        try {
          const dbRes = await fetch(`http://localhost:5001/api/comments/${id}`);
          const dbComments = await dbRes.json();

          if (dbComments.length > 0) {
            setComments(dbComments);
            setTotalLoaded(dbComments.length);

            // ✅ Only fetch more if we don’t have enough
            // ✅ Use fetchComments(false) to CONTINUE from where it left off
            if (dbComments.length < 2500) {
              fetchComments(false); // NOT true
            }

          } else {
            // No comments in DB → do a full fresh fetch
            fetchComments(true);
          }

        } catch (err) {
          console.error("DB fetch error:", err);
        }

        setLoading(false);
      };

      loadFromDatabase();
    }, 1000); // wait 1s after user stops typing

    return () => clearTimeout(typingTimeout.current);
  }, [videoLink]);



  const fetchComments = async (forceFresh = false) => {
    const videoId = extractVideoId(videoLink);
    if (!videoId) return alert("Invalid YouTube URL");

    setLoading(true);

    try {
      // 1. Try loading from MongoDB
      const dbRes = await fetch(`http://localhost:5001/api/comments/${videoId}`);
      const dbComments = await dbRes.json();

      if (!forceFresh && dbComments.length > 0) {
        setComments(dbComments);
        setTotalLoaded(dbComments.length);
        setLoading(false);
        return;
      }

      // 2. Get latest comment time
      const latestRes = await fetch(`http://localhost:5001/api/comments/${videoId}/latest`);
      const { latestPublishedAt } = await latestRes.json();
      let latestTime = latestPublishedAt ? new Date(latestPublishedAt) : null;

      // 3. Start fresh YouTube fetch
      let allComments = forceFresh ? [] : [...comments];
      let token = forceFresh ? null : nextPageToken;
      let keepGoing = true;

      while (keepGoing) {
        let apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?key=${import.meta.env.VITE_YOUTUBE_API_KEY}&textFormat=plainText&part=snippet&videoId=${videoId}&maxResults=100`;
        if (token) apiUrl += `&pageToken=${token}`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        const newComments = data.items?.map(item => {
          const c = item.snippet.topLevelComment.snippet;
          return {
            text: c.textDisplay,
            likeCount: c.likeCount,
            publishedAt: c.publishedAt,
            authorName: c.authorDisplayName,
            authorUrl: c.authorChannelUrl,
          };
        }) || [];

        // Stop if we reached old comments
        if (latestTime) {
          const cutoffIndex = newComments.findIndex(c => new Date(c.publishedAt) <= latestTime);
          if (cutoffIndex !== -1) {
            newComments.splice(cutoffIndex);
            keepGoing = false;
          }
        }

        allComments = [...allComments, ...newComments];
        token = data.nextPageToken;

        setComments(allComments);
        setNextPageToken(token);
        setTotalLoaded(allComments.length);

        if (!token || shouldStop) keepGoing = false;
      }

      // Save fresh comments to DB
      if (allComments.length > 0) {
        await fetch('http://localhost:5001/api/comments/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, comments: allComments }),
        });
      }

    } catch (err) {
      console.error("Failed to fetch comments:", err);
    }

    setLoading(false);
  };


  const sortedComments = [...comments].sort((a, b) => {
    if (sortType === 'mostLiked') {
      return b.likeCount - a.likeCount;
    } else if (sortType === 'newest') {
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    } else if (sortType === 'oldest') {
      return new Date(a.publishedAt) - new Date(b.publishedAt);
    } else {
      return 0;
    }
  });

  return (
    <div style={{ padding: 20 }}>
      <h1>Talkaa 🔎</h1>

      <input
        type="text"
        placeholder="Paste YouTube video link here"
        value={videoLink}
        onChange={(e) => setVideoLink(e.target.value)}
        style={{ width: '100%', padding: 10, fontSize: 16 }}
      />

      <select
        value={stickiness}
        onChange={(e) => setStickiness(e.target.value)}
        style={{ marginTop: 10, padding: 8 }}
      >
        <option value="low">Low Stickiness</option>
        <option value="medium">Medium Stickiness</option>
        <option value="high">High Stickiness</option>
      </select>

      <button
        onClick={() => fetchComments(true)}
        style={{ display: 'block', marginTop: 10, padding: 10 }}
        disabled={loading}
      >
        {loading ? "Loading..." : "Fetch Real Comments"}
      </button>

      {comments.length > 0 && (
        <p style={{ marginTop: 10, fontWeight: 'bold' }}>
          Total Comments Loaded: {comments.length}
        </p>
      )}

      {comments.length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button
            onClick={() => setSortType('mostLiked')}
            style={{
              padding: '8px 12px',
              borderRadius: 20,
              border: '1px solid #ccc',
              backgroundColor: sortType === 'mostLiked' ? '#333' : '#fff',
              color: sortType === 'mostLiked' ? '#fff' : '#000',
              cursor: 'pointer',
            }}
          >
            Most Liked
          </button>
          <button
            onClick={() => setSortType('newest')}
            style={{
              padding: '8px 12px',
              borderRadius: 20,
              border: '1px solid #ccc',
              backgroundColor: sortType === 'newest' ? '#333' : '#fff',
              color: sortType === 'newest' ? '#fff' : '#000',
              cursor: 'pointer',
            }}
          >
            Newest
          </button>
          <button
            onClick={() => setSortType('oldest')}
            style={{
              padding: '8px 12px',
              borderRadius: 20,
              border: '1px solid #ccc',
              backgroundColor: sortType === 'oldest' ? '#333' : '#fff',
              color: sortType === 'oldest' ? '#fff' : '#000',
              cursor: 'pointer',
            }}
          >
            Oldest
          </button>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {comments.length > 0 ? (
          <>
            {loading && (
              <>
                <p style={{ fontStyle: 'italic', marginBottom: 10 }}>
                  Loading comments: {comments.length}{totalResults ? ` / ${totalResults}` : ''}...
                </p>
                <button
                  onClick={() => setShouldStop(true)}
                  style={{ padding: '6px 12px', marginBottom: 10 }}
                >
                  Stop Fetching
                </button>
              </>
            )}


            {sortedComments.map((c, i) => (
              <div key={i} style={{ padding: 10, borderBottom: '1px solid #ccc' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                  {c.authorUrl ? (
                    <a href={c.authorUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#8d38e8', textDecoration: 'none' }}>
                      {c.authorName}
                    </a>
                  ) : (
                    c.authorName
                  )}
                </div>
                <div dangerouslySetInnerHTML={{ __html: c.text }} />
                <div style={{ fontSize: 12, color: '#38e861' }}>
                  👍 {c.likeCount} &nbsp; • &nbsp; {new Date(c.publishedAt).toLocaleString()}
                </div>
              </div>
            ))}

            {nextPageToken && (
              <button
                onClick={() => fetchComments(false)}
                style={{ marginTop: 10, padding: 10 }}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load More Comments"}
              </button>
            )}
          </>
        ) : (
          <p>No comments yet.</p>
        )}
      </div>
    </div>
  );
}
export default App;
