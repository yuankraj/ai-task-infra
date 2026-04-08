const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Bull = require('bull');
const { Task, SUPPORTED_OPERATIONS } = require('../models/Task');
const authMiddleware = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// All task routes require authentication
router.use(authMiddleware);

// Initialize Bull queue
const taskQueue = new Bull('task-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200
  }
});

taskQueue.on('error', (err) => {
  logger.error('Bull queue error:', err.message);
});

// POST /api/tasks - Create a new task
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title required').isLength({ max: 200 }),
    body('inputText').trim().notEmpty().withMessage('Input text required').isLength({ max: 10000 }),
    body('operation')
      .isIn(SUPPORTED_OPERATIONS)
      .withMessage(`Operation must be one of: ${SUPPORTED_OPERATIONS.join(', ')}`)
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { title, inputText, operation } = req.body;

      const task = await Task.create({
        title,
        inputText,
        operation,
        userId: req.user._id,
        status: 'pending',
        logs: [{ level: 'info', message: 'Task created and queued for processing' }]
      });

      // Enqueue the job with task details
      const job = await taskQueue.add(
        {
          taskId: task._id.toString(),
          operation,
          inputText,
          userId: req.user._id.toString()
        },
        { jobId: task._id.toString() }
      );

      logger.info(`Task ${task._id} created and queued (job: ${job.id})`);

      res.status(201).json({
        message: 'Task created and queued',
        task: {
          id: task._id,
          title: task.title,
          operation: task.operation,
          status: task.status,
          createdAt: task.createdAt
        }
      });
    } catch (err) {
      logger.error('Task creation error:', err);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }
);

// GET /api/tasks - List tasks for current user (paginated)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['pending', 'running', 'success', 'failed', 'all'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      const skip = (page - 1) * limit;

      const filter = { userId: req.user._id };
      if (req.query.status && req.query.status !== 'all') {
        filter.status = req.query.status;
      }

      const [tasks, total] = await Promise.all([
        Task.find(filter)
          .select('-logs -inputText')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Task.countDocuments(filter)
      ]);

      res.json({
        tasks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total
        }
      });
    } catch (err) {
      logger.error('Task list error:', err);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }
);

// GET /api/tasks/stats - Get task statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Task.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgProcessingTime: { $avg: '$processingTimeMs' }
        }
      }
    ]);

    const result = {
      total: 0,
      pending: 0,
      running: 0,
      success: 0,
      failed: 0
    };

    stats.forEach((s) => {
      result[s._id] = s.count;
      result.total += s.count;
    });

    res.json({ stats: result });
  } catch (err) {
    logger.error('Task stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/tasks/:id - Get a single task with logs
router.get('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).lean();

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task });
  } catch (err) {
    logger.error('Task fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// DELETE /api/tasks/:id - Delete a task
router.delete('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
      status: { $in: ['success', 'failed'] }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found or cannot be deleted (must be completed/failed)' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    logger.error('Task delete error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
