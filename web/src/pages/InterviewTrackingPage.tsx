import { useEffect, useState, useMemo } from 'react';
import { useApiFetch } from '../hooks/useApiFetch';
import {
  INTERVIEWS,
  POSITIONS,
  COMPANIES,
  CITIES,
} from '../constants/api';
import InterviewFormDrawer from '../components/InterviewFormDrawer';
import '../styles/interviews.css'; // We'll create this styles file next

export interface Round {
  _id?: string;
  roundNumber: number;
  name: string;
  status: 'Completed' | 'Pending' | 'Expected' | 'Waiting';
  feedback: string;
  questions: string[];
}

export interface Interview {
  _id?: string;
  companyId: { _id: string; name: string };
  positionId: { _id: string; name: string };
  locationId: { _id: string; city: string; colIndex: number };
  totalRounds: number;
  expectedPackage: number;
  companyProposed: number;
  status: string;
  lastRoundFeedback: string;
  contactNo: string;
  contactName: string;
  contactEmail: string;
  rounds: Round[];
}

export default function InterviewTrackingPage() {
  const apiFetch = useApiFetch();

  // State lists
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [companies, setCompanies] = useState<{ _id: string; name: string }[]>([]);
  const [positions, setPositions] = useState<{ _id: string; name: string }[]>([]);
  const [cities, setCities] = useState<{ _id: string; city: string }[]>([]);

  // Fetching status
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Layout toggles
  const [viewMode, setViewMode] = useState<'board' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

  // Drawer / Modal triggers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Interviews
      const resInt = await apiFetch(INTERVIEWS);
      if (!resInt.ok) throw new Error(`Interviews: HTTP ${resInt.status}`);
      const dataInt = await resInt.json();
      setInterviews(dataInt);

      // Companies
      const resComp = await apiFetch(COMPANIES);
      if (!resComp.ok) throw new Error(`Companies: HTTP ${resComp.status}`);
      const dataComp = await resComp.json();
      setCompanies(dataComp.companies || dataComp);

      // Positions
      const resPos = await apiFetch(POSITIONS);
      if (!resPos.ok) throw new Error(`Positions: HTTP ${resPos.status}`);
      const dataPos = await resPos.json();
      setPositions(dataPos);

      // Cities
      const resCol = await apiFetch('/api/v1/city-expenses');
      if (resCol.ok) {
        const dataCol = await resCol.json();
        setCities(dataCol.map((d: { _id?: string; city: string }) => ({ _id: d._id || d.city, city: d.city })));
      } else {
        const resCit = await apiFetch(CITIES);
        if (resCit.ok) {
          const body = await resCit.json();
          const citiesList = body.cities || [];
          setCities(citiesList.map((c: any) => (typeof c === 'string' ? { _id: c, city: c } : { _id: c._id, city: c.city })));
        }
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const reloadPositions = async () => {
    const res = await apiFetch(POSITIONS);
    if (res.ok) {
      const data = await res.json();
      setPositions(data);
    }
  };

  const reloadCities = async () => {
    const res = await apiFetch('/api/v1/city-expenses');
    if (res.ok) {
      const data = await res.json();
      const mapped = data.map((d: { _id?: string; city: string }) => ({ _id: d._id || d.city, city: d.city }));
      setCities(mapped);
      return mapped;
    } else {
      const resCit = await apiFetch(CITIES);
      if (resCit.ok) {
        const body = await resCit.json();
        const citiesList = body.cities || [];
        const mapped = citiesList.map((c: any) => (typeof c === 'string' ? { _id: c, city: c } : { _id: c._id, city: c.city }));
        setCities(mapped);
        return mapped;
      }
    }
    return [];
  };

  const handleAddCompanyInline = async (name: string): Promise<string | undefined> => {
    try {
      const res = await apiFetch(COMPANIES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to add company');
      }
      const data = await res.json();
      const list = data.companies || data;
      setCompanies(list);
      const added = list.find((c: { name: string; _id: string }) => c.name.toLowerCase() === name.toLowerCase());
      return added?._id;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
      return undefined;
    }
  };

  const handleAddPositionInline = async (name: string): Promise<string | undefined> => {
    try {
      const res = await apiFetch(POSITIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to add position');
      const data = await res.json();
      await reloadPositions();
      return data._id;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
      return undefined;
    }
  };

  const handleAddCityInline = async (city: string): Promise<string | undefined> => {
    try {
      const res = await apiFetch('/api/v1/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city }),
      });
      if (!res.ok) throw new Error('Failed to add city');
      const data = await res.json();
      await reloadCities();
      return data.city?._id;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
      return undefined;
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (int: Interview) => {
    setEditingId(int._id || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this interview record?')) return;
    try {
      const res = await apiFetch(`${INTERVIEWS}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete interview');
      fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  // Filter implementation
  const filteredInterviews = useMemo(() => {
    return interviews.filter((item) => {
      const company = item.companyId?.name || '';
      const position = item.positionId?.name || '';
      const matchesSearch =
        company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        position.toLowerCase().includes(searchQuery.toLowerCase());

      const isMovedToRound = item.status && item.status.startsWith('Moved to Round');
      const isActive = ['Shared Resume', 'Shortlisted', 'In-Progress', 'Hold', 'Offer Released'].includes(item.status) || isMovedToRound;
      const matchesStatus = statusFilter === 'all' || isActive;

      return matchesSearch && matchesStatus;
    });
  }, [interviews, searchQuery, statusFilter]);

  // Dynamic columns list based on enums and any active Moved to Round X status
  const columnsList = useMemo(() => {
    // Find all Moved to Round X statuses present in interviews
    const roundStatuses = new Set<string>();
    for (const item of interviews) {
      if (item.status && item.status.startsWith('Moved to Round')) {
        roundStatuses.add(item.status);
      }
    }

    const sortedRounds = Array.from(roundStatuses).sort((a, b) => {
      const numA = parseInt(a.replace('Moved to Round ', ''), 10) || 0;
      const numB = parseInt(b.replace('Moved to Round ', ''), 10) || 0;
      return numA - numB;
    });

    return [
      'Shared Resume',
      'Shortlisted',
      'In-Progress',
      ...sortedRounds,
      'Hold',
      'Selected',
      'Offer Released',
      'Rejected'
    ];
  }, [interviews]);

  // Board columns mapping
  const boardColumns = useMemo(() => {
    const cols: Record<string, Interview[]> = {};
    for (const col of columnsList) {
      cols[col] = filteredInterviews.filter((i) => i.status === col);
    }
    return cols;
  }, [columnsList, filteredInterviews]);

  return (
    <main className="page ftrack-container">
      <h2>Interview Tracker</h2>
      <p className="subtitle">
      </p>

      {/* Control panel for filters & view mode */}
      <div className="ftrack-controls">
        <div className="ftrack-search-wrap">
          <input
            type="text"
            className="ftrack-input"
            placeholder="Search company or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="ftrack-search-icon">🔍</span>
        </div>

        <div className="ftrack-filter-buttons">
          <button
            className={`ftrack-btn ${statusFilter === 'active' ? 'ftrack-btn--active' : 'ftrack-btn--secondary'}`}
            onClick={() => setStatusFilter('active')}
          >
            Active
          </button>
          <button
            className={`ftrack-btn ${statusFilter === 'all' ? 'ftrack-btn--active' : 'ftrack-btn--secondary'}`}
            onClick={() => setStatusFilter('all')}
          >
            All Columns
          </button>
        </div>

        <div className="ftrack-view-toggle">
          <button
            className={`ftrack-btn ${viewMode === 'board' ? 'ftrack-btn--active' : 'ftrack-btn--secondary'}`}
            onClick={() => setViewMode('board')}
          >
            Board
          </button>
          <button
            className={`ftrack-btn ${viewMode === 'table' ? 'ftrack-btn--active' : 'ftrack-btn--secondary'}`}
            onClick={() => setViewMode('table')}
          >
            Table List
          </button>
        </div>
        <button className="ftrack-btn ftrack-btn--primary" onClick={handleOpenAdd}>
          + New Interview
        </button>
      </div>

      {error && <div className="ftrack-error-banner">⚠ Error loading data: {error}</div>}

      {loading ? (
        <div className="ftrack-loading">
          <span className="p1-form__spinner" /> Loading interviews...
        </div>
      ) : (
        <>
          {/* KANBAN BOARD VIEW */}
          {viewMode === 'board' && (
            <div className="ftrack-board">
              {Object.entries(boardColumns).map(([colStatus, colList]) => (
                <div key={colStatus} className="ftrack-board-column">
                  <div className="ftrack-board-column-header">
                    <span className={`ftrack-status-dot ftrack-status-dot--${colStatus.toLowerCase().replace(/\s+/g, '-')}`} />
                    <h4>{colStatus}</h4>
                    <span className="ftrack-column-count">{colList.length}</span>
                  </div>
                  <div className="ftrack-board-column-cards">
                    {colList.length === 0 ? (
                      <div className="ftrack-board-empty">No cards</div>
                    ) : (
                      colList.map((item) => (
                        <div key={item._id} className="ftrack-card">
                          <div className="ftrack-card-header">
                            <h5>{item.companyId?.name}</h5>
                            <span className="ftrack-card-role">{item.positionId?.name}</span>
                          </div>

                          <div className="ftrack-card-body">
                            <div className="ftrack-card-meta">
                              <span>📍 {item.locationId?.city} (Index: {item.locationId?.colIndex?.toFixed(2) || '1.00'})</span>
                              <span>💼 Expected: <strong>{item.expectedPackage} LPA</strong></span>
                              {item.companyProposed > 0 && (
                                <span className="ftrack-proposed-badge">
                                  💵 Offered: <strong>{item.companyProposed} LPA</strong>
                                </span>
                              )}
                            </div>

                            <div className="ftrack-card-rounds">
                              <strong>Rounds ({item.rounds?.length || 0}):</strong>
                              <div className="ftrack-rounds-progress">
                                {item.rounds?.map((round, rIdx) => (
                                  <span
                                    key={round._id || rIdx}
                                    className={`ftrack-round-pill ftrack-round-pill--${round.status.toLowerCase()}`}
                                    title={`${round.name}: ${round.status}`}
                                  >
                                    R{round.roundNumber}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="ftrack-card-footer">
                            <button
                              className="ftrack-card-btn ftrack-card-btn--edit"
                              onClick={() => handleOpenEdit(item)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="ftrack-card-btn ftrack-card-btn--delete"
                              onClick={() => handleDelete(item._id!)}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TABLE LIST VIEW */}
          {viewMode === 'table' && (
            <div className="p1r-table-wrap">
              <table className="p1r-table ftrack-table">
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>Position</th>
                    <th>Location</th>
                    <th>Expected</th>
                    <th>Proposed</th>
                    <th>Rounds</th>
                    <th>Overall Status</th>
                    <th>Contact Person</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInterviews.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>
                        No interview records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInterviews.map((item) => (
                      <tr key={item._id}>
                        <td><strong>{item.companyId?.name}</strong></td>
                        <td>{item.positionId?.name}</td>
                        <td>{item.locationId?.city}</td>
                        <td>{item.expectedPackage} LPA</td>
                        <td>{item.companyProposed > 0 ? `${item.companyProposed} LPA` : '-'}</td>
                        <td>
                          <div className="ftrack-rounds-progress">
                            {item.rounds?.map((round, rIdx) => (
                              <span
                                key={round._id || rIdx}
                                className={`ftrack-round-pill ftrack-round-pill--${round.status.toLowerCase()}`}
                                title={`${round.name}: ${round.status}`}
                              >
                                R{round.roundNumber}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={`ftrack-badge ftrack-badge--${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div className="ftrack-contact-info">
                            <div>{item.contactName || '-'}</div>
                            <small>{item.contactEmail || item.contactNo || ''}</small>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="ftrack-card-btn ftrack-card-btn--edit"
                              onClick={() => handleOpenEdit(item)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="ftrack-card-btn ftrack-card-btn--delete"
                              onClick={() => handleDelete(item._id!)}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ADD/EDIT INTERVIEW DIALOG DRAWER */}
      <InterviewFormDrawer
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        interviewId={editingId}
        onSaveSuccess={fetchData}
        companies={companies}
        positions={positions}
        cities={cities}
        onAddCompany={handleAddCompanyInline}
        onAddPosition={handleAddPositionInline}
        onAddCity={handleAddCityInline}
      />
    </main>
  );
}
