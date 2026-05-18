const mongoose = require('mongoose');

// Project settings sub-schema
const projectSettingsSchema = new mongoose.Schema({
  autoSave: {
    type: Boolean,
    default: true
  },
  saveInterval: {
    type: Number,
    min: 30,
    max: 3600,
    default: 300 // 5 minutes
  },
  enableNotifications: {
    type: Boolean,
    default: true
  },
  emailNotifications: {
    onComplete: {
      type: Boolean,
      default: true
    },
    onError: {
      type: Boolean,
      default: true
    },
    onShare: {
      type: Boolean,
      default: false
    },
    dailySummary: {
      type: Boolean,
      default: false
    }
  },
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'light'
  },
  language: {
    type: String,
    default: 'en'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  accessibility: {
    highContrast: {
      type: Boolean,
      default: false
    },
    largeText: {
      type: Boolean,
      default: false
    },
    keyboardNavigation: {
      type: Boolean,
      default: true
    }
  },
  collaboration: {
    allowEditing: {
      type: Boolean,
      default: false
    },
    allowComments: {
      type: Boolean,
      default: true
    },
    showCursors: {
      type: Boolean,
      default: true
    },
    realTimeSync: {
      type: Boolean,
      default: true
    }
  }
}, { _id: false });

// Form data sub-schema for storing field values
const formDataSchema = new mongoose.Schema({
  fieldId: {
    type: String,
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  modifiedBy: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    default: 1
  },
  validation: {
    isValid: {
      type: Boolean,
      default: true
    },
    errors: [{
      type: String
    }],
    lastValidated: {
      type: Date,
      default: Date.now
    }
  },
  metadata: {
    source: {
      type: String,
      enum: ['manual', 'imported', 'calculated', 'signature', 'api'],
      default: 'manual'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    },
    locked: {
      type: Boolean,
      default: false
    }
  }
}, { _id: false });

// Project activity log sub-schema
const activityLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'created', 'updated', 'deleted', 'shared', 'exported', 'imported',
      'field_added', 'field_updated', 'field_deleted', 'field_filled',
      'signature_added', 'comment_added', 'status_changed', 'permission_changed',
      'backup_created', 'restored', 'validated', 'submitted'
    ]
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  fieldId: {
    type: String,
    default: null
  },
  previousValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  }
}, { _id: false });

// Project collaborator sub-schema
const collaboratorSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 255
  },
  role: {
    type: String,
    enum: ['owner', 'editor', 'viewer', 'commenter'],
    required: true
  },
  permissions: {
    canEdit: {
      type: Boolean,
      default: false
    },
    canComment: {
      type: Boolean,
      default: true
    },
    canShare: {
      type: Boolean,
      default: false
    },
    canExport: {
      type: Boolean,
      default: false
    },
    canDelete: {
      type: Boolean,
      default: false
    }
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  invitedBy: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    default: null
  },
  lastActive: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'removed'],
    default: 'pending'
  }
}, { _id: false });

// Comment sub-schema
const commentSchema = new mongoose.Schema({
  commentId: {
    type: String,
    required: true,
    unique: true
  },
  fieldId: {
    type: String,
    default: null // null for general project comments
  },
  userId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 2000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  replies: [{
    replyId: String,
    userId: String,
    userName: String,
    text: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedBy: {
    type: String,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  }
}, { _id: false });

// Export configuration sub-schema
const exportConfigSchema = new mongoose.Schema({
  format: {
    type: String,
    enum: ['pdf', 'json', 'xml', 'csv'],
    default: 'pdf'
  },
  includeEmptyFields: {
    type: Boolean,
    default: false
  },
  includeMetadata: {
    type: Boolean,
    default: true
  },
  flattenData: {
    type: Boolean,
    default: false
  },
  customFields: [{
    type: String // field IDs to include
  }],
  watermark: {
    enabled: {
      type: Boolean,
      default: false
    },
    text: {
      type: String,
      maxlength: 100
    },
    opacity: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.3
    }
  }
}, { _id: false });

// Main Project Schema
const projectSchema = new mongoose.Schema({
  // Basic project information
  name: {
    type: String,
    required: true,
    maxlength: 255,
    trim: true,
    index: true
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  
  description: {
    type: String,
    maxlength: 2000,
    trim: true,
    default: ''
  },
  
  // Template association
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    required: true,
    index: true
  },
  
  templateVersion: {
    type: String,
    default: '1.0.0'
  },
  
  // Project status and lifecycle
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'review', 'completed', 'archived', 'cancelled', 'orphaned'],
    default: 'draft',
    index: true
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  
  // Project dates
  dueDate: {
    type: Date,
    default: null,
    index: true
  },
  
  startedAt: {
    type: Date,
    default: null
  },
  
  completedAt: {
    type: Date,
    default: null
  },
  
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Form data
  formData: [formDataSchema],
  
  // Project progress tracking
  progress: {
    totalFields: {
      type: Number,
      default: 0,
      min: 0
    },
    completedFields: {
      type: Number,
      default: 0,
      min: 0
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    lastCalculated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Project settings
  settings: {
    type: projectSettingsSchema,
    default: () => ({})
  },
  
  // Collaboration
  collaborators: [collaboratorSchema],
  
  comments: [commentSchema],
  
  // Project owner and permissions
  createdBy: {
    type: String,
    required: true,
    index: true
  },
  
  modifiedBy: {
    type: String,
    default: null
  },
  
  organization: {
    type: String,
    index: true
  },
  
  // Project access control
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  },
  
  shareToken: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  shareSettings: {
    allowPublicView: {
      type: Boolean,
      default: false
    },
    allowPublicEdit: {
      type: Boolean,
      default: false
    },
    requireAuth: {
      type: Boolean,
      default: true
    },
    expiresAt: {
      type: Date,
      default: null
    },
    passwordProtected: {
      type: Boolean,
      default: false
    },
    password: {
      type: String,
      default: null
    }
  },
  
  // Activity and audit
  activityLog: [activityLogSchema],
  
  // File attachments
  attachments: [{
    fileId: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    uploadedBy: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    description: {
      type: String,
      maxlength: 500
    }
  }],
  
  // Export and backup
  exports: [{
    exportId: {
      type: String,
      required: true
    },
    format: {
      type: String,
      enum: ['pdf', 'json', 'xml', 'csv'],
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    config: exportConfigSchema,
    createdBy: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  }],
  
  backup: {
    lastBackupAt: {
      type: Date,
      default: null
    },
    backupLocation: {
      type: String,
      default: null
    },
    backupSize: {
      type: Number,
      default: null
    },
    autoBackup: {
      type: Boolean,
      default: true
    },
    backupFrequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly', 'monthly'],
      default: 'daily'
    }
  },
  
  // Project metadata
  metadata: {
    client: {
      type: String,
      maxlength: 255
    },
    reference: {
      type: String,
      maxlength: 255
    },
    category: {
      type: String,
      maxlength: 100
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: 50
    }],
    customFields: [{
      key: {
        type: String,
        required: true
      },
      value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
      },
      type: {
        type: String,
        enum: ['text', 'number', 'date', 'boolean'],
        default: 'text'
      }
    }]
  }
}, {
  timestamps: true,
  versionKey: '__v'
});

// Indexes for better query performance
projectSchema.index({ name: 'text', description: 'text' });
projectSchema.index({ createdBy: 1, status: 1, lastActivityAt: -1 });
projectSchema.index({ templateId: 1, status: 1 });
projectSchema.index({ organization: 1, status: 1 });
projectSchema.index({ dueDate: 1, status: 1 });
projectSchema.index({ 'collaborators.userId': 1 });
projectSchema.index({ 'metadata.tags': 1 });
projectSchema.index({ completedAt: -1 });

// Virtual fields
projectSchema.virtual('url').get(function() {
  return `/api/projects/${this._id}`;
});

projectSchema.virtual('shareUrl').get(function() {
  return this.shareToken ? `/share/project/${this.shareToken}` : null;
});

projectSchema.virtual('isOverdue').get(function() {
  return this.dueDate && new Date() > this.dueDate && this.status !== 'completed';
});

projectSchema.virtual('timeRemaining').get(function() {
  if (!this.dueDate || this.status === 'completed') return null;
  const now = new Date();
  const remaining = this.dueDate.getTime() - now.getTime();
  return Math.max(0, remaining);
});

projectSchema.virtual('completionPercentage').get(function() {
  return this.progress.percentage;
});

// Instance methods
projectSchema.methods.toPublicJSON = function() {
  const obj = this.toObject({ virtuals: true });
  
  // Remove sensitive information
  delete obj.shareSettings.password;
  delete obj.activityLog;
  delete obj.__v;
  
  // Filter collaborators for non-owners
  if (!this.isOwner) {
    obj.collaborators = obj.collaborators.map(collab => ({
      userId: collab.userId,
      name: collab.name,
      role: collab.role,
      joinedAt: collab.joinedAt
    }));
  }
  
  return obj;
};

projectSchema.methods.canUserAccess = function(userId, action = 'view') {
  // Owner has all permissions
  if (this.createdBy === userId) return true;
  
  // Check collaborator permissions
  const collaborator = this.collaborators.find(c => c.userId === userId && c.status === 'active');
  if (collaborator) {
    const permissionMap = {
      'view': true, // All active collaborators can view
      'edit': collaborator.permissions.canEdit || collaborator.role === 'editor',
      'comment': collaborator.permissions.canComment || ['editor', 'commenter'].includes(collaborator.role),
      'share': collaborator.permissions.canShare || collaborator.role === 'editor',
      'export': collaborator.permissions.canExport || ['owner', 'editor'].includes(collaborator.role),
      'delete': collaborator.permissions.canDelete || collaborator.role === 'owner'
    };
    
    return permissionMap[action] || false;
  }
  
  // Check public access
  if (this.isPublic) {
    if (action === 'view') return true;
    if (action === 'edit' && this.shareSettings.allowPublicEdit) return true;
  }
  
  return false;
};

projectSchema.methods.addCollaborator = function(userInfo, role = 'viewer', invitedBy) {
  // Check if user is already a collaborator
  const existingIndex = this.collaborators.findIndex(c => c.userId === userInfo.userId);
  
  if (existingIndex >= 0) {
    // Update existing collaborator
    this.collaborators[existingIndex].role = role;
    this.collaborators[existingIndex].status = 'active';
    this.collaborators[existingIndex].invitedBy = invitedBy;
  } else {
    // Add new collaborator
    const permissions = {
      canEdit: ['owner', 'editor'].includes(role),
      canComment: ['owner', 'editor', 'commenter'].includes(role),
      canShare: ['owner', 'editor'].includes(role),
      canExport: ['owner', 'editor'].includes(role),
      canDelete: role === 'owner'
    };
    
    this.collaborators.push({
      userId: userInfo.userId,
      email: userInfo.email,
      name: userInfo.name,
      role,
      permissions,
      invitedBy,
      status: 'pending'
    });
  }
  
  return this.save();
};

projectSchema.methods.removeCollaborator = function(userId) {
  this.collaborators = this.collaborators.filter(c => c.userId !== userId);
  return this.save();
};

projectSchema.methods.updateFormData = function(fieldId, value, userId) {
  const existingIndex = this.formData.findIndex(fd => fd.fieldId === fieldId);
  
  if (existingIndex >= 0) {
    // Update existing field data
    const existing = this.formData[existingIndex];
    existing.value = value;
    existing.lastModified = new Date();
    existing.modifiedBy = userId;
    existing.version += 1;
  } else {
    // Add new field data
    this.formData.push({
      fieldId,
      value,
      modifiedBy: userId,
      metadata: {
        source: 'manual'
      }
    });
  }
  
  this.lastActivityAt = new Date();
  this.modifiedBy = userId;
  
  // Update progress
  this.calculateProgress();
  
  // Log activity
  this.logActivity(userId, 'field_filled', {
    fieldId,
    value: typeof value === 'object' ? JSON.stringify(value) : value
  });
  
  return this.save();
};

projectSchema.methods.getFormData = function(fieldId = null) {
  if (fieldId) {
    const fieldData = this.formData.find(fd => fd.fieldId === fieldId);
    return fieldData ? fieldData.value : null;
  }
  
  // Return all form data as key-value pairs
  const result = {};
  this.formData.forEach(fd => {
    result[fd.fieldId] = fd.value;
  });
  
  return result;
};

projectSchema.methods.validateFormData = async function() {
  const Field = mongoose.model('Field');
  const Template = mongoose.model('Template');
  
  // Get template with fields
  const template = await Template.findById(this.templateId).populate('customFields');
  if (!template) {
    throw new Error('Template not found');
  }
  
  const validationResults = [];
  
  // Validate each field
  for (const field of template.customFields) {
    const fieldData = this.formData.find(fd => fd.fieldId === field.fieldId);
    const value = fieldData ? fieldData.value : null;
    
    const errors = Field.validateFieldValue(field, value);
    
    // Update validation status in form data
    if (fieldData) {
      fieldData.validation = {
        isValid: errors.length === 0,
        errors,
        lastValidated: new Date()
      };
    }
    
    validationResults.push({
      fieldId: field.fieldId,
      isValid: errors.length === 0,
      errors
    });
  }
  
  await this.save();
  return validationResults;
};

projectSchema.methods.calculateProgress = function() {
  if (!this.templateId) return;
  
  const Template = mongoose.model('Template');
  Template.findById(this.templateId).populate('customFields').then(template => {
    if (!template) return;
    
    const totalFields = template.customFields.length;
    const requiredFields = template.customFields.filter(f => f.required);
    
    let completedFields = 0;
    let completedRequiredFields = 0;
    
    this.formData.forEach(fd => {
      const field = template.customFields.find(f => f.fieldId === fd.fieldId);
      if (!field) return;
      
      const hasValue = fd.value !== null && fd.value !== undefined && fd.value !== '';
      
      if (hasValue) {
        completedFields++;
        if (field.required) {
          completedRequiredFields++;
        }
      }
    });
    
    // Calculate percentage based on required fields if any exist, otherwise all fields
    const relevantTotal = requiredFields.length > 0 ? requiredFields.length : totalFields;
    const relevantCompleted = requiredFields.length > 0 ? completedRequiredFields : completedFields;
    
    this.progress = {
      totalFields,
      completedFields: relevantCompleted,
      percentage: relevantTotal > 0 ? Math.round((relevantCompleted / relevantTotal) * 100) : 0,
      lastCalculated: new Date()
    };
    
    // Update status based on progress
    if (this.progress.percentage === 100 && this.status === 'in_progress') {
      this.status = 'review';
    } else if (this.progress.percentage > 0 && this.status === 'draft') {
      this.status = 'in_progress';
      this.startedAt = new Date();
    }
    
    this.save();
  }).catch(console.error);
};

projectSchema.methods.addComment = function(userId, userName, text, fieldId = null) {
  const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  this.comments.push({
    commentId,
    fieldId,
    userId,
    userName,
    text
  });
  
  this.logActivity(userId, 'comment_added', {
    commentId,
    fieldId,
    text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
  });
  
  return this.save();
};

projectSchema.methods.resolveComment = function(commentId, userId) {
  const comment = this.comments.find(c => c.commentId === commentId);
  if (!comment) return false;
  
  comment.resolved = true;
  comment.resolvedBy = userId;
  comment.resolvedAt = new Date();
  
  this.logActivity(userId, 'comment_resolved', { commentId });
  
  return this.save();
};

projectSchema.methods.logActivity = function(userId, action, details = {}, fieldId = null) {
  this.activityLog.push({
    userId,
    action,
    details,
    fieldId,
    timestamp: new Date()
  });
  
  // Keep only last 1000 activities
  if (this.activityLog.length > 1000) {
    this.activityLog = this.activityLog.slice(-1000);
  }
};

projectSchema.methods.generateShareToken = function() {
  const crypto = require('crypto');
  this.shareToken = crypto.randomBytes(32).toString('hex');
  return this.save();
};

projectSchema.methods.exportProject = async function(format = 'pdf', config = {}, userId) {
  const crypto = require('crypto');
  const exportId = crypto.randomBytes(16).toString('hex');
  
  // This would integrate with your PDF/export service
  // For now, we'll just create the export record
  
  const exportRecord = {
    exportId,
    format,
    filePath: `/exports/${this._id}/${exportId}.${format}`,
    fileSize: 0, // Would be calculated during actual export
    config,
    createdBy: userId
  };
  
  this.exports.push(exportRecord);
  this.logActivity(userId, 'exported', { format, exportId });
  
  await this.save();
  
  // Return export info for processing
  return {
    exportId,
    project: this,
    config,
    format
  };
};

projectSchema.methods.completeProject = function(userId) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.modifiedBy = userId;
  
  this.logActivity(userId, 'status_changed', {
    from: 'review',
    to: 'completed'
  });
  
  return this.save();
};

projectSchema.methods.archiveProject = function(userId) {
  this.status = 'archived';
  this.modifiedBy = userId;
  
  this.logActivity(userId, 'status_changed', {
    from: this.status,
    to: 'archived'
  });
  
  return this.save();
};

projectSchema.methods.cloneProject = async function(newName, userId) {
  const projectObj = this.toObject();
  delete projectObj._id;
  delete projectObj.createdAt;
  delete projectObj.updatedAt;
  delete projectObj.slug;
  delete projectObj.shareToken;
  delete projectObj.activityLog;
  delete projectObj.exports;
  
  projectObj.name = newName;
  projectObj.createdBy = userId;
  projectObj.modifiedBy = null;
  projectObj.status = 'draft';
  projectObj.startedAt = null;
  projectObj.completedAt = null;
  projectObj.collaborators = [];
  projectObj.comments = [];
  projectObj.progress = {
    totalFields: 0,
    completedFields: 0,
    percentage: 0,
    lastCalculated: new Date()
  };
  
  const Project = mongoose.model('Project');
  const newProject = new Project(projectObj);
  await newProject.save();
  
  return newProject;
};

// Static methods
projectSchema.statics.findByUser = function(userId, options = {}) {
  const query = {
    $or: [
      { createdBy: userId },
      { 'collaborators.userId': userId, 'collaborators.status': 'active' }
    ]
  };
  
  if (options.status) {
    query.status = options.status;
  } else {
    query.status = { $ne: 'archived' };
  }
  
  if (options.templateId) {
    query.templateId = options.templateId;
  }
  
  if (options.organization) {
    query.organization = options.organization;
  }
  
  let findQuery = this.find(query);
  
  if (options.sort) {
    const sortOptions = {
      'recent': { lastActivityAt: -1 },
      'name': { name: 1 },
      'dueDate': { dueDate: 1 },
      'progress': { 'progress.percentage': -1 },
      'status': { status: 1, lastActivityAt: -1 }
    };
    
    findQuery = findQuery.sort(sortOptions[options.sort] || sortOptions.recent);
  } else {
    findQuery = findQuery.sort({ lastActivityAt: -1 });
  }
  
  if (options.limit) {
    findQuery = findQuery.limit(parseInt(options.limit));
  }
  
  if (options.skip) {
    findQuery = findQuery.skip(parseInt(options.skip));
  }
  
  return findQuery.populate('templateId', 'name category');
};

projectSchema.statics.findByTemplate = function(templateId, options = {}) {
  const query = { templateId };
  
  if (options.status) {
    query.status = options.status;
  } else {
    query.status = { $ne: 'archived' };
  }
  
  return this.find(query)
    .sort({ lastActivityAt: -1 })
    .populate('templateId', 'name category');
};

projectSchema.statics.getOverdueProjects = function(userId = null) {
  const query = {
    dueDate: { $lt: new Date() },
    status: { $nin: ['completed', 'archived', 'cancelled'] }
  };
  
  if (userId) {
    query.$or = [
      { createdBy: userId },
      { 'collaborators.userId': userId, 'collaborators.status': 'active' }
    ];
  }
  
  return this.find(query)
    .sort({ dueDate: 1 })
    .populate('templateId', 'name category');
};

projectSchema.statics.getProjectStats = function(userId, timeframe = 'month') {
  const now = new Date();
  let startDate;
  
  switch (timeframe) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  const query = {
    $or: [
      { createdBy: userId },
      { 'collaborators.userId': userId, 'collaborators.status': 'active' }
    ],
    createdAt: { $gte: startDate }
  };
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProgress: { $avg: '$progress.percentage' }
      }
    }
  ]);
};

// Pre-save middleware
projectSchema.pre('save', function(next) {
  // Generate slug from name
  if (!this.slug || this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  // Update modification info
  if (!this.isNew && this.isModified()) {
    this.lastActivityAt = new Date();
  }
  
  // Set project owner as first collaborator with owner role
  if (this.isNew) {
    this.collaborators = [{
      userId: this.createdBy,
      email: 'owner@example.com', // Would be fetched from user service
      name: 'Project Owner', // Would be fetched from user service
      role: 'owner',
      permissions: {
        canEdit: true,
        canComment: true,
        canShare: true,
        canExport: true,
        canDelete: true
      },
      invitedBy: this.createdBy,
      joinedAt: new Date(),
      status: 'active'
    }];
  }
  
  next();
});

// Pre-remove middleware
projectSchema.pre('remove', async function(next) {
  // Clean up exports and attachments
  const fs = require('fs').promises;
  
  try {
    // Remove export files
    for (const exportRecord of this.exports) {
      try {
        await fs.unlink(exportRecord.filePath);
      } catch (err) {
        console.error('Error removing export file:', err);
      }
    }
    
    // Remove attachment files
    for (const attachment of this.attachments) {
      try {
        await fs.unlink(attachment.filePath);
      } catch (err) {
        console.error('Error removing attachment file:', err);
      }
    }
  } catch (err) {
    console.error('Error during project cleanup:', err);
  }
  
  next();
});

// Post-save middleware
projectSchema.post('save', function(doc) {
  // Could trigger notifications, webhooks, etc.
  console.log(`Project ${doc.name} saved`);
  
  // Example: Send notification for overdue projects
  if (doc.isOverdue && doc.status !== 'completed') {
    // Trigger overdue notification
    console.log(`Project ${doc.name} is overdue`);
  }
});

// Compound indexes for complex queries
projectSchema.index({ createdBy: 1, status: 1, lastActivityAt: -1 });
projectSchema.index({ templateId: 1, status: 1, createdAt: -1 });
projectSchema.index({ dueDate: 1, status: 1 });
projectSchema.index({ 'collaborators.userId': 1, 'collaborators.status': 1 });

module.exports = mongoose.model('Project', projectSchema);