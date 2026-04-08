const mongoose = require('mongoose');

const SUPPORTED_OPERATIONS = ['uppercase', 'lowercase', 'reverse', 'word_count'];
const TASK_STATUSES = ['pending', 'running', 'success', 'failed'];

const logEntrySchema = new mongoose.Schema(
  {
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    inputText: {
      type: String,
      required: [true, 'Input text is required'],
      maxlength: [10000, 'Input text cannot exceed 10000 characters']
    },
    operation: {
      type: String,
      required: [true, 'Operation is required'],
      enum: {
        values: SUPPORTED_OPERATIONS,
        message: `Operation must be one of: ${SUPPORTED_OPERATIONS.join(', ')}`
      }
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: 'pending'
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    logs: {
      type: [logEntrySchema],
      default: []
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    startedAt: Date,
    completedAt: Date,
    errorMessage: String,
    processingTimeMs: Number,
    workerVersion: String
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Compound indexes for common query patterns
taskSchema.index({ userId: 1, createdAt: -1 });
taskSchema.index({ status: 1, createdAt: -1 });
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ createdAt: -1 });

// Virtual field for duration
taskSchema.virtual('duration').get(function () {
  if (this.startedAt && this.completedAt) {
    return this.completedAt - this.startedAt;
  }
  return null;
});

const Task = mongoose.model('Task', taskSchema);

module.exports = { Task, SUPPORTED_OPERATIONS, TASK_STATUSES };
