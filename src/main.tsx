import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import './index.css'
import { AuthProvider } from '@/modules/auth/auth-context'
import { AppRouter, queryClient } from '@/router'

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <ToastContainer position="top-right" autoClose={2500} />
    </QueryClientProvider>
  </AuthProvider>,
)
