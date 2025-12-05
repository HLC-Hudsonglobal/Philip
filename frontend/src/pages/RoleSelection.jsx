import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, BookOpen, Users } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RoleSelection() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [loading, setLoading] = useState(false);
  
  const grades = ['Year3', 'Year4', 'Year5', 'Year6', 'Year7', 'Year8'];
  
  const handleContinue = async () => {
    if (!selectedRole) {
      toast.error('Please select your role');
      return;
    }
    
    if (selectedRole === 'student' && !selectedGrade) {
      toast.error('Please select your year group');
      return;
    }
    
    setLoading(true);
    
    try {
      await axios.post(
        `${API}/auth/update-role`,
        null,
        {
          params: {
            role: selectedRole,
            grade: selectedRole === 'student' ? selectedGrade : undefined
          },
          withCredentials: true
        }
      );
      
      toast.success('Profile updated!');
      
      if (selectedRole === 'student') {
        navigate('/student/dashboard', { replace: true });
      } else if (selectedRole === 'teacher') {
        navigate('/teacher/dashboard', { replace: true });
      }
    } catch (error) {
      console.error('Role update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Welcome to QuizVoice!
          </h1>
          <p className="text-lg text-gray-600">
            Tell us a bit about yourself to get started
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card
            className={`p-6 cursor-pointer transition-all border-2 ${
              selectedRole === 'student'
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 hover:border-green-300'
            }`}
            onClick={() => setSelectedRole('student')}
            data-testid="role-student-card"
          >
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                selectedRole === 'student' ? 'bg-green-600' : 'bg-gray-200'
              }`}>
                <GraduationCap className={`w-8 h-8 ${
                  selectedRole === 'student' ? 'text-white' : 'text-gray-600'
                }`} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Student</h3>
              <p className="text-sm text-gray-600">
                I want to learn and take quizzes
              </p>
            </div>
          </Card>
          
          <Card
            className={`p-6 cursor-pointer transition-all border-2 ${
              selectedRole === 'teacher'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => setSelectedRole('teacher')}
            data-testid="role-teacher-card"
          >
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                selectedRole === 'teacher' ? 'bg-blue-600' : 'bg-gray-200'
              }`}>
                <BookOpen className={`w-8 h-8 ${
                  selectedRole === 'teacher' ? 'text-white' : 'text-gray-600'
                }`} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Teacher</h3>
              <p className="text-sm text-gray-600">
                I want to manage classes and content
              </p>
            </div>
          </Card>
          
          <Card
            className={`p-6 cursor-pointer transition-all border-2 ${
              selectedRole === 'parent'
                ? 'border-purple-600 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
            }`}
            onClick={() => setSelectedRole('parent')}
            data-testid="role-parent-card"
          >
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                selectedRole === 'parent' ? 'bg-purple-600' : 'bg-gray-200'
              }`}>
                <Users className={`w-8 h-8 ${
                  selectedRole === 'parent' ? 'text-white' : 'text-gray-600'
                }`} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Parent</h3>
              <p className="text-sm text-gray-600">
                I want to track my child's progress
              </p>
            </div>
          </Card>
        </div>
        
        {selectedRole === 'student' && (
          <Card className="p-6 mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Your Year Group
            </label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-full" data-testid="grade-select">
                <SelectValue placeholder="Choose your year..." />
              </SelectTrigger>
              <SelectContent>
                {grades.map(grade => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        )}
        
        <div className="text-center">
          <Button
            onClick={handleContinue}
            disabled={!selectedRole || (selectedRole === 'student' && !selectedGrade) || loading}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white px-12"
            data-testid="continue-btn"
          >
            {loading ? 'Setting up...' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
