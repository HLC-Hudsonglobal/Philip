import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, BookOpen, Trophy, Zap, Users } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  
  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`, {
          withCredentials: true
        });
        
        if (response.data) {
          const role = response.data.role;
          if (!role || role === 'undefined') {
            navigate('/role-selection', { replace: true });
          } else if (role === 'student') {
            navigate('/student/dashboard', { replace: true });
          } else if (role === 'teacher') {
            navigate('/teacher/dashboard', { replace: true });
          }
        } else {
          setChecking(false);
        }
      } catch (error) {
        setChecking(false);
      }
    };
    
    checkAuth();
  }, [navigate]);
  
  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + '/role-selection';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="px-6 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Mic className="w-8 h-8 text-green-600" />
            <h1 className="text-2xl font-bold text-green-700">QuizVoice</h1>
          </div>
          <Button onClick={handleGoogleLogin} variant="outline" size="lg" data-testid="header-login-btn">
            Sign In
          </Button>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="px-6 pt-20 pb-32">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6">
            Learn Smarter with
            <span className="block mt-2 bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              Voice-First Revision
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            QuizVoice helps primary and early-secondary students master knowledge through
            interactive voice quizzes, spaced repetition, and fun rewards.
          </p>
          <Button
            onClick={handleGoogleLogin}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
            data-testid="hero-get-started-btn"
          >
            Get Started Free
          </Button>
        </div>
      </section>
      
      {/* Features */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl sm:text-4xl font-bold text-center mb-16 text-gray-900">
            Why Students Love QuizVoice
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-gradient-to-br from-green-100 to-green-50 border border-green-200">
              <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center mb-4">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold mb-3 text-gray-900">Hands-Free Learning</h4>
              <p className="text-gray-600">
                Speak your answers naturally. Our AI understands synonyms and child voices perfectly.
              </p>
            </div>
            
            <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200">
              <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold mb-3 text-gray-900">Smart Revision</h4>
              <p className="text-gray-600">
                Questions adapt to your progress. We remember what you struggle with and help you improve.
              </p>
            </div>
            
            <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-50 border border-purple-200">
              <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold mb-3 text-gray-900">Fun Rewards</h4>
              <p className="text-gray-600">
                Earn XP, level up, maintain streaks, and collect badges as you learn.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Teacher Section */}
      <section className="px-6 py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full mb-4 text-sm font-medium">
                <Users className="w-4 h-4" />
                For Teachers
              </div>
              <h3 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900">
                Track Progress & Assign Content
              </h3>
              <ul className="space-y-4 text-gray-600 text-lg mb-8">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Upload content via CSV in minutes</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Assign quizzes by topic, term, or difficulty</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>View class analytics and individual progress</span>
                </li>
              </ul>
              <Button
                onClick={handleGoogleLogin}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="teacher-signup-btn"
              >
                Sign Up as Teacher
              </Button>
            </div>
            <div className="relative">
              <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Class Dashboard</h4>
                    <p className="text-sm text-gray-500">Year 6 Mathematics</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Space & Distance</span>
                    <span className="text-sm font-bold text-green-600">92% avg</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Fractions</span>
                    <span className="text-sm font-bold text-yellow-600">78% avg</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Measurements</span>
                    <span className="text-sm font-bold text-blue-600">85% avg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="px-6 py-32 bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-4xl sm:text-5xl font-bold mb-6">
            Ready to Transform Learning?
          </h3>
          <p className="text-xl mb-10 opacity-90">
            Join hundreds of students and teachers using QuizVoice to make revision fun and effective.
          </p>
          <Button
            onClick={handleGoogleLogin}
            size="lg"
            className="bg-white text-green-600 hover:bg-gray-100 text-lg px-10 py-6 rounded-full shadow-lg"
            data-testid="cta-start-btn"
          >
            Start Learning Today
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="px-6 py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Mic className="w-6 h-6 text-green-500" />
            <span className="text-lg font-semibold text-white">QuizVoice</span>
          </div>
          <p className="text-sm">
            © 2025 QuizVoice. Making learning accessible through voice.
          </p>
        </div>
      </footer>
    </div>
  );
}
