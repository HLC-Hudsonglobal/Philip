from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Request, Response, Depends
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import csv
import io
import re
from emergentintegrations.llm.openai import OpenAITextToSpeech, OpenAISpeechToText
import base64
import aiohttp

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize voice services
tts = OpenAITextToSpeech(api_key=os.getenv("EMERGENT_LLM_KEY"))
stt = OpenAISpeechToText(api_key=os.getenv("EMERGENT_LLM_KEY"))

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    role: str  # student, teacher, parent
    picture: Optional[str] = None
    grade: Optional[str] = None  # For students
    parent_email: Optional[str] = None  # For students
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Content(BaseModel):
    model_config = ConfigDict(extra="ignore")
    content_id: str = Field(default_factory=lambda: f"content_{uuid.uuid4().hex[:12]}")
    grade: str
    term: str
    topic: str
    subtopic: Optional[str] = None
    difficulty: str  # High, Medium, Low
    question_text: str
    answer_text: str
    explanation: Optional[str] = None
    source: Optional[str] = None
    tags: List[str] = []
    alternate_answers: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentProgress(BaseModel):
    model_config = ConfigDict(extra="ignore")
    progress_id: str = Field(default_factory=lambda: f"progress_{uuid.uuid4().hex[:12]}")
    user_id: str
    content_id: str
    attempts: int = 0
    correct_count: int = 0
    last_seen: Optional[datetime] = None
    next_review: Optional[datetime] = None
    confidence_score: float = 0.0  # 0-1 scale

class QuizSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: f"quiz_{uuid.uuid4().hex[:12]}")
    user_id: str
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    score: int = 0
    total_questions: int = 0
    content_ids: List[str] = []

class QuizAnswer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    answer_id: str = Field(default_factory=lambda: f"answer_{uuid.uuid4().hex[:12]}")
    session_id: str
    content_id: str
    user_answer: str
    correct: bool
    confidence: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Streak(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    current_streak: int = 0
    longest_streak: int = 0
    last_quiz_date: Optional[datetime] = None

class Rewards(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    xp: int = 0
    level: int = 1
    badges: List[str] = []

class Class(BaseModel):
    model_config = ConfigDict(extra="ignore")
    class_id: str = Field(default_factory=lambda: f"class_{uuid.uuid4().hex[:8]}")
    teacher_id: str
    class_name: str
    class_code: str = Field(default_factory=lambda: f"{uuid.uuid4().hex[:6].upper()}")
    student_ids: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Assignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    assignment_id: str = Field(default_factory=lambda: f"assign_{uuid.uuid4().hex[:12]}")
    class_id: str
    teacher_id: str
    content_ids: List[str] = []
    assigned_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    due_date: Optional[datetime] = None

# ==================== AUTH HELPERS ====================

async def get_current_user(request: Request) -> User:
    # Check cookie first, then Authorization header
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Parse datetime if needed
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

def require_role(required_roles: List[str]):
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in required_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

# ==================== AUTH ROUTES ====================

@api_router.get("/auth/me", response_model=User)
async def get_me(user: User = Depends(get_current_user)):
    return user

@api_router.get("/auth/callback")
async def auth_callback(session_id: str, response: Response):
    """Handle OAuth callback and exchange session_id for session_token"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                os.getenv("SESSION_EXTERNAL_API"),
                headers={"X-Session-ID": session_id}
            ) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=401, detail="Invalid session ID")
                
                data = await resp.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            # Update user info
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "name": data["name"],
                    "picture": data.get("picture")
                }}
            )
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user_doc = {
                "user_id": user_id,
                "email": data["email"],
                "name": data["name"],
                "role": "student",  # Default role
                "picture": data.get("picture"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_doc)
        
        # Create session
        session_token = data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session_doc)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7*24*60*60
        )
        
        # Get full user data
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if isinstance(user_doc.get('created_at'), str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        
        return {"user": user_doc, "session_token": session_token}
        
    except Exception as e:
        logger.error(f"Auth callback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}

@api_router.post("/auth/update-role")
async def update_user_role(role: str, grade: Optional[str] = None, user: User = Depends(get_current_user)):
    """Update user role after first login"""
    update_data = {"role": role}
    if grade and role == "student":
        update_data["grade"] = grade
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": update_data}
    )
    
    # Initialize streak and rewards for students
    if role == "student":
        existing_streak = await db.streaks.find_one({"user_id": user.user_id}, {"_id": 0})
        if not existing_streak:
            streak_doc = {
                "user_id": user.user_id,
                "current_streak": 0,
                "longest_streak": 0,
                "last_quiz_date": None
            }
            await db.streaks.insert_one(streak_doc)
        
        existing_rewards = await db.rewards.find_one({"user_id": user.user_id}, {"_id": 0})
        if not existing_rewards:
            rewards_doc = {
                "user_id": user.user_id,
                "xp": 0,
                "level": 1,
                "badges": []
            }
            await db.rewards.insert_one(rewards_doc)
    
    return {"message": "Role updated"}

# ==================== VOICE ROUTES ====================

@api_router.post("/voice/tts")
async def text_to_speech(text: str, voice: str = "echo"):
    """Convert text to speech (UK English)"""
    try:
        audio_bytes = await tts.generate_speech(
            text=text,
            model="tts-1",
            voice=voice,
            response_format="mp3"
        )
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/voice/stt")
async def speech_to_text(audio: UploadFile = File(...)):
    """Convert speech to text"""
    try:
        audio_bytes = await audio.read()
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "audio.webm"
        
        response = await stt.transcribe(
            file=audio_file,
            model="whisper-1",
            language="en",
            response_format="json"
        )
        
        return {"text": response.text, "confidence": 0.9}
    except Exception as e:
        logger.error(f"STT error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/voice/validate-answer")
async def validate_answer(content_id: str, user_answer: str):
    """Validate answer with synonym matching"""
    content_doc = await db.content.find_one({"content_id": content_id}, {"_id": 0})
    if not content_doc:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Normalize answers
    correct_answer = content_doc["answer_text"].lower().strip()
    user_answer_norm = user_answer.lower().strip()
    
    # Check exact match
    if user_answer_norm == correct_answer:
        return {"correct": True, "confidence": 1.0, "correct_answer": content_doc["answer_text"]}
    
    # Check alternate answers
    for alt in content_doc.get("alternate_answers", []):
        if user_answer_norm == alt.lower().strip():
            return {"correct": True, "confidence": 0.95, "correct_answer": content_doc["answer_text"]}
    
    # Fuzzy matching (simple version)
    if correct_answer in user_answer_norm or user_answer_norm in correct_answer:
        return {"correct": True, "confidence": 0.8, "correct_answer": content_doc["answer_text"]}
    
    return {"correct": False, "confidence": 0.0, "correct_answer": content_doc["answer_text"]}

# ==================== CONTENT ROUTES ====================

@api_router.post("/content/upload")
async def upload_content(file: UploadFile = File(...), user: User = Depends(require_role(["teacher"]))):
    """Upload content via CSV"""
    try:
        content = await file.read()
        csv_text = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_text))
        
        count = 0
        for row in csv_reader:
            content_doc = {
                "content_id": row.get("id", f"content_{uuid.uuid4().hex[:12]}"),
                "grade": row["grade"],
                "term": row["term"],
                "topic": row["topic"],
                "subtopic": row.get("subtopic", ""),
                "difficulty": row["difficulty"],
                "question_text": row["question_text"],
                "answer_text": row["answer_text"],
                "explanation": row.get("explanation", ""),
                "source": row.get("source", ""),
                "tags": row.get("tags", "").split(",") if row.get("tags") else [],
                "alternate_answers": row.get("alternate_answers", "").split("|") if row.get("alternate_answers") else [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Upsert
            await db.content.update_one(
                {"content_id": content_doc["content_id"]},
                {"$set": content_doc},
                upsert=True
            )
            count += 1
        
        return {"message": f"Uploaded {count} content items"}
    except Exception as e:
        logger.error(f"Content upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/content/list")
async def list_content(
    grade: Optional[str] = None,
    term: Optional[str] = None,
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """List content with filters"""
    query = {}
    if grade:
        query["grade"] = grade
    if term:
        query["term"] = term
    if topic:
        query["topic"] = topic
    if difficulty:
        query["difficulty"] = difficulty
    
    content_list = await db.content.find(query, {"_id": 0}).to_list(1000)
    return content_list

@api_router.get("/content/{content_id}")
async def get_content(content_id: str, user: User = Depends(get_current_user)):
    content_doc = await db.content.find_one({"content_id": content_id}, {"_id": 0})
    if not content_doc:
        raise HTTPException(status_code=404, detail="Content not found")
    return content_doc

# ==================== QUIZ ROUTES ====================

@api_router.post("/quiz/start")
async def start_quiz(
    grade: str,
    term: Optional[str] = None,
    difficulty: Optional[str] = None,
    question_count: int = 5,
    user: User = Depends(require_role(["student"]))
):
    """Start a new quiz session with spaced repetition"""
    
    # Get questions due for review
    progress_docs = await db.student_progress.find({
        "user_id": user.user_id,
        "next_review": {"$lte": datetime.now(timezone.utc).isoformat()}
    }, {"_id": 0}).to_list(100)
    
    review_content_ids = [p["content_id"] for p in progress_docs[:question_count]]
    
    # Fill remaining with new content
    if len(review_content_ids) < question_count:
        query = {"grade": grade}
        if term:
            query["term"] = term
        if difficulty:
            query["difficulty"] = difficulty
        
        # Exclude already learned content
        learned_ids = [p["content_id"] for p in await db.student_progress.find(
            {"user_id": user.user_id},
            {"_id": 0, "content_id": 1}
        ).to_list(1000)]
        
        if learned_ids:
            query["content_id"] = {"$nin": learned_ids}
        
        new_content = await db.content.find(query, {"_id": 0}).limit(question_count - len(review_content_ids)).to_list(100)
        new_content_ids = [c["content_id"] for c in new_content]
        content_ids = review_content_ids + new_content_ids
    else:
        content_ids = review_content_ids
    
    # Create quiz session
    session_doc = {
        "session_id": f"quiz_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "score": 0,
        "total_questions": len(content_ids),
        "content_ids": content_ids
    }
    await db.quiz_sessions.insert_one(session_doc)
    
    # Get content details
    content_list = await db.content.find(
        {"content_id": {"$in": content_ids}},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "session_id": session_doc["session_id"],
        "questions": content_list
    }

@api_router.post("/quiz/answer")
async def submit_answer(
    session_id: str,
    content_id: str,
    user_answer: str,
    user: User = Depends(require_role(["student"]))
):
    """Submit quiz answer and update progress"""
    
    # Validate answer
    validation = await validate_answer(content_id, user_answer)
    
    # Record answer
    answer_doc = {
        "answer_id": f"answer_{uuid.uuid4().hex[:12]}",
        "session_id": session_id,
        "content_id": content_id,
        "user_answer": user_answer,
        "correct": validation["correct"],
        "confidence": validation["confidence"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.quiz_answers.insert_one(answer_doc)
    
    # Update progress with spaced repetition (simplified SM-2)
    progress_doc = await db.student_progress.find_one(
        {"user_id": user.user_id, "content_id": content_id},
        {"_id": 0}
    )
    
    now = datetime.now(timezone.utc)
    
    if progress_doc:
        attempts = progress_doc["attempts"] + 1
        correct_count = progress_doc["correct_count"] + (1 if validation["correct"] else 0)
        confidence = correct_count / attempts
        
        # Calculate next review (simplified)
        if validation["correct"]:
            if confidence >= 0.9:
                interval = 7  # 1 week
            elif confidence >= 0.7:
                interval = 3  # 3 days
            else:
                interval = 1  # 1 day
        else:
            interval = 0.5  # 12 hours for wrong answers
        
        next_review = now + timedelta(days=interval)
        
        await db.student_progress.update_one(
            {"user_id": user.user_id, "content_id": content_id},
            {"$set": {
                "attempts": attempts,
                "correct_count": correct_count,
                "last_seen": now.isoformat(),
                "next_review": next_review.isoformat(),
                "confidence_score": confidence
            }}
        )
    else:
        # First attempt
        progress_doc = {
            "progress_id": f"progress_{uuid.uuid4().hex[:12]}",
            "user_id": user.user_id,
            "content_id": content_id,
            "attempts": 1,
            "correct_count": 1 if validation["correct"] else 0,
            "last_seen": now.isoformat(),
            "next_review": (now + timedelta(days=1 if validation["correct"] else 0.5)).isoformat(),
            "confidence_score": 1.0 if validation["correct"] else 0.0
        }
        await db.student_progress.insert_one(progress_doc)
    
    # Update session score
    if validation["correct"]:
        await db.quiz_sessions.update_one(
            {"session_id": session_id},
            {"$inc": {"score": 1}}
        )
    
    # Get content for explanation
    content_doc = await db.content.find_one({"content_id": content_id}, {"_id": 0})
    
    return {
        "correct": validation["correct"],
        "confidence": validation["confidence"],
        "correct_answer": validation["correct_answer"],
        "explanation": content_doc.get("explanation", "")
    }

@api_router.post("/quiz/complete")
async def complete_quiz(session_id: str, user: User = Depends(require_role(["student"]))):
    """Complete quiz and update streaks/rewards"""
    
    session_doc = await db.quiz_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Mark as completed
    await db.quiz_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update streak
    streak_doc = await db.streaks.find_one({"user_id": user.user_id}, {"_id": 0})
    now = datetime.now(timezone.utc)
    today = now.date()
    
    if streak_doc:
        last_date = streak_doc.get("last_quiz_date")
        if isinstance(last_date, str):
            last_date = datetime.fromisoformat(last_date).date()
        elif isinstance(last_date, datetime):
            last_date = last_date.date()
        
        if last_date:
            diff = (today - last_date).days
            if diff == 1:
                # Continue streak
                current_streak = streak_doc["current_streak"] + 1
            elif diff == 0:
                # Already done today
                current_streak = streak_doc["current_streak"]
            else:
                # Streak broken
                current_streak = 1
        else:
            current_streak = 1
        
        longest_streak = max(streak_doc["longest_streak"], current_streak)
        
        await db.streaks.update_one(
            {"user_id": user.user_id},
            {"$set": {
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "last_quiz_date": now.isoformat()
            }}
        )
    
    # Award XP and level up
    score = session_doc["score"]
    total = session_doc["total_questions"]
    xp_earned = score * 10
    
    rewards_doc = await db.rewards.find_one({"user_id": user.user_id}, {"_id": 0})
    if rewards_doc:
        new_xp = rewards_doc["xp"] + xp_earned
        new_level = rewards_doc["level"]
        
        # Simple leveling: 100 XP per level
        while new_xp >= new_level * 100:
            new_level += 1
        
        await db.rewards.update_one(
            {"user_id": user.user_id},
            {"$set": {"xp": new_xp, "level": new_level}}
        )
    
    return {
        "score": score,
        "total": total,
        "xp_earned": xp_earned,
        "message": "Quiz completed!"
    }

# ==================== STUDENT ROUTES ====================

@api_router.get("/student/dashboard")
async def student_dashboard(user: User = Depends(require_role(["student"]))):
    """Get student dashboard data"""
    
    # Get streak
    streak_doc = await db.streaks.find_one({"user_id": user.user_id}, {"_id": 0})
    
    # Get rewards
    rewards_doc = await db.rewards.find_one({"user_id": user.user_id}, {"_id": 0})
    
    # Get progress stats
    total_progress = await db.student_progress.count_documents({"user_id": user.user_id})
    mastered = await db.student_progress.count_documents({
        "user_id": user.user_id,
        "confidence_score": {"$gte": 0.8}
    })
    
    # Get items due for review
    due_items = await db.student_progress.count_documents({
        "user_id": user.user_id,
        "next_review": {"$lte": datetime.now(timezone.utc).isoformat()}
    })
    
    # Get recent quizzes
    recent_quizzes = await db.quiz_sessions.find(
        {"user_id": user.user_id, "completed_at": {"$ne": None}},
        {"_id": 0}
    ).sort("started_at", -1).limit(5).to_list(5)
    
    return {
        "streak": streak_doc or {"current_streak": 0, "longest_streak": 0},
        "rewards": rewards_doc or {"xp": 0, "level": 1, "badges": []},
        "progress": {
            "total_items": total_progress,
            "mastered": mastered,
            "due_for_review": due_items
        },
        "recent_quizzes": recent_quizzes
    }

@api_router.get("/student/review-bank")
async def review_bank(user: User = Depends(require_role(["student"]))):
    """Get items that need review (wrong answers)"""
    
    # Get items with low confidence
    progress_docs = await db.student_progress.find(
        {"user_id": user.user_id, "confidence_score": {"$lt": 0.7}},
        {"_id": 0}
    ).sort("last_seen", -1).to_list(50)
    
    content_ids = [p["content_id"] for p in progress_docs]
    if not content_ids:
        return []
    
    # Get content details
    content_list = await db.content.find(
        {"content_id": {"$in": content_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Merge with progress
    result = []
    for content in content_list:
        progress = next((p for p in progress_docs if p["content_id"] == content["content_id"]), None)
        result.append({
            **content,
            "attempts": progress["attempts"] if progress else 0,
            "confidence_score": progress["confidence_score"] if progress else 0
        })
    
    return result

# ==================== TEACHER ROUTES ====================

@api_router.post("/teacher/class")
async def create_class(class_name: str, user: User = Depends(require_role(["teacher"]))):
    """Create a new class"""
    class_doc = {
        "class_id": f"class_{uuid.uuid4().hex[:8]}",
        "teacher_id": user.user_id,
        "class_name": class_name,
        "class_code": f"{uuid.uuid4().hex[:6].upper()}",
        "student_ids": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.classes.insert_one(class_doc)
    return class_doc

@api_router.get("/teacher/classes")
async def get_classes(user: User = Depends(require_role(["teacher"]))):
    """Get teacher's classes"""
    classes = await db.classes.find({"teacher_id": user.user_id}, {"_id": 0}).to_list(100)
    return classes

@api_router.post("/teacher/class/{class_id}/add-student")
async def add_student_to_class(class_id: str, student_email: str, user: User = Depends(require_role(["teacher"]))):
    """Add student to class by email"""
    student = await db.users.find_one({"email": student_email, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    await db.classes.update_one(
        {"class_id": class_id, "teacher_id": user.user_id},
        {"$addToSet": {"student_ids": student["user_id"]}}
    )
    
    return {"message": "Student added"}

@api_router.get("/teacher/analytics/{class_id}")
async def class_analytics(class_id: str, user: User = Depends(require_role(["teacher"]))):
    """Get class analytics"""
    
    # Get class
    class_doc = await db.classes.find_one({"class_id": class_id, "teacher_id": user.user_id}, {"_id": 0})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    student_ids = class_doc["student_ids"]
    if not student_ids:
        return {"class": class_doc, "students": [], "topic_performance": []}
    
    # Get student progress
    progress_docs = await db.student_progress.find(
        {"user_id": {"$in": student_ids}},
        {"_id": 0}
    ).to_list(1000)
    
    # Get students
    students = await db.users.find(
        {"user_id": {"$in": student_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Calculate stats per student
    student_stats = []
    for student in students:
        student_progress = [p for p in progress_docs if p["user_id"] == student["user_id"]]
        total = len(student_progress)
        mastered = len([p for p in student_progress if p["confidence_score"] >= 0.8])
        avg_confidence = sum(p["confidence_score"] for p in student_progress) / total if total > 0 else 0
        
        student_stats.append({
            "user_id": student["user_id"],
            "name": student["name"],
            "email": student["email"],
            "total_items": total,
            "mastered": mastered,
            "avg_confidence": round(avg_confidence, 2)
        })
    
    # Topic performance (aggregate by topic)
    content_ids = list(set(p["content_id"] for p in progress_docs))
    if content_ids:
        content_list = await db.content.find(
            {"content_id": {"$in": content_ids}},
            {"_id": 0}
        ).to_list(1000)
        
        # Group by topic
        topic_perf = {}
        for content in content_list:
            topic = content["topic"]
            if topic not in topic_perf:
                topic_perf[topic] = {"total": 0, "correct": 0}
            
            content_progress = [p for p in progress_docs if p["content_id"] == content["content_id"]]
            for p in content_progress:
                topic_perf[topic]["total"] += p["attempts"]
                topic_perf[topic]["correct"] += p["correct_count"]
        
        topic_performance = [
            {
                "topic": topic,
                "accuracy": round(stats["correct"] / stats["total"], 2) if stats["total"] > 0 else 0,
                "total_attempts": stats["total"]
            }
            for topic, stats in topic_perf.items()
        ]
    else:
        topic_performance = []
    
    return {
        "class": class_doc,
        "students": student_stats,
        "topic_performance": topic_performance
    }

@api_router.get("/teacher/student/{student_id}/progress")
async def student_progress(student_id: str, user: User = Depends(require_role(["teacher"]))):
    """Get individual student progress"""
    
    student = await db.users.find_one({"user_id": student_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    progress_docs = await db.student_progress.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(1000)
    
    streak_doc = await db.streaks.find_one({"user_id": student_id}, {"_id": 0})
    rewards_doc = await db.rewards.find_one({"user_id": student_id}, {"_id": 0})
    
    return {
        "student": student,
        "progress": progress_docs,
        "streak": streak_doc or {"current_streak": 0},
        "rewards": rewards_doc or {"xp": 0, "level": 1}
    }

# ==================== INCLUDE ROUTER ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
