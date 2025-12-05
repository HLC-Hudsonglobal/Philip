import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const processed = useRef(false);
  
  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    
    const processAuth = async () => {
      try {
        // Extract session_id from hash
        const hash = location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const sessionId = params.get('session_id');
        
        if (!sessionId) {
          toast.error('Invalid authentication response');
          navigate('/', { replace: true });
          return;
        }
        
        // Exchange session_id for session_token
        const response = await axios.get(`${API}/auth/callback`, {
          params: { session_id: sessionId },
          withCredentials: true
        });
        
        const user = response.data.user;
        
        // Set flag to skip delay in ProtectedRoute
        sessionStorage.setItem('just_authenticated', 'true');
        
        // Redirect based on role
        if (!user.role || user.role === 'undefined') {
          navigate('/role-selection', { replace: true, state: { user } });
        } else if (user.role === 'student') {
          navigate('/student/dashboard', { replace: true, state: { user } });
        } else if (user.role === 'teacher') {
          navigate('/teacher/dashboard', { replace: true, state: { user } });
        } else {
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error('Authentication failed. Please try again.');
        navigate('/', { replace: true });
      }
    };
    
    processAuth();
  }, [navigate, location]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Signing you in...</p>
      </div>
    </div>
  );
}
