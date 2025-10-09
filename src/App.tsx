import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WorkerProvider } from "./contexts/WorkerContext";
import Login from "./components/Login";
import ResetPassword from "./components/ResetPassword";
import ClockScreen from "./components/ClockScreen";
import Profile from "./components/Profile";
import InstallGuide from "./components/InstallGuide";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./components/Home";
import Timesheets from "./pages/Timesheets";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <div className="max-w-md mx-auto min-h-screen bg-background">
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <WorkerProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route 
              path="/clock" 
              element={
                <ProtectedRoute>
                  <ClockScreen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/help" 
              element={
                <ProtectedRoute>
                  <InstallGuide />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/timesheets" 
              element={
                <ProtectedRoute>
                  <Timesheets />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </WorkerProvider>
      </BrowserRouter>
    </div>
  </QueryClientProvider>
);

export default App;
