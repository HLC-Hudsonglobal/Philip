#!/usr/bin/env python3

import requests
import sys
import json
import time
from datetime import datetime, timezone, timedelta
import uuid
import subprocess
import os

class QuizVoiceAPITester:
    def __init__(self, base_url="https://quizvoice.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.student_token = None
        self.teacher_token = None
        self.student_user_id = None
        self.teacher_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = None
        self.class_id = None
        
        print(f"🔧 Testing QuizVoice API at: {self.api_url}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads
                    test_headers.pop('Content-Type', None)
                    response = requests.post(url, files=files, headers=test_headers)
                else:
                    response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def create_test_users(self):
        """Create test users and sessions in MongoDB"""
        print("\n🔧 Creating test users and sessions...")
        
        try:
            # Generate unique IDs
            timestamp = int(time.time())
            self.student_user_id = f"test-student-{timestamp}"
            self.teacher_user_id = f"test-teacher-{timestamp}"
            self.student_token = f"test_session_student_{timestamp}"
            self.teacher_token = f"test_session_teacher_{timestamp}"
            
            # MongoDB commands to create test data
            mongo_commands = f"""
use('quizvoice_db');

// Create student user
db.users.insertOne({{
  user_id: '{self.student_user_id}',
  email: 'test.student.{timestamp}@example.com',
  name: 'Test Student',
  role: 'student',
  grade: 'Year6',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
}});

// Create teacher user
db.users.insertOne({{
  user_id: '{self.teacher_user_id}',
  email: 'test.teacher.{timestamp}@example.com',
  name: 'Test Teacher',
  role: 'teacher',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
}});

// Create student session
db.user_sessions.insertOne({{
  user_id: '{self.student_user_id}',
  session_token: '{self.student_token}',
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

// Create teacher session
db.user_sessions.insertOne({{
  user_id: '{self.teacher_user_id}',
  session_token: '{self.teacher_token}',
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

print('Test users and sessions created successfully');
"""
            
            # Execute MongoDB commands
            result = subprocess.run(
                ['mongosh', '--eval', mongo_commands],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                print("✅ Test users and sessions created successfully")
                return True
            else:
                print(f"❌ Failed to create test users: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Failed to create test users: {str(e)}")
            return False

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n🧹 Cleaning up test data...")
        
        try:
            mongo_commands = """
use('quizvoice_db');
db.users.deleteMany({email: /test\.(student|teacher)\./});
db.user_sessions.deleteMany({session_token: /test_session/});
db.quiz_sessions.deleteMany({user_id: /test-(student|teacher)-/});
db.quiz_answers.deleteMany({session_id: /quiz_test/});
db.student_progress.deleteMany({user_id: /test-(student|teacher)-/});
db.streaks.deleteMany({user_id: /test-(student|teacher)-/});
db.rewards.deleteMany({user_id: /test-(student|teacher)-/});
db.classes.deleteMany({teacher_id: /test-teacher-/});
print('Test data cleaned up');
"""
            
            result = subprocess.run(
                ['mongosh', '--eval', mongo_commands],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                print("✅ Test data cleaned up successfully")
            else:
                print(f"⚠️  Cleanup warning: {result.stderr}")
                
        except Exception as e:
            print(f"⚠️  Cleanup error: {str(e)}")

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n📋 Testing Authentication Endpoints")
        
        # Test /auth/me with student token
        success, response = self.run_test(
            "Get current user (student)",
            "GET",
            "auth/me",
            200,
            headers={"Authorization": f"Bearer {self.student_token}"}
        )
        
        if success and response.get('role') == 'student':
            print(f"   Student user: {response.get('name')} ({response.get('email')})")
        
        # Test /auth/me with teacher token
        success, response = self.run_test(
            "Get current user (teacher)",
            "GET",
            "auth/me",
            200,
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        
        if success and response.get('role') == 'teacher':
            print(f"   Teacher user: {response.get('name')} ({response.get('email')})")
        
        # Test unauthorized access
        self.run_test(
            "Unauthorized access",
            "GET",
            "auth/me",
            401
        )

    def test_content_endpoints(self):
        """Test content management endpoints"""
        print("\n📚 Testing Content Endpoints")
        
        # Test content list (authenticated)
        self.run_test(
            "List content",
            "GET",
            "content/list",
            200,
            headers={"Authorization": f"Bearer {self.student_token}"}
        )
        
        # Test content list with filters
        self.run_test(
            "List content with grade filter",
            "GET",
            "content/list?grade=Year6",
            200,
            headers={"Authorization": f"Bearer {self.student_token}"}
        )
        
        # Test getting specific content (if any exists)
        success, content_list = self.run_test(
            "List content for content ID test",
            "GET",
            "content/list",
            200,
            headers={"Authorization": f"Bearer {self.student_token}"}
        )
        
        if success and content_list and len(content_list) > 0:
            content_id = content_list[0].get('content_id')
            if content_id:
                self.run_test(
                    f"Get specific content ({content_id})",
                    "GET",
                    f"content/{content_id}",
                    200,
                    headers={"Authorization": f"Bearer {self.student_token}"}
                )

    def test_voice_endpoints(self):
        """Test voice-related endpoints"""
        print("\n🎤 Testing Voice Endpoints")
        
        # Test text-to-speech
        success, response = self.run_test(
            "Text to Speech",
            "POST",
            "voice/tts?text=Hello world&voice=echo",
            200,
            headers={"Authorization": f"Bearer {self.student_token}"}
        )
        
        # Test answer validation
        # First get a content item to validate against
        success, content_list = self.run_test(
            "Get content for validation test",
            "GET",
            "content/list",
            200,
            headers={"Authorization": f"Bearer {self.student_token}"}
        )
        
        if success and content_list and len(content_list) > 0:
            content_id = content_list[0].get('content_id')
            correct_answer = content_list[0].get('answer_text', 'test')
            
            if content_id:
                # Test correct answer validation
                self.run_test(
                    "Validate correct answer",
                    "POST",
                    f"voice/validate-answer?content_id={content_id}&user_answer={correct_answer}",
                    200,
                    headers={"Authorization": f"Bearer {self.student_token}"}
                )
                
                # Test incorrect answer validation
                self.run_test(
                    "Validate incorrect answer",
                    "POST",
                    f"voice/validate-answer?content_id={content_id}&user_answer=wrong answer",
                    200,
                    headers={"Authorization": f"Bearer {self.student_token}"}
                )

    def test_quiz_flow(self):
        """Test complete quiz flow"""
        print("\n🎯 Testing Quiz Flow")
        
        # Start a quiz
        success, response = self.run_test(
            "Start quiz",
            "POST",
            "quiz/start?grade=Year6&difficulty=Medium&question_count=3",
            200,
            headers={"Authorization": f"Bearer {self.student_token}"}
        )
        
        if success and response.get('session_id'):
            self.session_id = response['session_id']
            questions = response.get('questions', [])
            print(f"   Quiz started with {len(questions)} questions")
            
            # Answer first question if available
            if questions and len(questions) > 0:
                question = questions[0]
                content_id = question.get('content_id')
                answer = question.get('answer_text', 'test answer')
                
                success, answer_response = self.run_test(
                    "Submit quiz answer",
                    "POST",
                    f"quiz/answer?session_id={self.session_id}&content_id={content_id}&user_answer={answer}",
                    200,
                    headers={"Authorization": f"Bearer {self.student_token}"}
                )
                
                if success:
                    print(f"   Answer result: {'Correct' if answer_response.get('correct') else 'Incorrect'}")
            
            # Complete the quiz
            self.run_test(
                "Complete quiz",
                "POST",
                f"quiz/complete?session_id={self.session_id}",
                200,
                headers={"Authorization": f"Bearer {self.student_token}"}
            )

    def test_student_endpoints(self):
        """Test student-specific endpoints"""
        print("\n🎓 Testing Student Endpoints")
        
        # Test student dashboard
        success, dashboard = self.run_test(
            "Student dashboard",
            "GET",
            "student/dashboard",
            200,
            headers={"Authorization": f"Bearer {self.student_token}"}
        )
        
        if success:
            streak = dashboard.get('streak', {})
            rewards = dashboard.get('rewards', {})
            progress = dashboard.get('progress', {})
            print(f"   Streak: {streak.get('current_streak', 0)} days")
            print(f"   Level: {rewards.get('level', 1)}, XP: {rewards.get('xp', 0)}")
            print(f"   Progress: {progress.get('mastered', 0)}/{progress.get('total_items', 0)} mastered")
        
        # Test review bank
        self.run_test(
            "Student review bank",
            "GET",
            "student/review-bank",
            200,
            headers={"Authorization": f"Bearer {self.student_token}"}
        )

    def test_teacher_endpoints(self):
        """Test teacher-specific endpoints"""
        print("\n👩‍🏫 Testing Teacher Endpoints")
        
        # Create a class
        success, class_response = self.run_test(
            "Create class",
            "POST",
            "teacher/class?class_name=Test Class Year 6",
            200,
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        
        if success and class_response.get('class_id'):
            self.class_id = class_response['class_id']
            class_code = class_response.get('class_code')
            print(f"   Created class: {self.class_id} (Code: {class_code})")
        
        # Get teacher's classes
        success, classes = self.run_test(
            "Get teacher classes",
            "GET",
            "teacher/classes",
            200,
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        
        if success:
            print(f"   Teacher has {len(classes)} classes")
        
        # Test class analytics (if class was created)
        if self.class_id:
            self.run_test(
                "Class analytics",
                "GET",
                f"teacher/analytics/{self.class_id}",
                200,
                headers={"Authorization": f"Bearer {self.teacher_token}"}
            )
            
            # Test adding student to class
            student_email = f"test.student.{int(time.time())}@example.com"
            self.run_test(
                "Add student to class",
                "POST",
                f"teacher/class/{self.class_id}/add-student?student_email={student_email}",
                404,  # Expected 404 since student doesn't exist
                headers={"Authorization": f"Bearer {self.teacher_token}"}
            )

    def test_role_permissions(self):
        """Test role-based access control"""
        print("\n🔒 Testing Role Permissions")
        
        # Student trying to access teacher endpoints
        self.run_test(
            "Student accessing teacher endpoint (should fail)",
            "POST",
            "teacher/class?class_name=Unauthorized Class",
            403,
            headers={"Authorization": f"Bearer {self.student_token}"}
        )
        
        # Teacher trying to access student-specific endpoints
        self.run_test(
            "Teacher accessing student dashboard",
            "GET",
            "student/dashboard",
            403,
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting QuizVoice API Tests")
        print("=" * 50)
        
        # Setup
        if not self.create_test_users():
            print("❌ Failed to create test users. Aborting tests.")
            return False
        
        try:
            # Run test suites
            self.test_auth_endpoints()
            self.test_content_endpoints()
            self.test_voice_endpoints()
            self.test_quiz_flow()
            self.test_student_endpoints()
            self.test_teacher_endpoints()
            self.test_role_permissions()
            
        finally:
            # Cleanup
            self.cleanup_test_data()
        
        # Results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            failed = self.tests_run - self.tests_passed
            print(f"❌ {failed} tests failed")
            return False

def main():
    tester = QuizVoiceAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())