import type { AxiosPromise } from 'axios'
import {
  createGoal,
  createMeasurement,
  deleteGoal,
  deleteMeasurement,
  getExerciseSeries,
  getSummary,
  listAchievements,
  listGoals,
  listMeasurements,
  updateGoal,
  updateMeasurement,
} from './progress.api'
import type {
  AchievementCategory,
  AchievementUnlock,
  BodyMeasurement,
  BodyMeasurementPayload,
  CreateProgressGoalPayload,
  ExercisePoint,
  ProgressGoal,
  ProgressGoalStatus,
  ProgressSummary,
  UpdateProgressGoalPayload,
} from './progress.api'
import {
  createCoachTraineeGoal,
  deleteCoachTraineeGoal,
  getCoachTraineeExerciseSeries,
  getCoachTraineeProgressSummary,
  listCoachTraineeAchievements,
  listCoachTraineeGoals,
  listCoachTraineeMeasurements,
  updateCoachTraineeGoal,
} from './coach.api'

export interface ProgressDataSource {
  getSummary(): AxiosPromise<ProgressSummary>
  getExerciseSeries(exerciseName: string): AxiosPromise<ExercisePoint[]>
  goals: {
    list(status?: ProgressGoalStatus): AxiosPromise<ProgressGoal[]>
    create(payload: CreateProgressGoalPayload): AxiosPromise<ProgressGoal>
    update(goalId: string, payload: UpdateProgressGoalPayload): AxiosPromise<ProgressGoal>
    remove(goalId: string): AxiosPromise<void>
  }
  achievements: {
    list(category?: AchievementCategory, limit?: number): AxiosPromise<AchievementUnlock[]>
  }
  measurements: {
    list(params?: MeasurementFilters): AxiosPromise<BodyMeasurement[]>
    create?: (payload: BodyMeasurementPayload) => AxiosPromise<BodyMeasurement>
    update?: (measurementId: string, payload: BodyMeasurementPayload) => AxiosPromise<BodyMeasurement>
    remove?: (measurementId: string) => AxiosPromise<void>
  }
}

export interface MeasurementFilters {
  from?: string
  to?: string
  limit?: number
}

export const traineeProgressDataSource: ProgressDataSource = {
  getSummary,
  getExerciseSeries,
  goals: {
    list: listGoals,
    create: createGoal,
    update: updateGoal,
    remove: deleteGoal,
  },
  achievements: {
    list: listAchievements,
  },
  measurements: {
    list: listMeasurements,
    create: createMeasurement,
    update: updateMeasurement,
    remove: deleteMeasurement,
  },
}

export const createCoachProgressDataSource = (traineeId: string): ProgressDataSource => ({
  getSummary: () => getCoachTraineeProgressSummary(traineeId),
  getExerciseSeries: exerciseName =>
    getCoachTraineeExerciseSeries(traineeId, exerciseName),
  goals: {
    list: status => listCoachTraineeGoals(traineeId, status),
    create: payload => createCoachTraineeGoal(traineeId, payload),
    update: (goalId, payload) => updateCoachTraineeGoal(traineeId, goalId, payload),
    remove: goalId => deleteCoachTraineeGoal(traineeId, goalId),
  },
  achievements: {
    list: (category, limit) => listCoachTraineeAchievements(traineeId, category, limit),
  },
  measurements: {
    list: params => listCoachTraineeMeasurements(traineeId, params),
  },
})
