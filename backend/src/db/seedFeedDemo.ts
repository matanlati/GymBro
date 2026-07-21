/**
 * Adds a dense, repeatable set of demo posts for visually testing the feed.
 * Existing posts are preserved. Running this script again updates the same
 * seeded posts instead of creating duplicates.
 *
 * Run from backend/: npm run seed:feed
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import mongoose, { Types } from 'mongoose'
import { connectDB } from './connection'
import { User } from '../models/User.model'
import { WorkoutPost } from '../models/WorkoutPost.model'
import { WorkoutSession } from '../models/WorkoutSession.model'

const PHOTO_FILENAME = 'seed-dumbbells.jpg'
const PHOTO_URL = `/uploads/feed/${PHOTO_FILENAME}`

const postIdeas = [
  ['Push Day Progress', 'Bench felt smoother today. Added 2.5 kg and kept every rep controlled.', 'Push Day'],
  ['Morning Strength Session', 'Early workout done before the day got busy. Energy was surprisingly good.', 'Full Body Strength'],
  ['New Squat PB', 'Hit a clean personal best and still had a little left in the tank!', 'Lower Body'],
  ['Back to Basics', 'Focused on tempo, range of motion, and keeping every rep consistent.', 'Upper Body'],
  ['Quick Lunch Break Workout', 'Thirty focused minutes. Short sessions still count.', 'Express Workout'],
  ['Deadlift Day', 'The final set was tough, but my form stayed solid from the floor.', 'Posterior Chain'],
  ['Core Finisher Complete', 'Added one more round than last week. Small wins add up.', 'Core & Stability'],
  ['Pull Day Done', 'Rows and pull-ups are finally starting to feel stronger.', 'Pull Day'],
  ['Leg Day Survived', 'Walking downstairs may be tomorrow’s biggest challenge.', 'Leg Day'],
  ['Consistency Over Motivation', 'Did not feel like training today, but showed up and got it done.', 'Full Body'],
  ['Shoulder Press Progress', 'Better control overhead and no rushing through the hard reps.', 'Shoulders & Arms'],
  ['Weekend Training', 'A calm gym and a great session to finish the week.', 'Upper Body Strength'],
  ['Form First', 'Reduced the weight slightly and made every repetition cleaner.', 'Technique Session'],
  ['Strong Start to the Week', 'Monday workout complete. Ready to build on this momentum.', 'Push & Core'],
  ['Cardio Then Weights', 'Kept the cardio easy and saved enough energy for a strong lift.', 'Hybrid Training'],
  ['One More Rep', 'Matched last week’s weight and squeezed out an extra rep on every set.', 'Chest & Triceps'],
  ['Home Workout Complete', 'Dumbbells, a small space, and no excuses needed.', 'Home Strength'],
  ['Upper Body Burn', 'A simple session with a great pump and steady pacing.', 'Upper Body'],
  ['Recovery Day Movement', 'Kept it light, moved well, and left feeling better than I started.', 'Active Recovery'],
  ['Building the Habit', 'Another workout logged. The routine is becoming automatic.', 'Full Body'],
  ['Tempo Squats', 'Slow reps made a lighter load feel much harder—in a good way.', 'Lower Body Technique'],
  ['Arms and Accessories', 'Finished the main work with a few controlled accessory supersets.', 'Arms'],
  ['Small Gym Victory', 'Completed every planned set without cutting the rest periods short.', 'Strength Training'],
  ['Evening Session', 'Long day, good workout, clear head afterward.', 'Full Body Strength'],
  ['Dumbbell Circuit', 'Kept the transitions quick and the weights challenging.', 'Dumbbell Conditioning'],
  ['Bench Volume Complete', 'More total reps than last time with the same working weight.', 'Chest Strength'],
  ['Technique Is Clicking', 'The movement felt natural today after weeks of practice.', 'Skill & Strength'],
  ['Finished Strong', 'The last set was the best set. Great way to close the session.', 'Lower Body & Core'],
] as const

async function run() {
  await connectDB()

  const photoPath = path.resolve(process.cwd(), 'uploads', 'feed', PHOTO_FILENAME)
  if (!fs.existsSync(photoPath)) {
    throw new Error(`Missing feed photo at ${photoPath}`)
  }

  const trainees = await User.find({ role: 'trainee' }).sort({ createdAt: 1 }).select('_id name')
  const authors: Array<{ userId: Types.ObjectId; sessionId: Types.ObjectId }> = []
  for (const trainee of trainees) {
    const session = await WorkoutSession.findOne({ userId: trainee._id, completedAt: { $ne: null } })
      .sort({ completedAt: -1 })
      .select('_id')
    if (session) authors.push({ userId: trainee._id, sessionId: session._id })
  }

  if (!authors.length) throw new Error('No trainee with a completed workout session was found')

  const community = await User.find().sort({ createdAt: 1 }).select('_id')
  const communityIds = community.map(member => member._id)
  const baseDate = new Date()

  for (let index = 0; index < postIdeas.length; index++) {
    const [title, caption, workoutName] = postIdeas[index]
    const author = authors[index % authors.length]
    const postDate = new Date(baseDate)
    postDate.setHours(8 + (index % 11), (index * 13) % 60, 0, 0)
    postDate.setDate(postDate.getDate() - Math.floor(index / 2))

    const otherUsers = communityIds.filter(id => !id.equals(author.userId))
    const likedBy = otherUsers.filter((_, userIndex) => (userIndex + index) % 3 !== 0).slice(0, 4)
    const commentAuthors = otherUsers.slice(0, Math.min(3, otherUsers.length))
    const commentTexts = ['Strong work!', 'That progress is showing.', 'Nice session—keep it going!']
    const comments = commentAuthors.map((userId, commentIndex) => ({
      userId,
      text: commentTexts[(index + commentIndex) % commentTexts.length],
      createdAt: new Date(postDate.getTime() + (commentIndex + 1) * 18 * 60_000),
    }))

    await WorkoutPost.findOneAndUpdate(
      { userId: author.userId, title, caption },
      {
        $set: {
          sessionId: author.sessionId,
          workoutName,
          caption,
          photoUrl: index % 3 === 0 || index % 7 === 0 ? PHOTO_URL : undefined,
          likedBy,
          comments,
        },
        $setOnInsert: { userId: author.userId, title, postDate },
      },
      { upsert: true, runValidators: true }
    )
  }

  console.log(`Seeded ${postIdeas.length} feed posts across ${authors.length} trainee account(s).`)
  console.log(`Photo posts use ${PHOTO_URL}. Existing non-seed posts were preserved.`)
  await mongoose.disconnect()
}

run().catch(async error => {
  console.error('Feed seed failed:', error)
  await mongoose.disconnect()
  process.exit(1)
})
