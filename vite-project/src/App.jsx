import { useState } from 'react';
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

  const extractVideoId = (url) => {
    const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  };

  const fetchComments = async (isNew = false) => {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    let currentVideoId = videoId;

    if (isNew) {
      currentVideoId = extractVideoId(videoLink);
      if (!currentVideoId) {
        alert("Invalid YouTube link");
        return;
      }
      setVideoId(currentVideoId);
      setComments([]);
      setNextPageToken(null);
      setTotalResults(null);
      setShouldStop(false); // 🆕 reset cancel flag
    }

    if (!apiKey || !currentVideoId) {
      alert("Missing API key or video ID");
      return;
    }

    setLoading(true);
    let pageToken = isNew ? null : nextPageToken;
    let done = false;

    try {
      while (!done && !shouldStop) {
        let url = `https://www.googleapis.com/youtube/v3/commentThreads?key=${apiKey}&videoId=${currentVideoId}&part=snippet&maxResults=50`;
        if (pageToken) url += `&pageToken=${pageToken}`;

        const res = await fetch(url);
        const data = await res.json();

        if (!data.items || data.items.length === 0) break;

        if (isNew && data.pageInfo?.totalResults) {
          setTotalResults(data.pageInfo.totalResults);
        }

        const rawComments = data.items.map((item) => {
          const snippet = item.snippet.topLevelComment.snippet;
          return {
            text: snippet.textDisplay,
            likeCount: snippet.likeCount,
            publishedAt: snippet.publishedAt,
          };
        });

        setComments((prev) => [...prev, ...rawComments]);
        pageToken = data.nextPageToken || null;

        if (!pageToken) done = true;
        await new Promise((r) => setTimeout(r, 400)); // short delay to avoid quota spike
      }

      setNextPageToken(pageToken || null);
    } catch (err) {
      console.error("Error fetching comments:", err);
      alert("Failed to fetch comments");
    } finally {
      setLoading(false);
    }
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
                <div dangerouslySetInnerHTML={{ __html: c.text }} />
                <div style={{ fontSize: 12, color: '#555' }}>
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
