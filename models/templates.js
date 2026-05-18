const mongoose = require('mongoose');

// Template settings sub-schema
const templateSettingsSchema = new mongoose.Schema({
  autoSave: {
    type: Boolean,
    default: true
  },
  autoValidate: {
    type: Boolean,
    default: true
  },
  allowSignatures: {
    type: Boolean,
    default: true
  },
  requireAllFields: {
    type: Boolean,
    default: false
  },
  enableFieldLogic: {
    type: Boolean,
    default: false
  },
  multiPageSupport: {
    type: Boolean,
    default: true
  },
  maxPages: {
    type: Number,
    min: 1,
    max: 50,
    default: 10
  },
  defaultPageSize: {
    type: String,
    enum: ['A4', 'Letter', 'Legal', 'A3', 'A5', 'Custom'],
    default: 'A4'
  },
  customPageDimensions: {
    width: {
      type: Number,
      default: 595 // A4 width in points
    },
    height: {
      type: Number,
      default: 842 // A4 height in points
    }
  },
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto', 'custom'],
    default: 'light'
  },
  customTheme: {
    primaryColor: {
      type: String,
      default: '#007bff'
    },
    secondaryColor: {
      type: String,
      default: '#6c757d'
    },
    backgroundColor: {
      type: String,
      default: '#ffffff'
    },
    textColor: {
      type: String,
      default: '#333333'
    }
  }
}, { _id: false });

// PDF information sub-schema
const pdfInfoSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    maxlength: 255
  },
  fileName: {
    type: String,
    required: true,
    maxlength: 255
  },
  filePath: {
    type: String,
    required: true,
    maxlength: 500
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0
  },
  mimeType: {
    type: String,
    default: 'application/pdf'
  },
  pageCount: {
    type: Number,
    required: true,
    min: 1
  },
  dimensions: [{
    page: {
      type: Number,
      required: true
    },
    width: {
      type: Number,
      required: true
    },
    height: {
      type: Number,
      required: true
    }
  }],
  checksum: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Template statistics sub-schema
const templateStatsSchema = new mongoose.Schema({
  totalFields: {
    type: Number,
    default: 0,
    min: 0
  },
  filledForms: {
    type: Number,
    default: 0,
    min: 0
  },
  averageCompletionTime: {
    type: Number,
    default: 0, // in seconds
    min: 0
  },
  lastUsed: {
    type: Date,
    default: null
  },
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  downloads: {
    type: Number,
    default: 0,
    min: 0
  },
  shares: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, { _id: false });

// Template workflow sub-schema
const workflowStepSchema = new mongoose.Schema({
  stepId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 255
  },
  description: {
    type: String,
    maxlength: 1000
  },
  order: {
    type: Number,
    required: true,
    min: 1
  },
  assignedRole: {
    type: String,
    maxlength: 100
  },
  estimatedDuration: {
    type: Number, // in minutes
    min: 1
  },
  requiredFields: [{
    type: String // field IDs
  }],
  conditions: [{
    fieldId: String,
    operator: {
      type: String,
      enum: ['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan']
    },
    value: mongoose.Schema.Types.Mixed
  }],
  actions: [{
    type: {
      type: String,
      enum: ['notify', 'email', 'webhook', 'approve', 'reject']
    },
    config: mongoose.Schema.Types.Mixed
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'deprecated'],
    default: 'active'
  }
}, { _id: false });

// Main Template Schema
const templateSchema = new mongoose.Schema({
  // Basic template information
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
  
  category: {
    type: String,
    enum: ['property', 'legal', 'business', 'personal', 'medical', 'financial', 'educational', 'government', 'custom'],
    default: 'custom',
    index: true
  },
  
  subcategory: {
    type: String,
    maxlength: 100,
    trim: true
  },
  
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // PDF file information
  pdfInfo: {
    type: pdfInfoSchema,
    required: true
  },
  
  // Template settings and configuration
  settings: {
    type: templateSettingsSchema,
    default: () => ({})
  },
  
  // Field mappings and detected fields
  detectedFields: [{
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    page: Number,
    text: String,
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    type: {
      type: String,
      enum: ['text', 'checkbox', 'signature', 'date', 'unknown'],
      default: 'unknown'
    }
  }],
  
  // Custom field definitions (references to Field model)
  customFields: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Field'
  }],
  
  // Field mapping between detected and custom fields
  fieldMappings: [{
    detectedFieldIndex: Number,
    customFieldId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field'
    },
    mappingType: {
      type: String,
      enum: ['automatic', 'manual', 'override'],
      default: 'manual'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    }
  }],
  
  // Template workflow
  workflow: [workflowStepSchema],
  
  // Template versioning
  version: {
    type: String,
    default: '1.0.0'
  },
  
  parentTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    default: null
  },
  
  versions: [{
    version: String,
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template'
    },
    changelog: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Template statistics and analytics
  stats: {
    type: templateStatsSchema,
    default: () => ({})
  },
  
  // Template access and permissions
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isTemplate: {
    type: Boolean,
    default: true // false for instances/filled forms
  },
  
  permissions: {
    view: [{
      userId: String,
      role: String,
      grantedAt: {
        type: Date,
        default: Date.now
      }
    }],
    edit: [{
      userId: String,
      role: String,
      grantedAt: {
        type: Date,
        default: Date.now
      }
    }],
    delete: [{
      userId: String,
      role: String,
      grantedAt: {
        type: Date,
        default: Date.now
      }
    }],
    share: [{
      userId: String,
      role: String,
      grantedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Template ownership
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
  
  // Template status and lifecycle
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'deprecated', 'archived'],
    default: 'draft',
    index: true
  },
  
  // Template publication and sharing
  publishedAt: {
    type: Date,
    default: null
  },
  
  publishedBy: {
    type: String,
    default: null
  },
  
  marketplace: {
    isListed: {
      type: Boolean,
      default: false
    },
    price: {
      type: Number,
      min: 0,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    licenseType: {
      type: String,
      enum: ['free', 'paid', 'subscription', 'enterprise'],
      default: 'free'
    }
  },
  
  // Template metadata
  metadata: {
    industry: [{
      type: String,
      maxlength: 100
    }],
    useCase: [{
      type: String,
      maxlength: 100
    }],
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    estimatedTime: {
      type: Number, // in minutes
      min: 1
    },
    language: {
      type: String,
      default: 'en'
    },
    compliance: [{
      standard: String,
      certified: Boolean,
      certifiedAt: Date
    }]
  },
  
  // Template backup and recovery
  backup: {
    lastBackupAt: Date,
    backupLocation: String,
    backupSize: Number
  }
}, {
  timestamps: true,
  versionKey: '__v'
});

// Indexes for better query performance
templateSchema.index({ name: 'text', description: 'text', tags: 'text' });
templateSchema.index({ category: 1, status: 1, isPublic: 1 });
templateSchema.index({ createdBy: 1, createdAt: -1 });
templateSchema.index({ 'stats.lastUsed': -1 });
templateSchema.index({ 'stats.rating.average': -1, 'stats.filledForms': -1 });
templateSchema.index({ publishedAt: -1 });
templateSchema.index({ organization: 1, status: 1 });

// Virtual fields
templateSchema.virtual('url').get(function() {
  return `/api/templates/${this._id}`;
});

templateSchema.virtual('previewUrl').get(function() {
  return `/api/templates/${this._id}/preview`;
});

templateSchema.virtual('fieldCount').get(function() {
  return this.customFields.length + this.detectedFields.length;
});

templateSchema.virtual('isOwner').get(function() {
  // This would be set in middleware based on current user context
  return this.createdBy === this.currentUserId;
});

// Instance methods
templateSchema.methods.toPublicJSON = function() {
  const obj = this.toObject({ virtuals: true });
  
  // Remove sensitive information
  delete obj.permissions;
  delete obj.backup;
  delete obj.__v;
  
  // Only show basic stats for public view
  if (!this.isOwner) {
    obj.stats = {
      filledForms: obj.stats.filledForms,
      rating: obj.stats.rating,
      views: obj.stats.views
    };
  }
  
  return obj;
};

templateSchema.methods.canUserAccess = function(userId, action = 'view') {
  // Owner has all permissions
  if (this.createdBy === userId) return true;
  
  // Public templates can be viewed by anyone
  if (this.isPublic && action === 'view') return true;
  
  // Check specific permissions
  const permissions = this.permissions[action] || [];
  return permissions.some(perm => perm.userId === userId || perm.role === '*');
};

templateSchema.methods.addField = async function(fieldData) {
  const Field = mongoose.model('Field');
  
  const field = new Field({
    ...fieldData,
    templateId: this._id,
    createdBy: this.createdBy
  });
  
  await field.save();
  this.customFields.push(field._id);
  this.stats.totalFields = this.customFields.length + this.detectedFields.length;
  
  return this.save();
};

templateSchema.methods.removeField = async function(fieldId) {
  const Field = mongoose.model('Field');
  
  // Remove from customFields array
  this.customFields.pull(fieldId);
  
  // Update field mappings
  this.fieldMappings = this.fieldMappings.filter(
    mapping => !mapping.customFieldId.equals(fieldId)
  );
  
  // Update stats
  this.stats.totalFields = this.customFields.length + this.detectedFields.length;
  
  // Delete the field
  await Field.findByIdAndDelete(fieldId);
  
  return this.save();
};

templateSchema.methods.incrementUsage = function() {
  this.stats.filledForms += 1;
  this.stats.lastUsed = new Date();
  return this.save();
};

templateSchema.methods.incrementViews = function() {
  this.stats.views += 1;
  return this.save();
};

templateSchema.methods.addRating = function(rating) {
  const currentTotal = this.stats.rating.average * this.stats.rating.count;
  this.stats.rating.count += 1;
  this.stats.rating.average = (currentTotal + rating) / this.stats.rating.count;
  return this.save();
};

templateSchema.methods.createVersion = async function(changelog) {
  // Create a copy of current template as new version
  const templateObj = this.toObject();
  delete templateObj._id;
  delete templateObj.createdAt;
  delete templateObj.updatedAt;
  
  templateObj.version = this.incrementVersion();
  templateObj.parentTemplate = this._id;
  templateObj.status = 'draft';
  
  const Template = mongoose.model('Template');
  const newVersion = new Template(templateObj);
  await newVersion.save();
  
  // Add version reference to current template
  this.versions.push({
    version: newVersion.version,
    templateId: newVersion._id,
    changelog
  });
  
  return this.save();
};

templateSchema.methods.incrementVersion = function() {
  const [major, minor, patch] = this.version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
};

templateSchema.methods.publish = function() {
  this.status = 'active';
  this.publishedAt = new Date();
  this.publishedBy = this.createdBy;
  return this.save();
};

templateSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

templateSchema.methods.clone = async function(newName, userId) {
  const templateObj = this.toObject();
  delete templateObj._id;
  delete templateObj.createdAt;
  delete templateObj.updatedAt;
  delete templateObj.slug;
  
  templateObj.name = newName;
  templateObj.createdBy = userId;
  templateObj.status = 'draft';
  templateObj.version = '1.0.0';
  templateObj.parentTemplate = this._id;
  templateObj.stats = {
    totalFields: templateObj.stats.totalFields,
    filledForms: 0,
    views: 0,
    downloads: 0,
    shares: 0,
    rating: { average: 0, count: 0 }
  };
  
  // Clone associated fields
  const Field = mongoose.model('Field');
  const originalFields = await Field.find({ _id: { $in: this.customFields } });
  const fieldMap = new Map();
  
  for (const field of originalFields) {
    const fieldObj = field.toObject();
    delete fieldObj._id;
    delete fieldObj.createdAt;
    delete fieldObj.updatedAt;
    
    fieldObj.createdBy = userId;
    fieldObj.templateId = null; // Will be set after template is saved
    
    const newField = new Field(fieldObj);
    await newField.save();
    
    fieldMap.set(field._id.toString(), newField._id);
    templateObj.customFields = templateObj.customFields.map(id => 
      fieldMap.get(id.toString()) || id
    );
  }
  
  const Template = mongoose.model('Template');
  const newTemplate = new Template(templateObj);
  await newTemplate.save();
  
  // Update field template references
  await Field.updateMany(
    { _id: { $in: Array.from(fieldMap.values()) } },
    { templateId: newTemplate._id }
  );
  
  return newTemplate;
};

// Static methods
templateSchema.statics.findPublic = function(options = {}) {
  const query = { isPublic: true, status: 'active' };
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.search) {
    query.$text = { $search: options.search };
  }
  
  let findQuery = this.find(query);
  
  if (options.sort) {
    const sortOptions = {
      'popular': { 'stats.filledForms': -1, 'stats.views': -1 },
      'rating': { 'stats.rating.average': -1, 'stats.rating.count': -1 },
      'recent': { publishedAt: -1 },
      'name': { name: 1 }
    };
    
    findQuery = findQuery.sort(sortOptions[options.sort] || sortOptions.recent);
  }
  
  if (options.limit) {
    findQuery = findQuery.limit(parseInt(options.limit));
  }
  
  if (options.skip) {
    findQuery = findQuery.skip(parseInt(options.skip));
  }
  
  return findQuery.populate('customFields', 'fieldId type label position');
};

templateSchema.statics.findByUser = function(userId, options = {}) {
  const query = {
    $or: [
      { createdBy: userId },
      { 'permissions.view.userId': userId },
      { organization: options.organization }
    ],
    status: { $ne: 'archived' }
  };
  
  return this.find(query)
    .sort({ updatedAt: -1 })
    .populate('customFields', 'fieldId type label position');
};

templateSchema.statics.getCategories = function() {
  return ['property', 'legal', 'business', 'personal', 'medical', 'financial', 'educational', 'government', 'custom'];
};

templateSchema.statics.getPopular = function(limit = 10) {
  return this.find({ isPublic: true, status: 'active' })
    .sort({ 'stats.filledForms': -1, 'stats.rating.average': -1 })
    .limit(limit)
    .populate('customFields', 'fieldId type label');
};

templateSchema.statics.searchTemplates = function(searchTerm, options = {}) {
  const query = {
    $text: { $search: searchTerm },
    status: 'active'
  };
  
  if (!options.includePrivate) {
    query.isPublic = true;
  }
  
  if (options.category) {
    query.category = options.category;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

// Pre-save middleware
templateSchema.pre('save', function(next) {
  // Generate slug from name
  if (!this.slug || this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  // Update modification info
  if (!this.isNew && this.isModified()) {
    this.modifiedBy = this.createdBy; // In real app, get from request context
  }
  
  // Update total fields count
  this.stats.totalFields = this.customFields.length + this.detectedFields.length;
  
  next();
});

// Pre-remove middleware
templateSchema.pre('remove', async function(next) {
  const Field = mongoose.model('Field');
  
  // Remove all associated fields
  await Field.deleteMany({ templateId: this._id });
  
  // Remove from projects
  const Project = mongoose.model('Project');
  await Project.updateMany(
    { templateId: this._id },
    { $unset: { templateId: 1 }, status: 'orphaned' }
  );
  
  next();
});

// Post-save middleware
templateSchema.post('save', function(doc) {
  // Could trigger events, update search indexes, etc.
  console.log(`Template ${doc.name} saved`);
});

module.exports = mongoose.model('Template', templateSchema);