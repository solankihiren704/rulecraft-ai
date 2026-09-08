import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { AiAssistantProvider } from '@/contexts/AiAssistantContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import MainLayout from '@/layouts/MainLayout'
import LoginPage from '@/features/auth/LoginPage'
import { aiWelcomeMessages } from '@/services/mockData'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const StudentsPage = lazy(() => import('@/features/students/StudentsPage'))
const AcademicStructurePage = lazy(() => import('@/features/academic-structure/AcademicStructurePage'))
const RegulationsPage = lazy(() => import('@/features/regulations/RegulationsPage'))
const RegulationDetailPage = lazy(() => import('@/features/regulations/RegulationDetailPage'))
const RuleEnginePage = lazy(() => import('@/features/rule-engine/RuleEnginePage'))
const SimulatorPage = lazy(() => import('@/features/simulator/SimulatorPage'))
const UsersPage = lazy(() => import('@/features/users/UsersPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))

function RouteLoading() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="animate-spin text-[#475569]" size={26} />
    </div>
  )
}

/**
 * App.tsx
 * Root component: providers, auth-gated routing, and the MainLayout shell
 * shared by every authenticated page. Feature pages are code-split so the
 * initial bundle only pays for login + the app shell.
 */
function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AiAssistantProvider initialMessages={aiWelcomeMessages}>
          <BrowserRouter>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<MainLayout />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/students" element={<StudentsPage />} />
                    <Route path="/academic-structure" element={<AcademicStructurePage />} />
                    <Route path="/regulations" element={<RegulationsPage />} />
                    <Route path="/regulations/:regulationId" element={<RegulationDetailPage />} />
                    <Route path="/rule-engine" element={<RuleEnginePage />} />
                    <Route path="/simulator" element={<SimulatorPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AiAssistantProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
