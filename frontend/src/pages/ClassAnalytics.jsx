import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ClassAnalytics() {
  const navigate = useNavigate();
  const { classId } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadAnalytics();
  }, [classId]);
  
  const loadAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/teacher/analytics/${classId}`, {
        withCredentials: true
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Load analytics error:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600">Class not found</p>
          <Button onClick={() => navigate('/teacher/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/teacher/dashboard')}
          className="mb-6"
          data-testid="back-dashboard-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {analytics.class.class_name}
          </h1>
          <div className="flex items-center gap-4 text-gray-600">
            <span>Class Code: <span className="font-mono font-bold text-blue-600">{analytics.class.class_code}</span></span>
            <span>•</span>
            <span>{analytics.students.length} Students</span>
          </div>
        </div>
        
        {/* Topic Performance */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Topic Performance</h2>
          
          {analytics.topic_performance.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No data yet. Students need to complete quizzes.</p>
          ) : (
            <div className="space-y-4">
              {analytics.topic_performance
                .sort((a, b) => b.accuracy - a.accuracy)
                .map((topic, idx) => {
                  const accuracyPercent = Math.round(topic.accuracy * 100);
                  let icon, color;
                  
                  if (accuracyPercent >= 80) {
                    icon = <TrendingUp className="w-5 h-5" />;
                    color = 'text-green-600';
                  } else if (accuracyPercent >= 60) {
                    icon = <Minus className="w-5 h-5" />;
                    color = 'text-yellow-600';
                  } else {
                    icon = <TrendingDown className="w-5 h-5" />;
                    color = 'text-red-600';
                  }
                  
                  return (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={color}>{icon}</div>
                          <span className="font-semibold text-gray-900">{topic.topic}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">{accuracyPercent}%</p>
                          <p className="text-xs text-gray-500">{topic.total_attempts} attempts</p>
                        </div>
                      </div>
                      <Progress value={accuracyPercent} className="h-2" />
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
        
        {/* Student Progress */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Student Progress</h2>
          
          {analytics.students.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No students in this class yet.</p>
          ) : (
            <div className="space-y-4">
              {analytics.students
                .sort((a, b) => b.avg_confidence - a.avg_confidence)
                .map((student, idx) => {
                  const confidencePercent = Math.round(student.avg_confidence * 100);
                  const masteryPercent = student.total_items > 0
                    ? Math.round((student.mastered / student.total_items) * 100)
                    : 0;
                  
                  return (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{student.name}</h3>
                          <p className="text-sm text-gray-500">{student.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">{confidencePercent}%</p>
                          <p className="text-xs text-gray-500">avg confidence</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Total Items</p>
                          <p className="font-semibold text-gray-900">{student.total_items}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Mastered</p>
                          <p className="font-semibold text-green-600">{student.mastered}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Mastery</p>
                          <p className="font-semibold text-blue-600">{masteryPercent}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
