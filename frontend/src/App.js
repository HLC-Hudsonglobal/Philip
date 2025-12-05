import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Landing from "@/pages/Landing";
import AuthCallback from "@/pages/AuthCallback";
import RoleSelection from "@/pages/RoleSelection";
import StudentDashboard from "@/pages/StudentDashboard";
import Quiz from "@/pages/Quiz";
import ReviewBank from "@/pages/ReviewBank";
import TeacherDashboard from "@/pages/TeacherDashboard";
import ContentManager from "@/pages/ContentManager";
import ClassAnalytics from "@/pages/ClassAnalytics";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import "@/App.css";

function AppRouter() {
  const location = useLocation();
  
  // Handle session_id synchronously during render
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/role-selection" element={<ProtectedRoute><RoleSelection /></ProtectedRoute>} />
        
        {/* Student Routes */}
        <Route path="/student/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
        <Route path="/student/review" element={<ProtectedRoute><ReviewBank /></ProtectedRoute>} />
        
        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={<ProtectedRoute><TeacherDashboard /></ProtectedRoute>} />
        <Route path="/teacher/content" element={<ProtectedRoute><ContentManager /></ProtectedRoute>} />
        <Route path="/teacher/analytics/:classId" element={<ProtectedRoute><ClassAnalytics /></ProtectedRoute>} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </div>
  );
}

export default App;
