const fetch = require('node-fetch');

const url = 'http://localhost:3001/api/workout-plan/generate';
const data = {
  age: 25,
  gender: 'male',
  height: 180,
  weight: 75,
  fitnessGoal: 'muscle_gain',
  trainingLevel: 'beginner',
  trainingDays: 3,
  injuries: 'none',
  preferredWorkoutType: 'strength',
  equipmentAvailable: 'dumbbells'
};

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
  .then(async res => {
    console.log('status', res.status);
    console.log(await res.text());
  })
  .catch(err => {
    console.error('error', err.message);
  });
