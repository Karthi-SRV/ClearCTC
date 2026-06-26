import React, { useState, useEffect } from 'react';
import { useApiFetch } from '../hooks/useApiFetch';
import Combobox from './Combobox';
import { INTERVIEWS } from '../constants/api';

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  interviewId: string | null;
  onSaveSuccess: () => void;
  companies: { _id: string; name: string }[];
  positions: { _id: string; name: string }[];
  cities: { _id: string; city: string }[];
  onAddCompany: (name: string) => Promise<string | undefined>;
  onAddPosition: (name: string) => Promise<string | undefined>;
  onAddCity: (city: string) => Promise<string | undefined>;
}

export interface FormState {
  companyId: string;
  positionId: string;
  locationId: string;
  totalRounds: number;
  expectedPackage: number;
  companyProposed: number;
  status: string;
  lastRoundFeedback: string;
  contactName: string;
  contactEmail: string;
  contactNo: string;
  rounds: Round[];
}

const initialFormState: FormState = {
  companyId: '',
  positionId: '',
  locationId: '',
  totalRounds: 1,
  expectedPackage: 0,
  companyProposed: 0,
  status: 'Shared Resume',
  lastRoundFeedback: '',
  contactName: '',
  contactEmail: '',
  contactNo: '',
  rounds: [
    { roundNumber: 1, name: 'Technical Round 1', status: 'Pending', feedback: '', questions: [] },
  ],
};

export default function InterviewFormDrawer({
  isOpen,
  onClose,
  interviewId,
  onSaveSuccess,
  companies,
  positions,
  cities,
  onAddCompany,
  onAddPosition,
  onAddCity,
}: Props) {
  const apiFetch = useApiFetch();

  // Form states
  const [formState, setFormState] = useState<FormState>(initialFormState);

  // Fetching / Saving statuses
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New question input per round index
  const [newQuestions, setNewQuestions] = useState<Record<number, string>>({});

  // Dynamic overall status options based on number of rounds
  const statusOptions = React.useMemo(() => {
    const base = ['Shared Resume', 'Shortlisted', 'In-Progress'];

    // Add Moved to Round 1, Moved to Round 2...
    for (let i = 1; i <= formState.totalRounds; i++) {
      base.push(`Moved to Round ${i}`);
    }

    return [...base, 'Hold', 'Selected', 'Offer Released', 'Rejected'];
  }, [formState.totalRounds]);

  // Load interview details
  useEffect(() => {
    if (!isOpen) return;

    if (interviewId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      (async () => {
        try {
          const res = await apiFetch(`${INTERVIEWS}/${interviewId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json() as Interview;

          // Fetch round questions
          const qRes = await apiFetch(`${INTERVIEWS}/${interviewId}/questions`);
          const questionsMap: Record<string, string[]> = {};
          if (qRes.ok) {
            const qData = await qRes.json() as { questions?: { roundId?: string; question: string }[] };
            for (const q of qData.questions || []) {
              const key = q.roundId ? q.roundId.toString() : '';
              if (key) {
                if (!questionsMap[key]) questionsMap[key] = [];
                questionsMap[key].push(q.question);
              }
            }
          }

          setFormState({
            companyId: data.companyId?._id || '',
            positionId: data.positionId?._id || '',
            locationId: data.locationId?._id || '',
            totalRounds: data.totalRounds,
            expectedPackage: data.expectedPackage,
            companyProposed: data.companyProposed || 0,
            status: data.status,
            lastRoundFeedback: data.lastRoundFeedback || '',
            contactName: data.contactName || '',
            contactEmail: data.contactEmail || '',
            contactNo: data.contactNo || '',
            rounds: (data.rounds || []).map((r) => ({
              ...r,
              questions: r._id ? questionsMap[r._id.toString()] : [],
            })),
          });
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setLoading(false);
        }
      })();
    } else {
      // Defaults for create mode
      setFormState({
        companyId: '',
        positionId: '',
        locationId: '',
        totalRounds: 1,
        expectedPackage: 0,
        companyProposed: 0,
        status: 'Shared Resume',
        lastRoundFeedback: '',
        contactName: '',
        contactEmail: '',
        contactNo: '',
        rounds: [
          { roundNumber: 1, name: 'Technical Round 1', status: 'Pending', feedback: '', questions: [] },
        ],
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
    }
  }, [isOpen, interviewId, companies, positions, cities]);

  // Adjust rounds array size on total rounds change
  const handleTotalRoundsChange = (n: number) => {
    const val = Math.max(1, n);
    setFormState((prev) => {
      const copy = [...prev.rounds];
      if (copy.length < val) {
        for (let i = copy.length + 1; i <= val; i++) {
          copy.push({
            roundNumber: i,
            name: `Round ${i}`,
            status: 'Pending',
            feedback: '',
            questions: [],
          });
        }
      } else if (copy.length > val) {
        copy.splice(val);
      }
      return {
        ...prev,
        totalRounds: val,
        rounds: copy,
      };
    });
  };

  // Add/remove round questions in form state
  const handleAddQuestion = (roundIdx: number) => {
    const text = newQuestions[roundIdx]?.trim();
    if (!text) return;

    setFormState((prev) => {
      const copy = [...prev.rounds];
      copy[roundIdx] = {
        ...copy[roundIdx],
        questions: [...(copy[roundIdx].questions || []), text],
      };
      return { ...prev, rounds: copy };
    });

    setNewQuestions((prev) => ({ ...prev, [roundIdx]: '' }));
  };

  const handleRemoveQuestion = (roundIdx: number, qIdx: number) => {
    setFormState((prev) => {
      const copy = [...prev.rounds];
      const questions = [...(copy[roundIdx].questions || [])];
      questions.splice(qIdx, 1);
      copy[roundIdx] = { ...copy[roundIdx], questions };
      return { ...prev, rounds: copy };
    });
  };

  // Save/submit form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.companyId || !formState.positionId || !formState.locationId) {
      alert('Please select mandatory fields: Company, Position, Location.');
      return;
    }

    setSaving(true);
    try {
      const body = {
        companyId: formState.companyId,
        positionId: formState.positionId,
        locationId: formState.locationId,
        totalRounds: formState.totalRounds,
        expectedPackage: formState.expectedPackage,
        companyProposed: formState.companyProposed,
        status: formState.status,
        lastRoundFeedback: formState.lastRoundFeedback,
        contactName: formState.contactName,
        contactEmail: formState.contactEmail,
        contactNo: formState.contactNo,
        rounds: formState.rounds,
      };

      const url = interviewId ? `${INTERVIEWS}/${interviewId}` : INTERVIEWS;
      const method = interviewId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save interview');
      }

      onSaveSuccess();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`ftrack-drawer-overlay ${isOpen ? 'ftrack-drawer-overlay--open' : ''}`} onClick={onClose}>
      <div className={`ftrack-drawer ${isOpen ? 'ftrack-drawer--open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="ftrack-drawer-header">
          <h3>{interviewId ? 'Edit Interview' : 'Track New Interview'}</h3>
          <button className="ftrack-drawer-close" onClick={onClose}>×</button>
        </div>

        <div className="ftrack-drawer-body">
          {loading ? (
            <div className="ftrack-loading">Loading interview details...</div>
          ) : error ? (
            <div className="ftrack-error-banner">{error}</div>
          ) : (
            <form id="ftrack-drawer-form" onSubmit={handleSave} className="ftrack-form-body">

              {/* ── Company & Role ─────────────────────────────────────────── */}
              <section className="ftrack-section">
                <p className="ftrack-section__title">Company &amp; Role</p>
                <Combobox<{ _id: string; name: string }>
                  label="Company Name *"
                  options={companies}
                  value={formState.companyId}
                  onChange={(val) => setFormState(prev => ({ ...prev, companyId: val }))}
                  getOptionLabel={(o) => o.name}
                  getOptionValue={(o) => o._id}
                  onAdd={onAddCompany}
                  placeholder="Search or add company..."
                  required
                  addingText="Add via AI"
                />
                <Combobox<{ _id: string; name: string }>
                  label="Position *"
                  options={positions}
                  value={formState.positionId}
                  onChange={(val) => setFormState(prev => ({ ...prev, positionId: val }))}
                  getOptionLabel={(o) => o.name}
                  getOptionValue={(o) => o._id}
                  onAdd={onAddPosition}
                  placeholder="Search or add position..."
                  required
                  addingText="Add Position"
                />
                <Combobox<{ _id: string; city: string }>
                  label="Location (City) *"
                  options={cities}
                  value={formState.locationId}
                  onChange={(val) => setFormState(prev => ({ ...prev, locationId: val }))}
                  getOptionLabel={(c) => c.city}
                  getOptionValue={(c) => c._id}
                  onAdd={onAddCity}
                  placeholder="Search or add city..."
                  required
                  addingText="Add via AI"
                />
              </section>

              {/* ── Recruiter Contact ──────────────────────────────────────── */}
              <section className="ftrack-section">
                <p className="ftrack-section__title">Recruiter Contact</p>
                <div className="ftrack-form-row">
                  <div className="ftrack-field-group">
                    <label className="ftrack-label">Name</label>
                    <input
                      type="text"
                      className="ftrack-input"
                      placeholder="e.g. Tanvi Sen"
                      value={formState.contactName}
                      onChange={(e) => setFormState(prev => ({ ...prev, contactName: e.target.value }))}
                    />
                  </div>
                  <div className="ftrack-field-group">
                    <label className="ftrack-label">Phone</label>
                    <input
                      type="text"
                      className="ftrack-input"
                      placeholder="+91 98765 43210"
                      value={formState.contactNo}
                      onChange={(e) => setFormState(prev => ({ ...prev, contactNo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="ftrack-field-group">
                  <label className="ftrack-label">Email</label>
                  <input
                    type="email"
                    className="ftrack-input"
                    placeholder="hr@company.com"
                    value={formState.contactEmail}
                    onChange={(e) => setFormState(prev => ({ ...prev, contactEmail: e.target.value }))}
                  />
                </div>
              </section>

              {/* ── Compensation ───────────────────────────────────────────── */}
              <section className="ftrack-section">
                <p className="ftrack-section__title">Compensation (LPA)</p>
                <div className="ftrack-form-row">
                  <div className="ftrack-field-group">
                    <label className="ftrack-label">Expected *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      className="ftrack-input"
                      value={formState.expectedPackage || ''}
                      placeholder="0"
                      onChange={(e) => setFormState(prev => ({ ...prev, expectedPackage: Number(e.target.value) }))}
                      required
                    />
                  </div>
                  <div className="ftrack-field-group">
                    <label className="ftrack-label">Company Proposed</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      className="ftrack-input"
                      value={formState.companyProposed || ''}
                      placeholder="0"
                      onChange={(e) => setFormState(prev => ({ ...prev, companyProposed: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </section>

              {/* ── Status & Rounds ────────────────────────────────────────── */}
              <section className="ftrack-section">
                <p className="ftrack-section__title">Status &amp; Rounds</p>
                <div className="ftrack-form-row">
                  <div className="ftrack-field-group">
                    <label className="ftrack-label">Overall Status *</label>
                    <select
                      className="ftrack-select"
                      value={formState.status}
                      onChange={(e) => setFormState(prev => ({ ...prev, status: e.target.value }))}
                      required
                    >
                      {statusOptions.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ftrack-field-group">
                    <label className="ftrack-label">Total Rounds</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="ftrack-input"
                      value={formState.totalRounds}
                      onChange={(e) => handleTotalRoundsChange(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Round detail cards — edit mode only */}
                {interviewId && (
                  <div className="ftrack-rounds-list-edit">
                    {formState.rounds.map((round, rIdx) => {
                      const isActiveRound = formState.status === `Moved to Round ${round.roundNumber}`;
                      return (
                        <div
                          key={rIdx}
                          className={`ftrack-round-item-edit${isActiveRound ? ' ftrack-round-item-edit--active' : ''}`}
                        >
                          <div className="ftrack-round-item-header">
                            <h5>
                              Round {round.roundNumber}
                              {isActiveRound && <span className="ftrack-round-active-badge">Active</span>}
                            </h5>
                            <select
                              className="ftrack-select ftrack-select--sm"
                              value={round.status}
                              onChange={(e) => {
                                setFormState((prev) => {
                                  const copy = [...prev.rounds];
                                  copy[rIdx] = { ...copy[rIdx], status: e.target.value as Round['status'] };
                                  return { ...prev, rounds: copy };
                                });
                              }}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Expected">Expected</option>
                              <option value="Waiting">Waiting</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </div>

                          <div className="ftrack-round-item-fields">
                            <div className="ftrack-field-group">
                              <label className="ftrack-label">Round Name</label>
                              <input
                                type="text"
                                className="ftrack-input"
                                placeholder="e.g. System Design, Coding"
                                value={round.name}
                                onChange={(e) => {
                                  setFormState((prev) => {
                                    const copy = [...prev.rounds];
                                    copy[rIdx] = { ...copy[rIdx], name: e.target.value };
                                    return { ...prev, rounds: copy };
                                  });
                                }}
                              />
                            </div>

                            <div className="ftrack-field-group">
                              <label className="ftrack-label">Feedback / Improvements</label>
                              <input
                                type="text"
                                className="ftrack-input"
                                placeholder="e.g. Need to practice DP problems..."
                                value={round.feedback}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormState((prev) => {
                                    const copy = [...prev.rounds];
                                    copy[rIdx] = { ...copy[rIdx], feedback: val };
                                    const lastFeedback = [...copy].reverse().find((r) => r.feedback?.trim());
                                    return {
                                      ...prev,
                                      rounds: copy,
                                      lastRoundFeedback: lastFeedback ? lastFeedback.feedback : prev.lastRoundFeedback,
                                    };
                                  });
                                }}
                              />
                            </div>

                            {round._id && (
                              <div className="ftrack-round-questions-edit">
                                <label className="ftrack-label">Questions Asked</label>
                                <div className="ftrack-inline-add">
                                  <input
                                    type="text"
                                    className="ftrack-input"
                                    placeholder="Type question and press Add..."
                                    value={newQuestions[rIdx] || ''}
                                    onChange={(e) =>
                                      setNewQuestions((prev) => ({ ...prev, [rIdx]: e.target.value }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="ftrack-btn ftrack-btn--secondary ftrack-btn--sm"
                                    disabled={!(newQuestions[rIdx] || '').trim()}
                                    onClick={() => handleAddQuestion(rIdx)}
                                  >
                                    Add
                                  </button>
                                </div>
                                <div className="ftrack-questions-tags">
                                  {round.questions?.length ? (
                                    round.questions.map((qText, qIdx) => (
                                      <span key={qIdx} className="ftrack-question-tag">
                                        {qText}
                                        <button
                                          type="button"
                                          className="ftrack-remove-question"
                                          onClick={() => handleRemoveQuestion(rIdx, qIdx)}
                                        >×</button>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="ftrack-questions-empty">No questions logged yet</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

            </form>
          )}
        </div>

        <div className="ftrack-drawer-footer">
          <button
            type="button"
            className="ftrack-btn ftrack-btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="ftrack-drawer-form"
            className="ftrack-btn ftrack-btn--primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : interviewId ? 'Save Changes' : 'Track Interview'}
          </button>
        </div>
      </div>
    </div>
  );
}
