import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Users, BookOpen, Plus, LogOut, Mic, BarChart3 } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newClassName, setNewClassName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const [userRes, classesRes] = await Promise.all([
        axios.get(`${API}/auth/me`, { withCredentials: true }),
        axios.get(`${API}/teacher/classes`, { withCredentials: true })
      ]);
      
      setUser(userRes.data);
      setClasses(classesRes.data);
    } catch (error) {
      console.error('Load data error:', error);
      toast.error('Failed to load data');
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
  
  const createClass = async () => {
    if (!newClassName.trim()) {
      toast.error('Please enter a class name');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API}/teacher/class`,
        null,
        {
          params: { class_name: newClassName },
          withCredentials: true
        }
      );
      
      setClasses([...classes, response.data]);
      setNewClassName('');
      setCreateDialogOpen(false);
      toast.success('Class created successfully!');
    } catch (error) {
      console.error('Create class error:', error);
      toast.error('Failed to create class');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">QuizVoice Teacher</h1>
              <p className="text-sm text-gray-500">Welcome, {user?.name}!</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/teacher/content')}
              data-testid="content-manager-btn"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Content Manager
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
        {/* Create Class */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">My Classes</h2>
            <p className="text-gray-600">Manage your classes and track student progress</p>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" data-testid="create-class-btn">
                <Plus className="w-4 h-4 mr-2" />
                Create Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Class Name
                  </label>
                  <Input
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g., Year 6 Mathematics"
                    data-testid="class-name-input"
                  />
                </div>
                <Button
                  onClick={createClass}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="create-class-submit-btn"
                >
                  Create Class
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Classes Grid */}
        {classes.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              No Classes Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first class to start managing students and content.
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="create-first-class-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Class
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <Card key={cls.class_id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/teacher/analytics/${cls.class_id}`)}
                    data-testid={`view-analytics-${cls.class_id}-btn`}
                  >
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Analytics
                  </Button>
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {cls.class_name}
                </h3>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Class Code:</span>
                    <span className="font-mono font-bold text-blue-600">{cls.class_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Students:</span>
                    <span className="font-semibold">{cls.student_ids?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{new Date(cls.created_at).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
