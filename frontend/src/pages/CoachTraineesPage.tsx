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
} from "@gymbro/ui-kit";
import { AxiosError } from "axios";
import { Plus, Trash2 } from "lucide-react";
import {
  CoachInvite,
  CoachUser,
  listCoachInvites,
  listCoachTrainees,
  removeCoachTrainee,
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
                      <tr key={trainee._id}>
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
                            onClick={() => removeTrainee(trainee)}
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
    </main>
  );
}
