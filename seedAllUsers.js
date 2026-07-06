/**
 * GymBro — seed Progress demo data for ALL users.
 *
 * Run on the server with mongosh:
 *   mongosh "mongodb://group119:admin119@127.0.0.1:21771/gymbro" seedAllUsers.js
 *
 * Behaviour (per user):
 *   - Idempotent & non-destructive: removes only THIS script's previous seed
 *     (a plan titled SEED_PLAN_TITLE + that plan's sessions), keeps every other
 *     plan/session, then deactivates other plans and inserts a fresh active
 *     "Strength Builder" plan with 24 back-dated completed sessions.
 *   - Weight curves trend upward but include plateaus, deloads and noise, so the
 *     Progress strength chart looks realistic (not a straight ramp).
 *
 * Safe to re-run any time. Only touches the "Strength Builder" seed per user.
 */

// ── Config ───────────────────────────────────────────────────────────────────
const SEED_PLAN_TITLE = 'Strength Builder';
const SESSION_COUNT = 24; // ~8 weeks x 3 training days

const PLAN_DAYS = [
  {
    day: 'Monday',
    focus: 'Upper Body Strength',
    exercises: [
      { name: 'Bench Press',    sets: 4, reps: 8,  startWeight: 60, increment: 2.5 },
      { name: 'Shoulder Press', sets: 3, reps: 10, startWeight: 30, increment: 1.5 },
      { name: 'Barbell Row',    sets: 4, reps: 8,  startWeight: 50, increment: 2 },
    ],
  },
  {
    day: 'Thursday',
    focus: 'Lower Body Strength',
    exercises: [
      { name: 'Squat',     sets: 5, reps: 5,  startWeight: 80,  increment: 2.5 },
      { name: 'Deadlift',  sets: 3, reps: 5,  startWeight: 100, increment: 5 },
      { name: 'Leg Press', sets: 3, reps: 12, startWeight: 120, increment: 5 },
    ],
  },
  {
    day: 'Saturday',
    focus: 'Chest & Triceps',
    exercises: [
      { name: 'Barbell Bench Press',         sets: 3, reps: 9,  startWeight: 40, increment: 2.5 },
      { name: 'Incline Dumbbell Press',      sets: 3, reps: 11, startWeight: 18, increment: 1 },
      { name: 'Tricep Pushdowns (machine)',  sets: 3, reps: 12, startWeight: 25, increment: 1.5 },
      { name: 'Overhead Dumbbell Extension', sets: 3, reps: 13, startWeight: 12, increment: 1 },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(9, 0, 0, 0);
  return x;
}
function roundToPlate(w) { return Math.round(w * 2) / 2; }
function jitter(base, amount) {
  return Math.round((base + (Math.random() * 2 - 1) * amount) * 10) / 10;
}

// Upward-but-varied weight series per exercise (plateaus, deloads, noise).
function buildWeightSeries(ex, blocks) {
  const series = [];
  let weight = ex.startWeight;
  const baselineStep = ex.increment * 0.6;

  for (let b = 0; b < blocks; b++) {
    const roll = Math.random();
    if (b === 0) {
      // start where we start
    } else if (roll < 0.2) {
      weight += baselineStep * 0.3;                    // plateau
    } else if (roll < 0.32) {
      weight -= ex.increment * (0.8 + Math.random());  // deload / off day
    } else if (roll < 0.52) {
      weight += baselineStep + ex.increment * 0.3;     // small bump
    } else {
      weight += baselineStep + ex.increment * (roll > 0.85 ? 1.5 : 0.7); // progress
    }
    const noisy = weight + (Math.random() * 2 - 1) * (ex.increment * 0.4);
    const floor = ex.startWeight + baselineStep * b * 0.4;
    series.push(roundToPlate(Math.max(floor, noisy)));
  }
  return series;
}

// ── Seed one user ────────────────────────────────────────────────────────────
function seedUser(userId) {
  // 1. Remove only this script's previous seed (plan + its sessions).
  const priorPlans = db.workoutplans.find(
    { userId: userId, title: SEED_PLAN_TITLE }, { _id: 1 }
  ).toArray();
  const priorIds = priorPlans.map(p => p._id);
  if (priorIds.length) {
    db.workoutsessions.deleteMany({ userId: userId, planId: { $in: priorIds } });
    db.workoutplans.deleteMany({ _id: { $in: priorIds } });
  }

  // 2. Only one active plan at a time — deactivate the user's others.
  db.workoutplans.updateMany({ userId: userId, isActive: true }, { $set: { isActive: false } });

  // 3. Insert the active seed plan.
  const now = new Date();
  const planDoc = {
    userId: userId,
    title: SEED_PLAN_TITLE,
    programType: 'Strength',
    summary: 'A 3-day strength split with progressive overload.',
    weeklyPlan: PLAN_DAYS.map(d => ({
      day: d.day,
      focus: d.focus,
      exercises: d.exercises.map(e => ({ name: e.name, sets: String(e.sets), reps: String(e.reps) })),
    })),
    safetyNotes: ['Warm up before every session', 'Stop if you feel sharp pain'],
    progressionNotes: 'Add ~2.5kg once you hit all prescribed reps.',
    isActive: true,
    createdAt: now,
  };
  const planId = db.workoutplans.insertOne(planDoc).insertedId;

  // 4. Pre-generate an organic weight series per exercise.
  const blocksPerExercise = Math.ceil(SESSION_COUNT / PLAN_DAYS.length);
  const weightSeries = {};
  for (const day of PLAN_DAYS) {
    for (const ex of day.exercises) {
      weightSeries[ex.name] = buildWeightSeries(ex, blocksPerExercise);
    }
  }

  // 5. Build back-dated completed sessions (recent ones on consecutive days).
  const today = startOfDay(now);
  const sessions = [];
  for (let i = 0; i < SESSION_COUNT; i++) {
    const dayDef = PLAN_DAYS[i % PLAN_DAYS.length];
    const dayIndex = i % PLAN_DAYS.length;
    const blockIndex = Math.floor(i / PLAN_DAYS.length);

    const daysAgo = (i >= SESSION_COUNT - 4)
      ? (SESSION_COUNT - 1 - i)          // last 4 on consecutive days -> live streak
      : (SESSION_COUNT - 1 - i) + 6;     // older ones spread further back
    const scheduledDate = new Date(today);
    scheduledDate.setDate(scheduledDate.getDate() - daysAgo);
    const completedAt = new Date(scheduledDate);
    completedAt.setHours(completedAt.getHours() + 1);

    const exercises = dayDef.exercises.map((ex, orderIndex) => {
      const series = weightSeries[ex.name];
      const topWeight = series[Math.min(blockIndex, series.length - 1)];
      const sets = [];
      for (let s = 0; s < ex.sets; s++) {
        const rampFactor = ex.sets > 1 ? 0.9 + (0.1 * s) / (ex.sets - 1) : 1;
        sets.push({
          setNumber: s + 1,
          repsCompleted: Math.max(1, Math.round(jitter(ex.reps, 1.5))),
          weightUsedKg: roundToPlate(Math.max(ex.startWeight, topWeight * rampFactor)),
          loggedAt: completedAt,
        });
      }
      return {
        name: ex.name,
        prescribedSets: String(ex.sets),
        prescribedReps: String(ex.reps),
        orderIndex: orderIndex,
        sets: sets,
      };
    });

    sessions.push({
      userId: userId,
      planId: planId,
      dayIndex: dayIndex,
      scheduledDate: scheduledDate,
      completedAt: completedAt,
      exercises: exercises,
      createdAt: completedAt,
    });
  }
  db.workoutsessions.insertMany(sessions);
  return sessions.length;
}

// ── Run for every user ───────────────────────────────────────────────────────
const users = db.users.find({}, { _id: 1, email: 1 }).toArray();
if (users.length === 0) {
  print('No users found in this database. Nothing to seed.');
} else {
  let totalSessions = 0;
  users.forEach(u => {
    const n = seedUser(u._id);
    totalSessions += n;
    print('  seeded ' + n + ' sessions for ' + (u.email || u._id));
  });
  print('');
  print('Done. Seeded ' + users.length + ' user(s), ' + totalSessions + ' sessions total.');
  print('Each user now has an active "' + SEED_PLAN_TITLE + '" plan; other data preserved.');
}
