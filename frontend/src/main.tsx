import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Initialize theme from localStorage before first render — default to light
const storedTheme = localStorage.getItem('pingflow-theme');
document.documentElement.setAttribute('data-theme', storedTheme || 'light');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
