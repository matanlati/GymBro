# AI Workout-Plan Profile Catalogue

Source: `test-data/ai-plan-profiles.json`. Every payload explicitly supplies all ten fields accepted by the current questionnaire. Values follow the frontend controls: goals `weight_loss`, `muscle_gain`, `strength`, `endurance`, `general_fitness`; levels `beginner`, `intermediate`, `advanced`; days 2–6; genders `male`, `female`, `other`; preferences `strength`, `cardio`, `mixed`; and equipment `Gym`, `Home`, `Dumbbells`, `Machines`, `Bodyweight`, `Barbell`, `Kettlebells`.

The application enforces no age, height, weight, injury-length, or whitespace bounds. Catalogue numeric values are positive adult test data, not claimed application boundaries.

| ID | Name | Age | Gender | Height | Weight | Goal | Level | Days | Injury/limitation | Preference | Equipment | Reason |
|---|---|---:|---|---:|---:|---|---|---:|---|---|---|---|
| PLAN-PROFILE-001 | Beginner muscle gain full gym | 22 | male | 178 | 72 | muscle_gain | beginner | 3 | None | strength | Gym, Dumbbells, Machines, Barbell | Baseline hypertrophy |
| PLAN-PROFILE-002 | Beginner weight loss at home | 34 | female | 164 | 81 | weight_loss | beginner | 4 | None | mixed | Home, Bodyweight | Minimal-equipment weight loss |
| PLAN-PROFILE-003 | Intermediate strength barbell | 29 | male | 183 | 88 | strength | intermediate | 4 | None | strength | Gym, Barbell | Barbell strength |
| PLAN-PROFILE-004 | Advanced endurance limited days | 31 | female | 170 | 63 | endurance | advanced | 2 | None | cardio | Gym, Machines | Advanced/minimum days |
| PLAN-PROFILE-005 | General fitness maximum days | 40 | other | 175 | 76 | general_fitness | intermediate | 6 | None | mixed | All gym modalities | Maximum days |
| PLAN-PROFILE-006 | Beginner high availability | 19 | male | 171 | 61 | general_fitness | beginner | 6 | None | mixed | Gym, Bodyweight | Beginner/high availability |
| PLAN-PROFILE-007 | Advanced strength bodyweight only | 27 | female | 168 | 59 | strength | advanced | 3 | None | strength | Home, Bodyweight | Difficult equipment constraint |
| PLAN-PROFILE-008 | Intermediate hypertrophy machines | 45 | male | 180 | 92 | muscle_gain | intermediate | 5 | None | strength | Gym, Machines | Machine-only hypertrophy |
| PLAN-PROFILE-009 | Endurance home cardio | 26 | female | 160 | 54 | endurance | beginner | 5 | None | cardio | Home, Bodyweight | No-gym endurance |
| PLAN-PROFILE-010 | Weight loss kettlebells | 38 | male | 176 | 101 | weight_loss | intermediate | 3 | None | mixed | Home, Kettlebells | Portable equipment |
| PLAN-PROFILE-011 | Knee pain general fitness | 52 | female | 162 | 74 | general_fitness | beginner | 3 | Knee pain; no deep flexion/jumping | mixed | Gym, Machines, Dumbbells | Knee limitation |
| PLAN-PROFILE-012 | Lower back limitation strength | 43 | male | 185 | 96 | strength | intermediate | 4 | Back pain; no deadlifts/axial loading | strength | Gym, Machines, Dumbbells | Spinal-loading constraint |
| PLAN-PROFILE-013 | Shoulder injury hypertrophy | 36 | female | 173 | 68 | muscle_gain | intermediate | 4 | Impingement; no overhead press | strength | Gym, Machines, Dumbbells | Shoulder constraint |
| PLAN-PROFILE-014 | Ankle limitation endurance | 48 | male | 174 | 83 | endurance | beginner | 3 | Ankle sprain; low impact/no running | cardio | Gym, Machines | Low-impact endurance |
| PLAN-PROFILE-015 | Wrist limitation bodyweight | 24 | other | 169 | 66 | general_fitness | beginner | 2 | No floor push-ups/long planks | mixed | Home, Bodyweight | Conflicting limitation |
| PLAN-PROFILE-016 | Older beginner dumbbells | 67 | female | 158 | 69 | general_fitness | beginner | 2 | Balance occasionally limited | strength | Home, Dumbbells | Older adult |
| PLAN-PROFILE-017 | Young advanced mixed | 18 | male | 190 | 84 | general_fitness | advanced | 6 | None | mixed | All gym modalities | Young/high-frequency advanced |
| PLAN-PROFILE-018 | Advanced muscle gain limited days | 33 | male | 182 | 86 | muscle_gain | advanced | 2 | None | strength | Gym, Dumbbells, Barbell | Hypertrophy/minimum days |
| PLAN-PROFILE-019 | Cardio preference muscle gain | 30 | female | 166 | 57 | muscle_gain | intermediate | 4 | None | cardio | Gym, Machines, Dumbbells | Goal/preference tension |
| PLAN-PROFILE-020 | Strength preference endurance | 35 | male | 179 | 79 | endurance | intermediate | 5 | None | strength | Gym, Barbell, Kettlebells | Reverse tension |
| PLAN-PROFILE-021 | Bodyweight weight loss high frequency | 28 | female | 155 | 78 | weight_loss | beginner | 6 | None | cardio | Home, Bodyweight | Weight loss/max days |
| PLAN-PROFILE-022 | Dumbbell-only strength | 41 | male | 172 | 75 | strength | intermediate | 3 | None | strength | Home, Dumbbells | No-barbell strength |
| PLAN-PROFILE-023 | Kettlebell general fitness | 37 | female | 177 | 71 | general_fitness | advanced | 4 | None | mixed | Home, Kettlebells, Bodyweight | Kettlebell coverage |
| PLAN-PROFILE-024 | Machines-only weight loss | 55 | male | 168 | 94 | weight_loss | beginner | 4 | None | mixed | Gym, Machines | Machine coverage |
| PLAN-PROFILE-025 | Barbell advanced strength maximum | 25 | female | 181 | 77 | strength | advanced | 6 | None | strength | Gym, Barbell | Advanced/max days |
| PLAN-PROFILE-026 | Unicode limitation input | 32 | other | 173 | 70 | general_fitness | intermediate | 3 | Hebrew/em dash/accented text | mixed | Gym, Dumbbells, Bodyweight | Unicode preservation |
| PLAN-PROFILE-027 | Whitespace free-text input | 46 | female | 165 | 73 | endurance | intermediate | 4 | Padded asthma text | cardio | Gym, Machines | Leading/trailing whitespace |
| PLAN-PROFILE-028 | Long valid limitation input | 58 | male | 187 | 108 | weight_loss | beginner | 3 | Detailed knee/impact constraints | mixed | Gym, Machines, Dumbbells | Long free text |
| PLAN-PROFILE-029 | Small adult cardio minimum | 21 | female | 145 | 45 | endurance | advanced | 2 | None | cardio | Home, Bodyweight | Low numeric coverage |
| PLAN-PROFILE-030 | Large adult hypertrophy full gym | 64 | male | 205 | 140 | muscle_gain | intermediate | 5 | Controlled tempo/intensity | strength | Gym, Dumbbells, Machines, Barbell, Kettlebells | High numeric coverage |
