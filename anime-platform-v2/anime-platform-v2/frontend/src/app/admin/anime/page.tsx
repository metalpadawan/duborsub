// src/app/admin/anime/page.tsx
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const BLANK_FORM = {
  title: '', description: '', coverImageUrl: '',
  releaseYear: '', hasDub: false, status: 'completed', genreIds: [] as number[],
};

const ALL_GENRES = [
  { id: 1, name: 'Action' }, { id: 2, name: 'Adventure' }, { id: 3, name: 'Comedy' },
  { id: 4, name: 'Drama' }, { id: 5, name: 'Fantasy' }, { id: 6, name: 'Horror' },
  { id: 7, name: 'Mecha' }, { id: 8, name: 'Mystery' }, { id: 9, name: 'Romance' },
  { id: 10, name: 'Sci-Fi' }, { id: 11, name: 'Slice of Life' }, { id: 12, name: 'Sports' },
  { id: 13, name: 'Supernatural' }, { id: 14, name: 'Thriller' },
];

export default function AdminAnimePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState(BLANK_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-anime', search, page],
    queryFn: () => api.get('/anime', { params: { search, page, limit: 20 } }).then((r) => r.data),
    placeholderData: (p) => p,
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/anime', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-anime'] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.patch(`/anime/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-anime'] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/anime/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-anime'] }),
  });

  function openCreate() { setForm(BLANK_FORM); setEditTarget(null); setShowForm(true); }

  function openEdit(anime: any) {
    setEditTarget(anime);
    setForm({
      title: anime.title, description: anime.description ?? '',
      coverImageUrl: anime.coverImageUrl ?? '', releaseYear: anime.releaseYear ?? '',
      hasDub: anime.hasDub, status: anime.status,
      genreIds: anime.genres?.map((g: any) => g.id) ?? [],
    });
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditTarget(null); }

  function handleSubmit() {
    const body = {
      ...form,
      releaseYear: form.releaseYear ? Number(form.releaseYear) : undefined,
    };
    if (editTarget) updateMutation.mutate({ id: editTarget.id, body });
    else createMutation.mutate(body);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <input
          className="admin-input"
          placeholder="Search anime..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ width: 260 }}
        />
        <button
          className="action-btn"
          style={{ borderColor: 'rgba(224,64,176,0.3)', color: '#e040b0' }}
          onClick={openCreate}
        >
          + Add anime
        </button>
      </div>

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Year</th>
              <th>Status</th>
              <th>Dub</th>
              <th>Sub avg</th>
              <th>Dub avg</th>
              <th>Votes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#3d3a4e', padding: 32 }}>Loading...</td></tr>
            )}
            {data?.items?.map((anime: any) => (
              <tr key={anime.id}>
                <td style={{ color: '#c0b8d8', maxWidth: 200 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {anime.title}
                  </span>
                </td>
                <td>{anime.releaseYear ?? '—'}</td>
                <td><span className="badge badge-user">{anime.status}</span></td>
                <td>{anime.hasDub ? <span className="badge badge-ok">yes</span> : <span style={{ color: '#3d3a4e' }}>—</span>}</td>
                <td style={{ color: '#f59e0b' }}>{anime.avgSubRating ? Number(anime.avgSubRating).toFixed(1) : '—'}</td>
                <td style={{ color: '#f59e0b' }}>{anime.avgDubRating ? Number(anime.avgDubRating).toFixed(1) : '—'}</td>
                <td>{anime.totalVotes}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="action-btn" onClick={() => openEdit(anime)}>Edit</button>
                    <button
                      className="action-btn danger"
                      onClick={() => { if (confirm(`Delete "${anime.title}"?`)) deleteMutation.mutate(anime.id); }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.pages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'flex-end' }}>
          {Array.from({ length: data.pagination.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} className="action-btn"
              onClick={() => setPage(p)}
              style={{ color: p === page ? '#e040b0' : undefined, borderColor: p === page ? 'rgba(224,64,176,0.3)' : undefined }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 13, color: '#c0b8d8', fontWeight: 600, marginBottom: 20 }}>
              {editTarget ? 'Edit anime' : 'Add anime'}
            </div>

            {[
              { key: 'title', label: 'Title *', type: 'text', placeholder: 'e.g. Fullmetal Alchemist' },
              { key: 'coverImageUrl', label: 'Cover image URL', type: 'url', placeholder: 'https://...' },
              { key: 'releaseYear', label: 'Release year', type: 'number', placeholder: '2003' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, letterSpacing: '0.08em', color: '#3d3a4e', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{label}</label>
                <input
                  type={type}
                  className="admin-input"
                  style={{ width: '100%' }}
                  placeholder={placeholder}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, letterSpacing: '0.08em', color: '#3d3a4e', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Description</label>
              <textarea
                className="admin-input"
                style={{ width: '100%', resize: 'vertical', minHeight: 80 }}
                placeholder="Synopsis..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 10, letterSpacing: '0.08em', color: '#3d3a4e', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Status</label>
                <select className="admin-input" style={{ width: '100%' }} value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="airing">Airing</option>
                  <option value="completed">Completed</option>
                  <option value="upcoming">Upcoming</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
                <input type="checkbox" id="hasDub" checked={form.hasDub}
                  onChange={(e) => setForm((f) => ({ ...f, hasDub: e.target.checked }))} />
                <label htmlFor="hasDub" style={{ fontSize: 12, color: '#7a7490', cursor: 'pointer' }}>Has dub version</label>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, letterSpacing: '0.08em', color: '#3d3a4e', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Genres</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ALL_GENRES.map((g) => (
                  <button key={g.id}
                    className="action-btn"
                    style={{
                      color: form.genreIds.includes(g.id) ? '#e040b0' : undefined,
                      borderColor: form.genreIds.includes(g.id) ? 'rgba(224,64,176,0.4)' : undefined,
                    }}
                    onClick={() => setForm((f) => ({
                      ...f,
                      genreIds: f.genreIds.includes(g.id)
                        ? f.genreIds.filter((id) => id !== g.id)
                        : [...f.genreIds, g.id],
                    }))}>
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="action-btn" onClick={closeForm}>Cancel</button>
              <button
                className="action-btn"
                style={{ borderColor: 'rgba(224,64,176,0.4)', color: '#e040b0' }}
                disabled={isPending || !form.title}
                onClick={handleSubmit}
              >
                {isPending ? 'Saving...' : editTarget ? 'Save changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
