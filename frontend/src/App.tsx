import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import WorkoutsPage from './pages/WorkoutsPage'
import NewPlanPage from './pages/NewPlanPage'
import ActiveSessionPage from './pages/ActiveSessionPage'
import AiCoachPage from './pages/AiCoachPage'
import ProgressPage from './pages/ProgressPage'
import ProfilePage from './pages/ProfilePage'
import Layout from './components/Layout'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/workouts" element={<ProtectedRoute><Layout><WorkoutsPage /></Layout></ProtectedRoute>} />
          <Route path="/plans/new" element={<ProtectedRoute><Layout><NewPlanPage /></Layout></ProtectedRoute>} />
          <Route path="/session/:id" element={<ProtectedRoute><Layout><ActiveSessionPage /></Layout></ProtectedRoute>} />
          <Route path="/ai-coach" element={<ProtectedRoute><Layout><AiCoachPage /></Layout></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><Layout><ProgressPage /></Layout></ProtectedRoute>} />
          <Route path="/profile"  element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
