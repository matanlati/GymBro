import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import mongoose from 'mongoose'
import { connectDB } from '../db/connection'
import { User } from '../models/User.model'
import { hashPassword, verifyPassword } from '../services/auth.service'

const EMAIL = 'ai.plan.tester@gymbro.test'
const NAME = 'AI Plan Test User'

async function run() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed the AI plan test user when NODE_ENV=production')
  }
  const password = process.env.AI_PLAN_TEST_PASSWORD
  if (!password || password.length < 6 || password.length > 72) {
    throw new Error('AI_PLAN_TEST_PASSWORD must contain between 6 and 72 characters')
  }

  await connectDB()
  const existing = await User.findOne({ email: EMAIL })
  if (!existing) {
    const passwordHash = await hashPassword(password)
    await User.create({
      email: EMAIL,
      passwordHash,
      name: NAME,
      role: 'trainee',
      timezone: 'UTC',
    })
    console.log(`CREATED ${EMAIL} as trainee with no coachId`)
    return
  }

  const changes: string[] = []
  if (existing.role !== 'trainee') {
    existing.role = 'trainee'
    changes.push('role')
  }
  if (existing.name !== NAME) {
    existing.name = NAME
    changes.push('name')
  }
  if (existing.coachId) {
    existing.coachId = undefined
    changes.push('coachId')
  }
  if (!(await verifyPassword(password, existing.passwordHash))) {
    existing.passwordHash = await hashPassword(password)
    changes.push('passwordHash')
  }
  if (changes.length) {
    await existing.save()
    console.log(`UPDATED ${EMAIL}: ${changes.join(', ')}`)
  } else {
    console.log(`ALREADY VALID ${EMAIL}: trainee with no coachId`)
  }
}

run()
  .catch(error => {
    console.error('AI plan test-user seed failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
