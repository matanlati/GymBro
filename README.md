# AI Fitness Assistant - POC

A full-stack POC for an AI-powered fitness assistant with video analysis and personalized workout plan generation.

## Features

- **Video Analysis**: Upload workout videos for AI-powered form analysis (stub implementation)
- **Workout Plan Generation**: Fill a questionnaire to generate personalized workout plans using RAG and AI

## Architecture

### Backend

- **Node.js** with Express
- Modular service architecture
- RAG-based AI workout plan generation
- Stub video analysis adapter

### Frontend

- **React** with Vite
- Simple UI with two main flows

## Setup

1. Clone the repository
2. Install dependencies:

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Add your Groq API key: `GROQ_API_KEY=your_groq_api_key_here`
   - If needed, also set `GROQ_MODEL=llama3-8b-8192`
   - Add your video analysis service endpoint: `VIDEO_ANALYSIS_SERVICE_URL=https://your-video-analysis-service.example.com/analyze`
   - If the service uses auth, add `VIDEO_ANALYSIS_API_KEY=your_video_analysis_api_key_here`
   - Create a Groq API key in the Groq console and add it to `.env`

4. Start the backend:

```bash
cd backend
npm run dev
```

5. Start the frontend:

```bash
cd frontend
npm run dev
```

6. Open http://localhost:5173 in your browser

## API Endpoints

- `POST /api/video/analyze` - Analyze uploaded video
- `POST /api/workout-plan/generate` - Generate workout plan from questionnaire

## Project Structure

```
gymbro/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoUpload.jsx
│   │   │   └── Questionnaire.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── videoAnalysis/
│   │   │   └── workoutPlan/
│   │   ├── models/
│   │   ├── routes/
│   │   └── server.js
│   └── package.json
├── knowledge-base/
│   └── training-knowledge.json
└── README.md
```

## Future Enhancements

- Replace video analysis stub with real model integration
- Implement proper embeddings for RAG retrieval
- Add user authentication and data persistence
- Enhance UI/UX
