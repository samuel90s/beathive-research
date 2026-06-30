'use client';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';
import { mediaUrl } from '@/lib/utils';
import { toast } from '@/lib/store/toast.store';

interface Review {
  id: string;
  score: number;
  reviewText?: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string };
}

interface RatingData {
  avgScore: number;
  totalCount: number;
  distribution: { score: number; count: number }[];
  reviews: Review[];
}

function Stars({ score, interactive = false, onSelect }: { score: number; interactive?: boolean; onSelect?: (s: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          disabled={!interactive}
          onClick={() => onSelect?.(s)}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill={(interactive ? hover || score : score) >= s ? '#f59e0b' : 'none'}
            stroke={(interactive ? hover || score : score) >= s ? '#f59e0b' : '#3a3c4e'}
            strokeWidth="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function RatingSection({ soundId, canReview = false }: { soundId: string; canReview?: boolean }) {
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<RatingData | null>(null);
  const [myRating, setMyRating] = useState<{ score: number; reviewText?: string } | null>(null);
  const [score, setScore] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchRatings();
    if (isAuthenticated) fetchMyRating();
  }, [soundId, isAuthenticated]);

  const fetchRatings = async () => {
    try {
      const res = await apiClient.get(`/ratings/sound/${soundId}`);
      setData(res.data);
    } catch { /* ignore */ }
  };

  const fetchMyRating = async () => {
    try {
      const res = await apiClient.get(`/ratings/sound/${soundId}/mine`);
      if (res.data) {
        setMyRating(res.data);
        setScore(res.data.score);
        setText(res.data.reviewText ?? '');
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score === 0) return;
    setSubmitting(true);
    try {
      await apiClient.post('/ratings', { soundId, score, reviewText: text || undefined });
      toast.success('Review submitted!');
      setShowForm(false);
      await fetchRatings();
      await fetchMyRating();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/ratings/${soundId}`);
      setMyRating(null);
      setScore(0);
      setText('');
      toast.info('Review deleted.');
      await fetchRatings();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete review');
    }
  };

  if (!data) return null;

  return (
    <div className="mt-4 card rounded-2xl p-5">
      <h3 className="text-[10px] font-semibold text-[#5a5d72] uppercase tracking-widest mb-4">Ratings & Reviews</h3>

      {/* Summary */}
      <div className="flex gap-6 mb-5">
        <div className="text-center">
          <p className="text-4xl font-bold text-white">{data.avgScore > 0 ? data.avgScore.toFixed(1) : '—'}</p>
          <Stars score={data.avgScore} />
          <p className="text-xs text-[#5a5d72] mt-1">{data.totalCount} review{data.totalCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.distribution.map(d => (
            <div key={d.score} className="flex items-center gap-2 text-xs">
              <span className="w-3 text-right text-[#5a5d72]">{d.score}</span>
              <div className="flex-1 bg-white/[0.06] rounded-full h-1.5">
                <div
                  className="bg-amber-400 h-1.5 rounded-full transition-all"
                  style={{ width: data.totalCount > 0 ? `${(d.count / data.totalCount) * 100}%` : '0%' }}
                />
              </div>
              <span className="w-3 text-[#5a5d72]">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* My review status / CTA */}
      {isAuthenticated && canReview ? (
        myRating ? (
          <div className="mb-4 p-3 bg-accent/[0.08] border border-accent/20 rounded-xl flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-[#6b6f82] mb-1">Review kamu</p>
              <Stars score={myRating.score} />
              {myRating.reviewText && <p className="text-sm text-[#8b8fa8] mt-1">{myRating.reviewText}</p>}
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button onClick={() => setShowForm(true)} className="text-xs text-accent-bright hover:underline">Edit</button>
              <button onClick={handleDelete} className="text-xs text-red-400 hover:underline">Delete</button>
            </div>
          </div>
        ) : !showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="mb-4 w-full py-2.5 border border-dashed border-accent/30 text-accent-bright text-sm rounded-xl hover:bg-accent/[0.08] transition-colors"
          >
            Tulis Review
          </button>
        ) : null
      ) : isAuthenticated && !canReview ? (
        <p className="mb-4 text-xs text-[#3a3c4e] text-center py-2">
          Download atau beli sound ini untuk bisa memberikan review
        </p>
      ) : (
        <p className="mb-4 text-sm text-[#5a5d72] text-center">
          <a href="/auth/login" className="text-accent-bright hover:underline">Login</a> untuk memberikan review
        </p>
      )}

      {/* Review form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 bg-white/[0.03] border border-rim rounded-xl p-4 space-y-3">
          <div>
            <p className="text-xs text-[#6b6f82] mb-1.5">Your rating</p>
            <Stars score={score} interactive onSelect={setScore} />
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Share your thoughts (optional)"
            rows={3}
            className="w-full input-dark rounded-xl text-sm resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || score === 0}
              className="px-4 py-1.5 btn-accent rounded-lg text-sm disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Submit'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-sm text-[#6b6f82] hover:text-[#c4c6d8] transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Review list */}
      <div className="space-y-4">
        {data.reviews.filter(r => r.reviewText).map(r => (
          <div key={r.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/20 text-accent-bright text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden">
              {r.user.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={mediaUrl(r.user.avatarUrl)} alt={r.user.name} className="w-full h-full object-cover" />
                : r.user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-[#c4c6d8]">{r.user.name}</span>
                <Stars score={r.score} />
              </div>
              <p className="text-sm text-[#8b8fa8] leading-relaxed">{r.reviewText}</p>
            </div>
          </div>
        ))}
        {data.reviews.filter(r => r.reviewText).length === 0 && data.totalCount > 0 && (
          <p className="text-sm text-[#5a5d72] text-center py-2">No written reviews yet.</p>
        )}
      </div>
    </div>
  );
}
