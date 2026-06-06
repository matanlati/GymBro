import { QuestionnaireData } from '../../types'

export class PromptBuilder {
  static buildPrompt(questionnaireData: QuestionnaireData, retrievedContext: string[]): string {
    const contextStr = retrievedContext.join('\n')

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

Instructions:
- Create a realistic, safe workout plan for ${questionnaireData.trainingDays} days per week.
- Consider the user's training level, injuries, and available equipment.
- Include warm-up and cool-down if appropriate.
- Provide sets and reps appropriate for their level.
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
}
