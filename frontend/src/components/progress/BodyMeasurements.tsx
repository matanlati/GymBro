import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Scale, Trash2, X } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  FormField,
  Input,
  LoadingState,
} from '@gymbro/ui-kit'
import {
  BodyMeasurement,
  BodyMeasurementPayload,
} from '../../api/progress.api'
import type { ProgressDataSource } from '../../api/progressDataSource'
import type { ProgressDashboardPermissions } from './ProgressDashboard'
import LineChart from './LineChart'

type MeasurementMetric = 'weightKg' | 'bodyFatPercent' | 'muscleMassKg'

const METRICS: { key: MeasurementMetric; label: string; unit: string; color: string }[] = [
  { key: 'weightKg', label: 'Weight', unit: 'kg', color: '#2563eb' },
  { key: 'bodyFatPercent', label: 'Body fat', unit: '%', color: '#f97316' },
  { key: 'muscleMassKg', label: 'Muscle mass', unit: 'kg', color: '#16a34a' },
]

const dateInputValue = (iso?: string) => {
  const date = iso ? new Date(iso) : new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

interface BodyMeasurementsProps {
  dataSource: ProgressDataSource
  permissions: ProgressDashboardPermissions
}

export default function BodyMeasurements({
  dataSource,
  permissions,
}: BodyMeasurementsProps) {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [metric, setMetric] = useState<MeasurementMetric>('weightKg')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<BodyMeasurement | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [measuredAt, setMeasuredAt] = useState(dateInputValue())
  const [weightKg, setWeightKg] = useState('')
  const [bodyFatPercent, setBodyFatPercent] = useState('')
  const [muscleMassKg, setMuscleMassKg] = useState('')
  const [pendingDelete, setPendingDelete] = useState<BodyMeasurement | null>(null)

  const loadMeasurements = async () => {
    const { data } = await dataSource.measurements.list({ limit: 100 })
    setMeasurements(data)
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setMeasurements([])

    dataSource.measurements.list({ limit: 100 })
      .then(({ data }) => {
        if (active) setMeasurements(data)
      })
      .catch(() => {
        if (active) setError('Could not load body measurements.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [dataSource])

  const selectedMetric = METRICS.find(item => item.key === metric)!
  const points = useMemo(
    () => measurements
      .filter(item => item[metric] !== undefined)
      .slice()
      .reverse()
      .map(item => ({
        label: new Date(item.measuredAt).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric',
        }),
        value: item[metric] as number,
      })),
    [measurements, metric]
  )

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setMeasuredAt(dateInputValue())
    setWeightKg('')
    setBodyFatPercent('')
    setMuscleMassKg('')
    setError('')
  }

  const startEdit = (measurement: BodyMeasurement) => {
    if (!permissions.canEditMeasurements) return
    setEditing(measurement)
    setMeasuredAt(dateInputValue(measurement.measuredAt))
    setWeightKg(measurement.weightKg?.toString() ?? '')
    setBodyFatPercent(measurement.bodyFatPercent?.toString() ?? '')
    setMuscleMassKg(measurement.muscleMassKg?.toString() ?? '')
    setShowForm(true)
  }

  const submitMeasurement = async (event: FormEvent) => {
    event.preventDefault()
    if (editing ? !permissions.canEditMeasurements : !permissions.canAddMeasurements) return
    if (!weightKg && !bodyFatPercent && !muscleMassKg) {
      setError('Enter at least one measurement.')
      return
    }

    const payload: BodyMeasurementPayload = {
      measuredAt: new Date(`${measuredAt}T12:00:00`).toISOString(),
      ...(weightKg ? { weightKg: Number(weightKg) } : {}),
      ...(bodyFatPercent ? { bodyFatPercent: Number(bodyFatPercent) } : {}),
      ...(muscleMassKg ? { muscleMassKg: Number(muscleMassKg) } : {}),
    }

    setSaving(true)
    setError('')
    try {
      if (editing) await dataSource.measurements.update?.(editing._id, payload)
      else await dataSource.measurements.create?.(payload)
      await loadMeasurements()
      window.dispatchEvent(new Event('progress-data-changed'))
      closeForm()
    } catch {
      setError('Could not save this measurement. Please check the values and try again.')
    } finally {
      setSaving(false)
    }
  }

  const requestMeasurementDelete = (measurement: BodyMeasurement) => {
    if (!permissions.canDeleteMeasurements) return
    setPendingDelete(measurement)
  }

  const closeDeleteDialog = () => {
    if (!deleting) setPendingDelete(null)
  }

  const confirmMeasurementDelete = async () => {
    if (!permissions.canDeleteMeasurements || !pendingDelete) return
    setDeleting(true)
    setError('')
    try {
      await dataSource.measurements.remove?.(pendingDelete._id)
      setMeasurements(current => current.filter(item => item._id !== pendingDelete._id))
      window.dispatchEvent(new Event('progress-data-changed'))
      setPendingDelete(null)
    } catch {
      setError('Could not delete this measurement.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <LoadingState label="Loading body measurements..." />

  return (
    <Card as="section" className="progress-card measurements-card">
      <CardHeader
        title="Body Measurements"
        trailing={permissions.canAddMeasurements ? (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={showForm ? <X size={16} /> : <Plus size={16} />}
            onClick={() => showForm ? closeForm() : setShowForm(true)}
          >
            {showForm ? 'Cancel' : 'Add measurement'}
          </Button>
        ) : undefined}
      />

      {error && <Alert variant="error">{error}</Alert>}

      {showForm && (editing ? permissions.canEditMeasurements : permissions.canAddMeasurements) && (
        <form className="measurement-form" onSubmit={submitMeasurement}>
          <FormField label="Date">
            <Input
              type="date"
              value={measuredAt}
              max={dateInputValue()}
              onChange={event => setMeasuredAt(event.target.value)}
              required
            />
          </FormField>
          <FormField label="Weight (kg)">
            <Input type="number" min="20" max="400" step="0.1" value={weightKg} onChange={event => setWeightKg(event.target.value)} />
          </FormField>
          <FormField label="Body fat (%)">
            <Input type="number" min="0" max="100" step="0.1" value={bodyFatPercent} onChange={event => setBodyFatPercent(event.target.value)} />
          </FormField>
          <FormField label="Muscle mass (kg)">
            <Input type="number" min="0.1" step="0.1" value={muscleMassKg} onChange={event => setMuscleMassKg(event.target.value)} />
          </FormField>
          <Button type="submit" size="sm" loading={saving} loadingLabel="Saving...">
            {editing ? 'Update entry' : 'Save entry'}
          </Button>
        </form>
      )}

      <div className="measurement-layout">
        <div className="measurement-chart-panel">
          <div className="measurement-tabs" role="tablist" aria-label="Measurement trend">
            {METRICS.map(item => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={metric === item.key}
                className={metric === item.key ? 'is-active' : ''}
                onClick={() => setMetric(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <LineChart
            data={points}
            color={selectedMetric.color}
            unit={selectedMetric.unit}
            emptyText={`No ${selectedMetric.label.toLowerCase()} entries yet.`}
          />
        </div>

        <div className="measurement-history">
          <h3>Recent entries</h3>
          {measurements.length === 0 ? (
            <EmptyState>No measurements logged yet.</EmptyState>
          ) : (
            <ul>
              {measurements.slice(0, 6).map(measurement => (
                <li key={measurement._id}>
                  <span className="measurement-entry-icon"><Scale size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>{new Date(measurement.measuredAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}</strong>
                    <span>
                      {[
                        measurement.weightKg !== undefined ? `${measurement.weightKg} kg` : '',
                        measurement.bodyFatPercent !== undefined ? `${measurement.bodyFatPercent}% fat` : '',
                        measurement.muscleMassKg !== undefined ? `${measurement.muscleMassKg} kg muscle` : '',
                      ].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  {(permissions.canEditMeasurements || permissions.canDeleteMeasurements) && (
                    <div className="measurement-entry-actions">
                      {permissions.canEditMeasurements && (
                        <button type="button" onClick={() => startEdit(measurement)} aria-label="Edit measurement" title="Edit measurement">
                          <Pencil size={15} />
                        </button>
                      )}
                      {permissions.canDeleteMeasurements && (
                        <button type="button" onClick={() => requestMeasurementDelete(measurement)} aria-label="Delete measurement" title="Delete measurement">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {pendingDelete && (
        <div
          className="coach-modal-backdrop"
          role="presentation"
          onClick={closeDeleteDialog}
        >
          <section
            className="coach-modal measurement-delete-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="measurement-delete-title"
            aria-describedby="measurement-delete-description"
            onClick={event => event.stopPropagation()}
          >
            <div className="measurement-delete-icon" aria-hidden="true">
              <Trash2 size={22} />
            </div>
            <div className="measurement-delete-copy">
              <h2 id="measurement-delete-title">Delete measurement?</h2>
              <p id="measurement-delete-description">
                The entry from {new Date(pendingDelete.measuredAt).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })} will be permanently removed.
              </p>
            </div>
            <div className="coach-modal-actions">
              <Button variant="secondary" onClick={closeDeleteDialog} disabled={deleting}>
                Cancel
              </Button>
              <Button
                className="measurement-delete-confirm-button"
                leadingIcon={<Trash2 size={16} />}
                loading={deleting}
                loadingLabel="Deleting..."
                onClick={confirmMeasurementDelete}
              >
                Delete entry
              </Button>
            </div>
          </section>
        </div>
      )}
    </Card>
  )
}
