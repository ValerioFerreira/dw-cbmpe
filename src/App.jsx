import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { ThemeProvider } from 'next-themes';
import { CbmpeProvider } from '@/lib/cbmpe-context';
import AppShell from '@/components/layout/AppShell';
import Organograma from '@/pages/Organograma';
import Diretoria from '@/pages/Diretoria';
import DashboardDetalhe from '@/pages/DashboardDetalhe';
import Indicador from '@/pages/Indicador';
import EfetivoDetalhe from '@/pages/EfetivoDetalhe';
import EfetivoDashboard from '@/pages/efetivo/EfetivoDashboard';
import ViaturaDetalhe from '@/pages/ViaturaDetalhe';
import ViaturaFicha from '@/pages/ViaturaFicha';
import ViaturasDashboard from '@/pages/viaturas/ViaturasDashboard';
import AtividadesDashboard from '@/pages/atividades/AtividadesDashboard';
import FinancasDashboard from '@/pages/financas/FinancasDashboard';
import FinancasDetalhe from '@/pages/FinancasDetalhe';
import Administracao from "./pages/Administracao";
import MilitarFicha from '@/pages/MilitarFicha';
import Submodulo from '@/pages/Submodulo';
import Detalhamento from '@/pages/Detalhamento';
import EmConstrucao from '@/pages/EmConstrucao';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, navigateToLogin } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigateToLogin();
    return null;
  }

  // Render the main app
  return (
    <CbmpeProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/organograma" replace />} />
          <Route path="/organograma" element={<Organograma />} />
          <Route path="/diretoria/:id" element={<Diretoria />} />
          <Route path="/dashboard/:id" element={<DashboardDetalhe />} />
          <Route path="/indicador/:id" element={<Indicador />} />
          <Route path="/efetivo/:id" element={<EfetivoDetalhe />} />
          <Route path="/efetivo/:id/dashboard/:modulo" element={<EfetivoDashboard />} />
          <Route path="/viaturas/:id" element={<ViaturaDetalhe />} />
          <Route path="/viaturas/:id/dashboard/:modulo" element={<ViaturasDashboard />} />
          <Route path="/atividades/:id/dashboard/:modulo" element={<AtividadesDashboard />} />
          <Route path="/financas/:id" element={<FinancasDetalhe />} />
          <Route path="/financas/:id/dashboard/:modulo" element={<FinancasDashboard />} />
          <Route path="/viatura/:placa" element={<ViaturaFicha />} />
          <Route path="/militar/:matricula" element={<MilitarFicha />} />
          <Route path="/submodulo/:id/:modulo" element={<Submodulo />} />
          <Route path="/detalhamento/:id/:modulo" element={<Detalhamento />} />
          <Route path="/em-construcao/:nome" element={<EmConstrucao />} />
          <Route path="/adm" element={<Administracao />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </CbmpeProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App