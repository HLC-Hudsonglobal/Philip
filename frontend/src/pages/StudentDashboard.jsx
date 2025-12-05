import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame, Trophy, Zap, BookOpen, Target, LogOut, Mic } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadDashboard();
  }, []);
  
  const loadDashboard = async () => {
    try {
      const [userRes, dashRes] = await Promise.all([
        axios.get(`${API}/auth/me`, { withCredentials: true }),
        axios.get(`${API}/student/dashboard`, { withCredentials: true })
      ]);
      
      setUser(userRes.data);
      setDashboard(dashRes.data);
    } catch (error) {
      console.error('Dashboard load error:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  const startQuiz = () => {
    navigate('/student/quiz');
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }
  
  const streak = dashboard?.streak || { current_streak: 0, longest_streak: 0 };
  const rewards = dashboard?.rewards || { xp: 0, level: 1, badges: [] };
  const progress = dashboard?.progress || { total_items: 0, mastered: 0, due_for_review: 0 };
  
  const xpToNextLevel = rewards.level * 100;
  const xpProgress = (rewards.xp % 100) / 100 * 100;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">QuizVoice</h1>
              <p className="text-sm text-gray-500">Welcome back, {user?.name?.split(' ')[0]}!</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/student/review')}
              data-testid="review-bank-btn"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Review Bank
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Streak */}
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Daily Streak</p>
                <p className="text-4xl font-bold text-gray-900">{streak.current_streak}</p>
              </div>
              <div className="streak-flame">
                <Flame className="w-12 h-12 text-orange-500" />
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Longest: {streak.longest_streak} days 🏆
            </p>
          </Card>
          
          {/* Level */}
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Level</p>
                <p className="text-4xl font-bold text-gray-900">{rewards.level}</p>
              </div>
              <Trophy className="w-12 h-12 text-purple-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">XP</span>
                <span className="font-medium text-gray-900">{rewards.xp % 100} / 100</span>
              </div>
              <Progress value={xpProgress} className="h-2" />
            </div>
          </Card>
          
          {/* Mastery */}
          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Mastered</p>
                <p className="text-4xl font-bold text-gray-900">{progress.mastered}</p>
              </div>
              <Target className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-sm text-gray-600">
              Out of {progress.total_items} topics
            </p>
          </Card>
        </div>
        
        {/* Start Quiz CTA */}
        <Card className="p-8 mb-8 bg-gradient-to-r from-green-600 to-blue-600 text-white border-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-3">Ready for Today's Quiz?</h2>
              <p className="text-lg opacity-90 mb-4">
                {progress.due_for_review > 0
                  ? `You have ${progress.due_for_review} items ready for review!`
                  : "Start a new quiz and keep your streak going!"}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-5 h-5" />
                <span>Voice-powered • 5 minutes • Earn XP</span>
              </div>
            </div>
            <Button
              onClick={startQuiz}
              size="lg"
              className="bg-white text-green-600 hover:bg-gray-100 text-lg px-8 py-6 rounded-full shadow-lg"
              data-testid="start-quiz-btn"
            >
              <Mic className="w-5 h-5 mr-2" />
              Start Quiz
            </Button>
          </div>
        </Card>
        
        {/* Recent Quizzes */}
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900">Recent Quizzes</h3>
          
          {dashboard?.recent_quizzes?.length > 0 ? (
            <div className="space-y-3">
              {dashboard.recent_quizzes.map((quiz, idx) => {
                const percentage = Math.round((quiz.score / quiz.total_questions) * 100);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        Quiz #{idx + 1}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(quiz.started_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{percentage}%</p>
                      <p className="text-sm text-gray-500">
                        {quiz.score}/{quiz.total_questions}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No quizzes yet. Start your first one!</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
