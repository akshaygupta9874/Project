
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import LoginPage from './Login.tsx'
import FinalLandingPage from './FinalLandingPage.tsx'
import SignupPage from './Signup.tsx'
import VerifyEmail from './VerifyEmail.tsx'
import Dashboard from './Dashboard.tsx'
import ForgotPasswordPage from './ForgotPassword.tsx'
import ResetPasswordPage from './ResetPassword.tsx'
export { default as LoadingScreen } from './components/LoadingScreen.tsx'
import { AuthContextProvider } from './context/authContext.tsx'
import { ProtectedRoutes } from './components/ProtectedRoutes.tsx'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthContextProvider>
      <Routes>
        <Route path="/" element={<FinalLandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token?" element={<ResetPasswordPage />} />
        <Route path="/token/:token" element={<VerifyEmail />} />
        <Route  element={<ProtectedRoutes allowedroles={["RIDER"]} />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Routes >
    </AuthContextProvider>
  </BrowserRouter>
)
