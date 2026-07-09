
import { createRoot } from 'react-dom/client'
import './index.css'
import {BrowserRouter , Routes ,Route } from  "react-router-dom"
import LoginPage from './Login.tsx'
import FinalLandingPage from './FinalLandingPage.tsx'
import SignupPage from './Signup.tsx'
import VerifyEmail from './VerifyEmail.tsx'
import Dashboard from './Dashboard.tsx'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>

    <Routes>
        <Route path="/" element={<FinalLandingPage/>} />
        <Route path="/login" element={<LoginPage/>} />
        <Route path="/signup" element={<SignupPage/>} />
        <Route path="/token/:token" element={<VerifyEmail/>} />
        <Route path="/dashboard" element={<Dashboard/>} />

    </Routes >
  
  
  </BrowserRouter>
    

)
