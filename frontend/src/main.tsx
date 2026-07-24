
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
import RideHistory from './RideHistory.tsx'
import DriverRegistration from './DriverRegistration.tsx'
import DriverDashboard from './DriverDashboard.tsx'
export { default as LoadingScreen } from './components/LoadingScreen.tsx'
import { AuthContextProvider } from './context/authContext.tsx'
import { ProtectedRoutes } from './components/ProtectedRoutes.tsx'
import RideDetails from './RideDetails.tsx'
import ChooseMode from './ChooseMode.tsx'

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

        <Route element={<ProtectedRoutes allowedroles={["RIDER", "DRIVER"]} />}>
          <Route path="/choose" element={<ChooseMode />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history" element={<RideHistory />} />
          <Route path="/driver-registration" element={<DriverRegistration />} />
          <Route path="/driver-dashboard" element={<DriverDashboard />} />
          <Route path="/ride/:rideId" element={<RideDetails />} />
        </Route>
      </Routes>
    </AuthContextProvider>
  </BrowserRouter>
)
