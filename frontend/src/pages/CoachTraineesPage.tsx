import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Textarea,
} from "@gymbro/ui-kit";
import { AxiosError } from "axios";
import { Plus, Trash2, X } from "lucide-react";
import {
  CoachInvite,
  CoachUser,
  getCoachTraineeNotes,
  listCoachInvites,
  listCoachTrainees,
  removeCoachTrainee,
  saveCoachTraineeNotes,
  sendCoachInvite,
} from "../api/coach.api";
import { useAuth } from "../context/AuthContext";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "T";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function CoachTraineesPage() {
  const { user } = useAuth();
  const [trainees, setTrainees] = useState<CoachUser[]>([]);
  const [invites, setInvites] = useState<CoachInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [selectedTrainee, setSelectedTrainee] = useState<CoachUser | null>(null);
  const [notes, setNotes] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState("");

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === "pending"),
    [invites],
  );

  useEffect(() => {
    Promise.all([
      listCoachTrainees().then(({ data }) => setTrainees(data)),
      listCoachInvites().then(({ data }) => setInvites(data)),
    ]).finally(() => setLoading(false));
  }, []);

  if (user?.role !== "coach") return <Navigate to="/home" replace />;

  const openModal = () => {
    setEmail("");
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setError("");
  };

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = await sendCoachInvite(email);
      setInvites((current) => [
        data,
        ...current.filter((invite) => invite._id !== data._id),
      ]);
      setModalOpen(false);
      setEmail("");
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setError(axiosErr.response?.data?.message || "Could not send invite");
    } finally {
      setSaving(false);
    }
  };

  const removeTrainee = async (trainee: CoachUser) => {
    if (
      !window.confirm(
        `Remove ${trainee.name} from your trainees? Their account will not be deleted.`,
      )
    )
      return;

    setRemovingId(trainee._id);
    setPageError("");
    try {
      await removeCoachTrainee(trainee._id);
      setTrainees((current) =>
        current.filter((item) => item._id !== trainee._id),
      );
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setPageError(
        axiosErr.response?.data?.message || "Could not remove trainee",
      );
    } finally {
      setRemovingId("");
    }
  };

  const openTrainee = async (trainee: CoachUser) => {
    setSelectedTrainee(trainee);
    setNotes("");
    setNotesError("");
    setNotesLoading(true);
    try {
      const { data } = await getCoachTraineeNotes(trainee._id);
      setNotes(data.notes);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setNotesError(axiosErr.response?.data?.message || "Could not load coach notes");
    } finally {
      setNotesLoading(false);
    }
  };

  const closeTrainee = () => {
    if (notesSaving) return;
    setSelectedTrainee(null);
    setNotesError("");
  };

  const submitNotes = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTrainee) return;
    setNotesSaving(true);
    setNotesError("");
    try {
      await saveCoachTraineeNotes(selectedTrainee._id, notes);
      setSelectedTrainee(null);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setNotesError(axiosErr.response?.data?.message || "Could not save coach notes");
    } finally {
      setNotesSaving(false);
    }
  };

  const displayValue = (value: string | number | undefined, suffix = "") =>
    value === undefined || value === "" ? "Not provided" : `${value}${suffix}`;

  return (
    <main className="coach-trainees-page">
      <PageHeader
        title="Trainees"
        subtitle="Manage trainees and pending invitations"
      />

      {pageError ? <Alert variant="error">{pageError}</Alert> : null}

      {loading ? (
        <LoadingState label="Loading trainees..." />
      ) : (
        <div className="coach-trainees-grid">
          <Card className="coach-panel">
            <div className="coach-panel-head">
              <div>
                <h2>Active Trainees</h2>
                <p>People currently training with you</p>
              </div>
              <div className="coach-panel-head-actions">
                <span>{trainees.length}</span>
                <Button
                  size="sm"
                  leadingIcon={<Plus size={15} />}
                  onClick={openModal}
                >
                  Add Trainee
                </Button>
              </div>
            </div>
            {trainees.length === 0 ? (
              <EmptyState>
                No trainees yet. Invite a trainee by email to get started.
              </EmptyState>
            ) : (
              <div className="coach-table-wrap">
                <table className="coach-trainees-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainees.map((trainee) => (
                      <tr
                        className="coach-trainee-row"
                        key={trainee._id}
                        tabIndex={0}
                        onClick={() => openTrainee(trainee)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") openTrainee(trainee);
                        }}
                      >
                        <td>
                          <span className="coach-avatar">
                            {initials(trainee.name)}
                          </span>
                          <strong>{trainee.name}</strong>
                        </td>
                        <td>{trainee.email}</td>
                        <td>
                          <button
                            className="coach-delete-action"
                            type="button"
                            aria-label={`Remove ${trainee.name}`}
                            title="Remove trainee"
                            disabled={removingId === trainee._id}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeTrainee(trainee);
                            }}
                          >
                            <Trash2 size={16} />
                            <span>
                              {removingId === trainee._id
                                ? "Removing..."
                                : "Remove"}
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="coach-panel">
            <div className="coach-panel-head">
              <div>
                <h2>Pending Invites</h2>
                <p>Waiting for a response</p>
              </div>
              <span>{pendingInvites.length}</span>
            </div>
            {pendingInvites.length === 0 ? (
              <EmptyState>No pending invitations.</EmptyState>
            ) : (
              <div className="coach-list">
                {pendingInvites.map((invite) => (
                  <article className="coach-list-item" key={invite._id}>
                    <span className="coach-avatar">
                      {initials(invite.traineeId?.name ?? invite.traineeEmail)}
                    </span>
                    <div>
                      <strong>
                        {invite.traineeId?.name ?? invite.traineeEmail}
                      </strong>
                      <small>{invite.traineeEmail}</small>
                      <small>Sent {formatDate(invite.createdAt)}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {modalOpen ? (
        <div
          className="coach-modal-backdrop"
          role="presentation"
          onClick={closeModal}
        >
          <section
            className="coach-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add trainee"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="coach-modal-head">
              <div>
                <h2>Add Trainee</h2>
                <p>Send an invite to an existing trainee account.</p>
              </div>
              <button
                type="button"
                aria-label="Close add trainee modal"
                onClick={closeModal}
              >
                x
              </button>
            </div>

            <form className="coach-invite-form" onSubmit={submitInvite}>
              <FormField label="Trainee email">
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="trainee@example.com"
                  required
                />
              </FormField>
              {error ? <Alert variant="error">{error}</Alert> : null}
              <div className="coach-modal-actions">
                <Button variant="secondary" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  loadingLabel="Sending..."
                >
                  Send Invite
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {selectedTrainee ? (
        <div className="coach-modal-backdrop" role="presentation" onClick={closeTrainee}>
          <section
            className="coach-modal coach-trainee-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trainee-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="coach-modal-head coach-trainee-detail-head">
              <div className="coach-trainee-detail-identity">
                <span className="coach-avatar">{initials(selectedTrainee.name)}</span>
                <div>
                  <h2 id="trainee-detail-title">{selectedTrainee.name}</h2>
                  <p>{selectedTrainee.email}</p>
                </div>
              </div>
              <button type="button" aria-label="Close trainee details" onClick={closeTrainee}><X size={17} /></button>
            </div>

            <div className="coach-trainee-info-grid">
              <div><span>Age</span><strong>{displayValue(selectedTrainee.age, " years")}</strong></div>
              <div><span>Height</span><strong>{displayValue(selectedTrainee.heightCm, " cm")}</strong></div>
              <div><span>Weight</span><strong>{displayValue(selectedTrainee.weightKg, " kg")}</strong></div>
              <div><span>Fitness level</span><strong>{displayValue(selectedTrainee.fitnessLevel)}</strong></div>
              <div className="coach-trainee-goal"><span>Goal</span><strong>{displayValue(selectedTrainee.goals)}</strong></div>
            </div>

            <form className="coach-notes-form" onSubmit={submitNotes}>
              <div className="coach-notes-heading">
                <div><h3>Private coach notes</h3><p>Only you can see these notes.</p></div>
                <small>{notes.length}/5000</small>
              </div>
              {notesLoading ? (
                <LoadingState label="Loading notes..." />
              ) : (
                <Textarea
                  value={notes}
                  maxLength={5000}
                  rows={6}
                  placeholder="Add observations, reminders, or coaching context..."
                  onChange={(event) => setNotes(event.target.value)}
                />
              )}
              {notesError ? <Alert variant="error">{notesError}</Alert> : null}
              <div className="coach-modal-actions">
                <Button variant="secondary" onClick={closeTrainee}>Cancel</Button>
                <Button type="submit" loading={notesSaving} loadingLabel="Saving..." disabled={notesLoading}>Save Notes</Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
