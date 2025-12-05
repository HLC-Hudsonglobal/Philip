import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, AlertCircle, Volume2 } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ReviewBank() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadReviewBank();
  }, []);
  
  const loadReviewBank = async () => {
    try {
      const response = await axios.get(`${API}/student/review-bank`, {
        withCredentials: true
      });
      setItems(response.data);
    } catch (error) {
      console.error('Load review bank error:', error);
      toast.error('Failed to load review bank');
    } finally {
      setLoading(false);
    }
  };
  
  const speakText = (text) => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/student/dashboard')}
          className="mb-6"
          data-testid="back-dashboard-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Review Bank</h1>
          <p className="text-lg text-gray-600">
            Items you need to practice more
          </p>
        </div>
        
        {items.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              No Items to Review
            </h3>
            <p className="text-gray-600 mb-6">
              Great job! You've mastered everything so far.
            </p>
            <Button
              onClick={() => navigate('/student/quiz')}
              className="bg-green-600 hover:bg-green-700"
              data-testid="start-new-quiz-btn"
            >
              Start New Quiz
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => {
              const confidencePercent = Math.round(item.confidence_score * 100);
              return (
                <Card key={idx} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {item.topic}
                        </span>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          item.difficulty === 'High'
                            ? 'bg-red-100 text-red-700'
                            : item.difficulty === 'Medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.difficulty}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {item.question_text}
                      </h3>
                      <p className="text-gray-700 mb-3">
                        <span className="font-medium">Answer:</span> {item.answer_text}
                      </p>
                      {item.explanation && (
                        <p className="text-sm text-gray-600">
                          {item.explanation}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => speakText(`${item.question_text}. Answer: ${item.answer_text}. ${item.explanation || ''}`)}
                      data-testid={`speak-item-${idx}-btn`}
                    >
                      <Volume2 className="w-5 h-5" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Confidence</span>
                      <span className="font-medium text-gray-900">{confidencePercent}%</span>
                    </div>
                    <Progress value={confidencePercent} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{item.attempts} attempts</span>
                      <span>{Math.round((item.confidence_score * item.attempts))} correct</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
