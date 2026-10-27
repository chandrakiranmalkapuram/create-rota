import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LandingPage } from "./pages/LandingPage";
import { FeaturesPage } from "./pages/FeaturesPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { StaffPage } from "./pages/StaffPage";
import { RotasPage } from "./pages/RotasPage";
import { RotaDetailPage } from "./pages/RotaDetailPage";
import { AlertCircle } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const NotFoundPage: React.FC = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center text-center px-4">
    <div className="rounded-full bg-slate-100 p-3 text-slate-600 mb-4">
      <AlertCircle className="h-8 w-8" />
    </div>
    <h1 className="text-2xl font-bold text-slate-900">Page Not Found</h1>
    <p className="mt-2 text-sm text-slate-600 max-w-sm">
      The requested page could not be found. Please check the URL or return to home.
    </p>
    <Link
      to="/"
      className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
    >
      Back to Home
    </Link>
  </div>
);

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
            <Header />
            <main id="main-content" className="flex-grow">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/staff"
                  element={
                    <ProtectedRoute>
                      <StaffPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rotas"
                  element={
                    <ProtectedRoute>
                      <RotasPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rotas/:rotaId"
                  element={
                    <ProtectedRoute>
                      <RotaDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
