import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Volume2, Check, X, ArrowLeft, ArrowRight } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Quiz() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [quizSetup, setQuizSetup] = useState(true);
  const [grade, setGrade] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const synthRef = useRef(window.speechSynthesis);
  
  useEffect(() => {
    loadUser();
  }, []);
  
  useEffect(() => {
    if (questions.length > 0 && currentIndex === 0 && !result) {
      speakQuestion();
    }
  }, [questions]);
  
  const loadUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
      if (response.data.grade) {
        setGrade(response.data.grade);
      }
    } catch (error) {
      console.error('Load user error:', error);
    }
  };
  
  const startQuiz = async () => {
    if (!grade) {
      toast.error('Please select a year group');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API}/quiz/start`,
        null,
        {
          params: {
            grade,
            difficulty: difficulty || undefined,
            question_count: 5
          },
          withCredentials: true
        }
      );
      
      setSessionId(response.data.session_id);
      setQuestions(response.data.questions);
      setQuizSetup(false);
      
      toast.success('Quiz started!');
    } catch (error) {
      console.error('Start quiz error:', error);
      toast.error('Failed to start quiz');
    }
  };
  
  const speakQuestion = () => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    
    const question = questions[currentIndex];
    if (!question) return;
    
    const utterance = new SpeechSynthesisUtterance(question.question_text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    
    synthRef.current.speak(utterance);
  };
  
  const speakText = (text) => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    
    synthRef.current.speak(utterance);
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Microphone access denied');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const transcribeAudio = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      
      const response = await axios.post(`${API}/voice/stt`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const transcribedText = response.data.text;
      setUserAnswer(transcribedText);
      
      // Auto-submit answer
      await submitAnswer(transcribedText);
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Failed to understand audio');
    }
  };
  
  const submitAnswer = async (answer = userAnswer) => {
    if (!answer.trim()) {
      toast.error('Please provide an answer');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API}/quiz/answer`,
        null,
        {
          params: {
            session_id: sessionId,
            content_id: questions[currentIndex].content_id,
            user_answer: answer
          },
          withCredentials: true
        }
      );
      
      setResult(response.data);
      
      if (response.data.correct) {
        setScore(score + 1);
        speakText(`Correct! ${response.data.explanation || ''}`);
      } else {
        speakText(`Not quite. The correct answer is ${response.data.correct_answer}. ${response.data.explanation || ''}`);
      }
    } catch (error) {
      console.error('Submit answer error:', error);
      toast.error('Failed to submit answer');
    }
  };
  
  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer('');
      setResult(null);
      
      // Speak next question
      setTimeout(() => {
        speakQuestion();
      }, 500);
    } else {
      completeQuiz();
    }
  };
  
  const completeQuiz = async () => {
    try {
      const response = await axios.post(
        `${API}/quiz/complete`,
        null,
        {
          params: { session_id: sessionId },
          withCredentials: true
        }
      );
      
      setCompleted(true);
      speakText(`Quiz completed! You scored ${response.data.score} out of ${response.data.total}. You earned ${response.data.xp_earned} XP!`);
    } catch (error) {
      console.error('Complete quiz error:', error);
    }
  };
  
  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
        <Card className="max-w-lg w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-gray-900">Quiz Complete!</h2>
          <p className="text-5xl font-bold text-green-600 mb-6">
            {score}/{questions.length}
          </p>
          <p className="text-gray-600 mb-8">
            Great job! Keep up the good work.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => navigate('/student/dashboard')}
              variant="outline"
              data-testid="back-dashboard-btn"
            >
              Back to Dashboard
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="bg-green-600 hover:bg-green-700"
              data-testid="new-quiz-btn"
            >
              Start New Quiz
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  
  if (quizSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/student/dashboard')}
            className="mb-6"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <Card className="p-8">
            <h2 className="text-3xl font-bold mb-6 text-gray-900">Setup Your Quiz</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year Group
                </label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger data-testid="quiz-grade-select">
                    <SelectValue placeholder="Select year..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Year3">Year 3</SelectItem>
                    <SelectItem value="Year4">Year 4</SelectItem>
                    <SelectItem value="Year5">Year 5</SelectItem>
                    <SelectItem value="Year6">Year 6</SelectItem>
                    <SelectItem value="Year7">Year 7</SelectItem>
                    <SelectItem value="Year8">Year 8</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty (Optional)
                </label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger data-testid="quiz-difficulty-select">
                    <SelectValue placeholder="All difficulties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button
              onClick={startQuiz}
              className="w-full mt-8 bg-green-600 hover:bg-green-700 text-lg py-6"
              data-testid="setup-start-quiz-btn"
            >
              <Mic className="w-5 h-5 mr-2" />
              Start Voice Quiz
            </Button>
          </Card>
        </div>
      </div>
    );
  }
  
  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-600">
              Question {currentIndex + 1} of {questions.length}
            </p>
            <p className="text-sm font-medium text-green-600">
              Score: {score}/{questions.length}
            </p>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Question Card */}
        <Card className="p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium mb-4">
                {currentQuestion?.topic}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {currentQuestion?.question_text}
              </h3>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={speakQuestion}
              disabled={isSpeaking}
              data-testid="speak-question-btn"
            >
              <Volume2 className={`w-5 h-5 ${isSpeaking ? 'animate-pulse' : ''}`} />
            </Button>
          </div>
          
          {/* Voice Input */}
          <div className="text-center mb-6">
            <button
              className={`quiz-voice-button w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 transition-all ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 recording'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!!result}
              data-testid="voice-record-btn"
            >
              <Mic className="w-10 h-10 text-white" />
            </button>
            <p className="text-sm text-gray-600">
              {isRecording ? 'Listening... Tap to stop' : 'Tap to speak your answer'}
            </p>
            
            {isRecording && (
              <div className="speaking-indicator justify-center mt-4">
                <div className="speaking-bar"></div>
                <div className="speaking-bar"></div>
                <div className="speaking-bar"></div>
                <div className="speaking-bar"></div>
                <div className="speaking-bar"></div>
              </div>
            )}
          </div>
          
          {/* User Answer */}
          {userAnswer && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">You said:</p>
              <p className="text-lg font-medium text-gray-900">{userAnswer}</p>
            </div>
          )}
          
          {/* Result */}
          {result && (
            <div className={`rounded-lg p-6 ${
              result.correct
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                {result.correct ? (
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                    <X className="w-6 h-6 text-white" />
                  </div>
                )}
                <h4 className={`text-xl font-bold ${
                  result.correct ? 'text-green-700' : 'text-red-700'
                }`}>
                  {result.correct ? 'Correct!' : 'Not Quite'}
                </h4>
              </div>
              
              {!result.correct && (
                <p className="text-gray-700 mb-2">
                  <span className="font-medium">Correct answer:</span> {result.correct_answer}
                </p>
              )}
              
              {result.explanation && (
                <p className="text-gray-600 text-sm">
                  {result.explanation}
                </p>
              )}
            </div>
          )}
        </Card>
        
        {/* Navigation */}
        {result && (
          <div className="flex justify-end">
            <Button
              onClick={nextQuestion}
              className="bg-green-600 hover:bg-green-700"
              data-testid="next-question-btn"
            >
              {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
