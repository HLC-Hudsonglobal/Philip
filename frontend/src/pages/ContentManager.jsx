import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Upload, FileText, CheckCircle2 } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ContentManager() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/content/upload`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadResult(response.data);
      toast.success(response.data.message);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload content');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const downloadTemplate = () => {
    const csvContent = `id,grade,term,topic,subtopic,difficulty,question_text,answer_text,explanation,tags,alternate_answers
GK-ENG-6-001,Year6,Term2,Space,Sun-Earth Distance,High,"How far is the Sun from Earth, approximately?","150 million kilometres","The Sun is approximately 150 million km away; light takes about 8 minutes 20 seconds to reach Earth.","astronomy,measurement","150 million km|93 million miles"
GK-MATH-5-001,Year5,Term1,Fractions,Addition,Medium,"What is one half plus one quarter?","Three quarters","When adding fractions, you need a common denominator. 1/2 = 2/4, so 2/4 + 1/4 = 3/4.","fractions,addition","3/4|0.75"`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quizvoice_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
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
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Content Manager</h1>
          <p className="text-lg text-gray-600">
            Upload quiz content via CSV file
          </p>
        </div>
        
        {/* Upload Card */}
        <Card className="p-8 mb-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
              Upload Content CSV
            </h3>
            <p className="text-gray-600 mb-6">
              Upload a CSV file containing quiz questions and answers
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="file-input"
            />
            
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="upload-csv-btn"
              >
                {uploading ? 'Uploading...' : 'Choose CSV File'}
              </Button>
              <Button
                variant="outline"
                onClick={downloadTemplate}
                data-testid="download-template-btn"
              >
                <FileText className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
          </div>
        </Card>
        
        {/* Upload Result */}
        {uploadResult && (
          <Card className="p-6 bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <h4 className="text-lg font-semibold text-green-900 mb-1">
                  Upload Successful!
                </h4>
                <p className="text-green-700">{uploadResult.message}</p>
              </div>
            </div>
          </Card>
        )}
        
        {/* Instructions */}
        <Card className="p-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            CSV Format Instructions
          </h3>
          
          <div className="space-y-4 text-gray-600">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Required Columns:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">id</code> - Unique identifier</li>
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">grade</code> - Year3, Year4, Year5, Year6, Year7, Year8</li>
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">term</code> - Term1, Term2, Term3</li>
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">topic</code> - Subject area</li>
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">difficulty</code> - Low, Medium, High</li>
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">question_text</code> - The question</li>
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">answer_text</code> - Correct answer</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Optional Columns:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">subtopic</code> - More specific categorisation</li>
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">explanation</code> - Why the answer is correct</li>
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">tags</code> - Comma-separated keywords</li>
                <li><code className="text-sm bg-gray-100 px-2 py-1 rounded">alternate_answers</code> - Pipe-separated (|) acceptable alternatives</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Pro Tip
              </h4>
              <p className="text-blue-800 text-sm">
                Download the template to see examples and ensure your CSV is formatted correctly.
                The alternate_answers field helps the voice recognition accept synonyms and different phrasings.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
