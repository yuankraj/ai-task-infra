"""
AI Task Processing Worker
Polls Redis queue (Bull-compatible) and processes tasks stored in MongoDB.
"""

import os
import json
import time
import signal
import logging
import struct
from datetime import datetime, timezone
from threading import Event
from typing import Optional, Dict, Any

import redis
from pymongo import MongoClient, UpdateOne
from pymongo.errors import ConnectionFailure, OperationFailure
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# ── Load environment ──────────────────────────────────────────────────────────
load_dotenv()

# ── Logging setup ─────────────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("worker")

# ── Configuration ─────────────────────────────────────────────────────────────
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD") or None
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/ai-task-platform")
MONGODB_DB = os.getenv("MONGODB_DB", "ai-task-platform")

# Bull queue key pattern: bull:<queue-name>:wait
BULL_QUEUE_NAME = os.getenv("BULL_QUEUE_NAME", "task-processing")
BULL_WAIT_KEY = f"bull:{BULL_QUEUE_NAME}:wait"
BULL_ACTIVE_KEY = f"bull:{BULL_QUEUE_NAME}:active"
BULL_COMPLETED_KEY = f"bull:{BULL_QUEUE_NAME}:completed"
BULL_FAILED_KEY = f"bull:{BULL_QUEUE_NAME}:failed"
BULL_JOB_PREFIX = f"bull:{BULL_QUEUE_NAME}:"

WORKER_VERSION = os.getenv("WORKER_VERSION", "1.0.0")
POLL_INTERVAL_SECONDS = float(os.getenv("POLL_INTERVAL_SECONDS", "1.0"))
WORKER_CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "1"))

# ── Signal handling ───────────────────────────────────────────────────────────
shutdown_event = Event()

def handle_shutdown(signum, frame):
    logger.info(f"Received signal {signum}. Initiating graceful shutdown...")
    shutdown_event.set()

signal.signal(signal.SIGTERM, handle_shutdown)
signal.signal(signal.SIGINT, handle_shutdown)


# ── Operations ────────────────────────────────────────────────────────────────
def process_uppercase(text: str) -> Dict[str, Any]:
    result = text.upper()
    return {"output": result, "charCount": len(result)}


def process_lowercase(text: str) -> Dict[str, Any]:
    result = text.lower()
    return {"output": result, "charCount": len(result)}


def process_reverse(text: str) -> Dict[str, Any]:
    result = text[::-1]
    return {"output": result, "charCount": len(result)}


def process_word_count(text: str) -> Dict[str, Any]:
    words = text.split()
    unique_words = set(w.lower() for w in words)
    sentences = [s.strip() for s in text.split('.') if s.strip()]
    return {
        "wordCount": len(words),
        "uniqueWordCount": len(unique_words),
        "characterCount": len(text),
        "characterCountNoSpaces": len(text.replace(" ", "")),
        "sentenceCount": len(sentences),
        "paragraphCount": len([p for p in text.split('\n\n') if p.strip()]),
        "averageWordLength": round(
            sum(len(w) for w in words) / len(words), 2
        ) if words else 0
    }


OPERATION_MAP = {
    "uppercase": process_uppercase,
    "lowercase": process_lowercase,
    "reverse": process_reverse,
    "word_count": process_word_count,
}


# ── Redis connection ──────────────────────────────────────────────────────────
@retry(
    stop=stop_after_attempt(10),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(redis.exceptions.ConnectionError),
    reraise=True
)
def create_redis_client() -> redis.Redis:
    client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        db=REDIS_DB,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
        health_check_interval=30
    )
    client.ping()
    logger.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
    return client


# ── MongoDB connection ────────────────────────────────────────────────────────
@retry(
    stop=stop_after_attempt(10),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(ConnectionFailure),
    reraise=True
)
def create_mongo_client() -> MongoClient:
    client = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=5000,
        maxPoolSize=5,
        minPoolSize=1,
        connectTimeoutMS=5000
    )
    # Verify connection
    client.admin.command("ping")
    logger.info("Connected to MongoDB")
    return client


# ── Task processing ───────────────────────────────────────────────────────────
def update_task(db, task_id: str, update: Dict[str, Any]):
    """Update task document in MongoDB."""
    from bson import ObjectId
    try:
        db["tasks"].update_one(
            {"_id": ObjectId(task_id)},
            {"$set": update}
        )
    except Exception as e:
        logger.error(f"Failed to update task {task_id}: {e}")
        raise


def append_log(db, task_id: str, level: str, message: str):
    """Append a log entry to a task."""
    from bson import ObjectId
    try:
        db["tasks"].update_one(
            {"_id": ObjectId(task_id)},
            {
                "$push": {
                    "logs": {
                        "level": level,
                        "message": message,
                        "timestamp": datetime.now(timezone.utc)
                    }
                }
            }
        )
    except Exception as e:
        logger.warning(f"Failed to append log for task {task_id}: {e}")


def process_job(db, job_data: Dict[str, Any]) -> None:
    """Process a single job from the queue."""
    task_id = job_data.get("taskId")
    operation = job_data.get("operation")
    input_text = job_data.get("inputText", "")

    if not task_id or not operation:
        logger.error(f"Invalid job data: {job_data}")
        return

    logger.info(f"Processing task {task_id} | operation={operation}")
    start_time = time.time()

    try:
        # Mark as running
        update_task(db, task_id, {
            "status": "running",
            "startedAt": datetime.now(timezone.utc),
            "workerVersion": WORKER_VERSION
        })
        append_log(db, task_id, "info", f"Worker picked up task. Operation: {operation}")

        # Validate operation
        processor = OPERATION_MAP.get(operation)
        if not processor:
            raise ValueError(f"Unknown operation: {operation}")

        append_log(db, task_id, "info", f"Starting {operation} on {len(input_text)} characters")

        # Execute operation
        result = processor(input_text)

        processing_ms = int((time.time() - start_time) * 1000)

        # Mark as success
        update_task(db, task_id, {
            "status": "success",
            "result": result,
            "completedAt": datetime.now(timezone.utc),
            "processingTimeMs": processing_ms
        })
        append_log(db, task_id, "info", f"Task completed successfully in {processing_ms}ms")
        logger.info(f"Task {task_id} completed in {processing_ms}ms")

    except Exception as e:
        processing_ms = int((time.time() - start_time) * 1000)
        error_msg = str(e)
        logger.error(f"Task {task_id} failed: {error_msg}")

        try:
            update_task(db, task_id, {
                "status": "failed",
                "errorMessage": error_msg,
                "completedAt": datetime.now(timezone.utc),
                "processingTimeMs": processing_ms
            })
            append_log(db, task_id, "error", f"Task failed: {error_msg}")
        except Exception as update_err:
            logger.error(f"Failed to mark task {task_id} as failed: {update_err}")


def dequeue_job(redis_client: redis.Redis) -> Optional[Dict[str, Any]]:
    """
    Attempt to dequeue a job from the Bull-compatible Redis queue.
    Bull stores job IDs in a list at 'bull:<queue>:wait'.
    Job data is stored at 'bull:<queue>:<job-id>'.
    """
    try:
        # BRPOPLPUSH: atomically move job from wait to active
        job_id = redis_client.rpoplpush(BULL_WAIT_KEY, BULL_ACTIVE_KEY)

        if job_id is None:
            return None

        # Fetch job data from hash
        job_key = f"{BULL_JOB_PREFIX}{job_id}"
        job_raw = redis_client.hgetall(job_key)

        if not job_raw:
            logger.warning(f"Empty job data for job_id={job_id}")
            redis_client.lrem(BULL_ACTIVE_KEY, 1, job_id)
            return None

        # Parse data field
        data = json.loads(job_raw.get("data", "{}"))
        return {"_job_id": job_id, **data}

    except redis.exceptions.ConnectionError as e:
        logger.error(f"Redis connection error during dequeue: {e}")
        return None
    except Exception as e:
        logger.error(f"Dequeue error: {e}")
        return None


def ack_job(redis_client: redis.Redis, job_id: str, success: bool):
    """Remove job from active list and move to completed/failed."""
    try:
        redis_client.lrem(BULL_ACTIVE_KEY, 1, job_id)
        target = BULL_COMPLETED_KEY if success else BULL_FAILED_KEY
        redis_client.lpush(target, job_id)
        # Keep only last 100 completed/failed job ids
        redis_client.ltrim(target, 0, 99)
    except Exception as e:
        logger.warning(f"Failed to ack job {job_id}: {e}")


# ── Main worker loop ──────────────────────────────────────────────────────────
def run_worker():
    logger.info(f"Starting worker v{WORKER_VERSION}")

    redis_client = None
    mongo_client = None

    try:
        redis_client = create_redis_client()
        mongo_client = create_mongo_client()
        db = mongo_client[MONGODB_DB]

        logger.info("Worker is ready. Polling for jobs...")

        consecutive_errors = 0

        while not shutdown_event.is_set():
            try:
                job = dequeue_job(redis_client)

                if job is None:
                    consecutive_errors = 0
                    # No job available, wait before polling again
                    shutdown_event.wait(timeout=POLL_INTERVAL_SECONDS)
                    continue

                job_id = job.pop("_job_id", "unknown")
                success = True

                try:
                    process_job(db, job)
                except Exception as e:
                    logger.error(f"Unexpected error processing job {job_id}: {e}")
                    success = False
                finally:
                    ack_job(redis_client, job_id, success)

                consecutive_errors = 0

            except redis.exceptions.ConnectionError as e:
                consecutive_errors += 1
                logger.error(f"Redis connection lost (attempt {consecutive_errors}): {e}")
                if consecutive_errors >= 5:
                    logger.critical("Too many consecutive Redis errors. Attempting reconnect...")
                    try:
                        redis_client = create_redis_client()
                        consecutive_errors = 0
                    except Exception as reconnect_err:
                        logger.critical(f"Reconnect failed: {reconnect_err}")
                        shutdown_event.wait(timeout=5)
                else:
                    shutdown_event.wait(timeout=2)

            except Exception as e:
                consecutive_errors += 1
                logger.error(f"Unexpected worker loop error: {e}")
                shutdown_event.wait(timeout=POLL_INTERVAL_SECONDS)

    except Exception as e:
        logger.critical(f"Fatal error during worker startup: {e}")
        raise
    finally:
        logger.info("Worker shutting down...")
        if mongo_client:
            mongo_client.close()
            logger.info("MongoDB connection closed")
        logger.info("Worker stopped.")


if __name__ == "__main__":
    run_worker()
