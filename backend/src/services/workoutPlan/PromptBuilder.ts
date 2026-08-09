import { QuestionnaireData } from '../../types'
import { RetrievalResult } from './ExerciseRetriever'

/**
 * Minimum main exercises per training day, by level. Without an explicit floor
 * the model settles on 2 per day regardless of how large the shortlist is.
 */
const MIN_EXERCISES_BY_LEVEL: Record<string, number> = {
  beginner: 5,
  intermediate: 6,
  advanced: 7,
  expert: 7,
}
const DEFAULT_MIN_EXERCISES = 5

export function minExercisesPerDay(trainingLevel?: string): number {
  return MIN_EXERCISES_BY_LEVEL[(trainingLevel || '').toLowerCase().trim()] ?? DEFAULT_MIN_EXERCISES
}

export class PromptBuilder {
  static buildPrompt(questionnaireData: QuestionnaireData, retrieval: RetrievalResult): string {
    const minPerDay = minExercisesPerDay(questionnaireData.trainingLevel)
    const maxPerDay = minPerDay + 2
    const knowledge = retrieval?.knowledge ?? []
    const exercises = retrieval?.exercises ?? []
    const advisories = retrieval?.advisories ?? []

    const contextStr = knowledge.map(doc => `- ${doc.text}`).join('\n')

    // When retrieval is unavailable the blocks collapse and the prompt degrades
    // to the pre-RAG instructions rather than referencing an empty shortlist.
    const candidateBlock = exercises.length
      ? `
Candidate Exercises (retrieved for this user's equipment, level, and limitations):
${exercises
  .map(
    exercise =>
      `- ${exercise.name} — targets ${exercise.primaryMuscles.join(', ') || 'general'}; ` +
      `equipment: ${exercise.equipment || 'none'}; level: ${exercise.level || 'beginner'}`
  )
  .join('\n')}

Build the plan from this candidate list. Prefer these exact exercise names, and reuse them
verbatim in the "name" field. Only introduce an exercise outside the list when the list has
no reasonable option for a slot, and never introduce one that needs equipment the user lacks.
`
      : ''

    const advisoryBlock = advisories.length
      ? `
Injury Constraints (these are hard requirements, not suggestions):
${advisories.map(advisory => `- ${advisory}`).join('\n')}
`
      : ''

    return `
You are an expert fitness trainer. Based on the user's questionnaire and relevant training knowledge, generate a personalized weekly workout plan.

User Profile:
- Age: ${questionnaireData.age || 'Not provided'}
- Gender: ${questionnaireData.gender || 'Not provided'}
- Height: ${questionnaireData.height ? questionnaireData.height + ' cm' : 'Not provided'}
- Weight: ${questionnaireData.weight ? questionnaireData.weight + ' kg' : 'Not provided'}
- Fitness Goal: ${questionnaireData.fitnessGoal || 'General fitness'}
- Training Level: ${questionnaireData.trainingLevel || 'Beginner'}
- Available Training Days: ${questionnaireData.trainingDays || '3'} per week
- Injuries/Limitations: ${questionnaireData.injuries || 'None'}
- Preferred Workout Type: ${questionnaireData.preferredWorkoutType || 'Mixed'}
- Equipment Available: ${questionnaireData.equipmentAvailable || 'Basic (dumbbells, bodyweight)'}

Relevant Training Knowledge:
${contextStr}
${candidateBlock}${advisoryBlock}
Instructions:
- Create a realistic, safe workout plan for ${questionnaireData.trainingDays} days per week.
- weeklyPlan must contain exactly ${questionnaireData.trainingDays} workout-day objects.
- Do not include rest days, recovery days, or days without exercises in weeklyPlan.
- Every weeklyPlan item must include day, focus, and a non-empty exercises array.
- Each training day must contain AT LEAST ${minPerDay} main exercises (aim for ${minPerDay}-${maxPerDay}).
  A day with only two or three exercises is not an acceptable workout — build a complete
  session that covers the day's focus with enough volume.
- Warm-up and cool-down entries do NOT count toward the ${minPerDay}-exercise minimum;
  include them in addition to the main exercises.
- Every exercise object must include "name", "sets", and "reps".
- "name", "sets", "reps", "durationMinutes", and "notes" must be strings, not numbers.
- Consider the user's training level, injuries, and available equipment.
- Include warm-up and cool-down if appropriate.
- Provide sets and reps appropriate for their level.
- For duration-based exercises such as warm-ups, cooldowns, cardio, and mobility, add
  "durationMinutes" (for example "5" or "5-10"). Use "sets": "1" and "reps": "N/A"
  for these exercises.
- Ensure progressive overload principles.
- Return the response as valid JSON with this exact structure:

{
  "summary": "Brief summary of the plan",
  "weeklyPlan": [
    {
      "day": "Day 1",
      "focus": "Main focus area",
      "exercises": [
        {
          "name": "Exercise name",
          "sets": "3",
          "reps": "10-12",
          "durationMinutes": "Only for duration-based exercises, otherwise omit",
          "notes": "Any specific notes"
        }
      ]
    }
  ],
  "safetyNotes": ["Note 1", "Note 2"],
  "progressionNotes": "How to progress over time"
}

IMPORTANT: Return ONLY the JSON object. Do not wrap it in markdown code blocks, backticks, or any other formatting. Do not include any explanatory text before or after the JSON.
`
  }

  static buildCorrectionPrompt(originalPrompt: string, invalidResponse: string): string {
    return `${originalPrompt}

The previous response was rejected because it did not follow the required structure.
Do not include entries such as { "day": "Wednesday (Rest Day)" }.
If a training day had too few exercises, add more from the candidate list until every day
meets the stated per-day minimum.
Every weeklyPlan item must be a workout day with day, focus, and at least one exercise.
Every exercise must include string fields "name", "sets", and "reps"; duration-based exercises
must use "sets": "1", "reps": "N/A", and a string "durationMinutes" value.
Return a corrected JSON object only.

Previous invalid response:
${invalidResponse}`
  }
}
