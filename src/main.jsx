import './i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import './index.css'
import App from './App.jsx'
import DebugOverlay from './components/DebugOverlay'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <DebugOverlay />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
