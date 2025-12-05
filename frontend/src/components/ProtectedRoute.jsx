import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProtectedRoute({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(location.state?.user ? true : null);
  const isMounted = useRef(true);
  
  useEffect(() => {
    isMounted.current = true;
    
    const checkAuth = async () => {
      // If user data was passed from AuthCallback, skip check
      if (location.state?.user) {
        setIsAuthenticated(true);
        return;
      }
      
      // Add small delay for cookie availability (skip if just authenticated)
      const justAuth = sessionStorage.getItem('just_authenticated');
      if (!justAuth) {
        await new Promise(r => setTimeout(r, 150));
      } else {
        sessionStorage.removeItem('just_authenticated');
      }
      
      try {
        const response = await axios.get(`${API}/auth/me`, {
          withCredentials: true
        });
        
        if (isMounted.current) {
          if (response.data) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
            navigate('/', { replace: true });
          }
        }
      } catch (error) {
        if (isMounted.current) {
          setIsAuthenticated(false);
          navigate('/', { replace: true });
        }
      }
    };
    
    checkAuth();
    
    return () => {
      isMounted.current = false;
    };
  }, [navigate, location.state]);
  
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }
  
  return isAuthenticated ? children : null;
}
