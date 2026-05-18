const mongoose = require('mongoose');

// Field validation rules sub-schema
const fieldValidationSchema = new mongoose.Schema({
  minLength: {
    type: Number,
    min: 0,
    default: null
  },
  maxLength: {
    type: Number,
    min: 0,
    default: null
  },
  pattern: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true;
        try {
          new RegExp(v);
          return true;
        } catch (e) {
          return false;
        }
      },
      message: 'Invalid regular expression pattern'
    }
  },
  min: {
    type: Number,
    default: null
  },
  max: {
    type: Number,
    default: null
  },
  dateFormat: {
    type: String,
    enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'MM-DD-YYYY', 'DD-MM-YYYY'],
    default: 'MM/DD/YYYY'
  },
  customValidator: {
    type: String,
    default: null
  },
  errorMessage: {
    type: String,
    maxlength: 500,
    default: null
  }
}, { _id: false });

// Field position sub-schema
const fieldPositionSchema = new mongoose.Schema({
  x: {
    type: Number,
    required: true,
    min: 0
  },
  y: {
    type: Number,
    required: true,
    min: 0
  },
  width: {
    type: Number,
    required: true,
    min: 1
  },
  height: {
    type: Number,
    required: true,
    min: 1
  },
  page: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  zIndex: {
    type: Number,
    default: 1
  }
}, { _id: false });

// Field styling sub-schema
const fieldStylingSchema = new mongoose.Schema({
  fontSize: {
    type: Number,
    min: 6,
    max: 72,
    default: 12
  },
  fontFamily: {
    type: String,
    enum: ['Helvetica', 'Times-Roman', 'Courier', 'Arial', 'Georgia', 'Verdana'],
    default: 'Helvetica'
  },
  fontWeight: {
    type: String,
    enum: ['normal', 'bold'],
    default: 'normal'
  },
  textAlign: {
    type: String,
    enum: ['left', 'center', 'right'],
    default: 'left'
  },
  textColor: {
    type: String,
    default: '#000000',
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },
  backgroundColor: {
    type: String,
    default: 'transparent',
    match: /^(#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})|transparent|rgba?\([^)]+\))$/
  },
  borderColor: {
    type: String,
    default: '#000000',
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },
  borderWidth: {
    type: Number,
    min: 0,
    max: 10,
    default: 1
  },
  borderStyle: {
    type: String,
    enum: ['solid', 'dashed', 'dotted'],
    default: 'solid'
  },
  borderRadius: {
    type: Number,
    min: 0,
    max: 50,
    default: 0
  },
  opacity: {
    type: Number,
    min: 0,
    max: 1,
    default: 1
  }
}, { _id: false });

// Field option sub-schema (for radio buttons, checkboxes, dropdowns)
const fieldOptionSchema = new mongoose.Schema({
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  label: {
    type: String,
    required: true,
    maxlength: 255
  },
  selected: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  disabled: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Field dependency sub-schema (for conditional fields)
const fieldDependencySchema = new mongoose.Schema({
  fieldId: {
    type: String,
    required: true
  },
  condition: {
    type: String,
    enum: ['equals', 'notEquals', 'contains', 'notContains', 'greaterThan', 'lessThan', 'isEmpty', 'isNotEmpty'],
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  action: {
    type: String,
    enum: ['show', 'hide', 'require', 'optional', 'enable', 'disable'],
    default: 'show'
  }
}, { _id: false });

// Main Field Schema
const fieldSchema = new mongoose.Schema({
  // Basic field information
  fieldId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: /^[a-zA-Z0-9_-]+$/
  },
  
  type: {
    type: String,
    required: true,
    enum: [
      'text', 'multiline', 'number', 'email', 'phone', 'url',
      'checkbox', 'radio', 'select', 'multiselect',
      'date', 'datetime', 'time',
      'signature', 'initial', 'image',
      'file', 'password', 'hidden',
      'calculation', 'barcode', 'qrcode'
    ],
    index: true
  },
  
  label: {
    type: String,
    required: true,
    maxlength: 255,
    trim: true
  },
  
  placeholder: {
    type: String,
    maxlength: 255,
    trim: true,
    default: ''
  },
  
  description: {
    type: String,
    maxlength: 1000,
    trim: true,
    default: ''
  },
  
  helpText: {
    type: String,
    maxlength: 500,
    trim: true,
    default: ''
  },
  
  // Field value and options
  defaultValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  options: [fieldOptionSchema],
  
  // Field behavior
  required: {
    type: Boolean,
    default: false
  },
  
  readonly: {
    type: Boolean,
    default: false
  },
  
  disabled: {
    type: Boolean,
    default: false
  },
  
  hidden: {
    type: Boolean,
    default: false
  },
  
  // Field positioning and styling
  position: {
    type: fieldPositionSchema,
    required: true
  },
  
  styling: {
    type: fieldStylingSchema,
    default: () => ({})
  },
  
  // Field validation
  validation: {
    type: fieldValidationSchema,
    default: () => ({})
  },
  
  // Field dependencies and logic
  dependencies: [fieldDependencySchema],
  
  // Calculation formula for calculated fields
  calculationFormula: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        if (!v || this.type !== 'calculation') return true;
        // Basic formula validation - can be enhanced
        return /^[a-zA-Z0-9_+\-*/().\s]+$/.test(v);
      },
      message: 'Invalid calculation formula'
    }
  },
  
  // Field metadata
  category: {
    type: String,
    enum: ['personal', 'business', 'financial', 'legal', 'medical', 'custom'],
    default: 'custom'
  },
  
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // Field usage tracking
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  lastUsed: {
    type: Date,
    default: null
  },
  
  // Field versioning
  version: {
    type: String,
    default: '1.0.0'
  },
  
  changelog: [{
    version: String,
    changes: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    author: {
      type: String,
      default: 'system'
    }
  }],
  
  // Template and project associations
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    index: true
  },
  
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  
  // Field ownership and permissions
  createdBy: {
    type: String,
    required: true,
    index: true
  },
  
  modifiedBy: {
    type: String,
    default: null
  },
  
  permissions: {
    read: [{
      type: String
    }],
    write: [{
      type: String
    }],
    delete: [{
      type: String
    }]
  },
  
  // Field status and lifecycle
  status: {
    type: String,
    enum: ['draft', 'active', 'deprecated', 'archived'],
    default: 'active',
    index: true
  },
  
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Signature-specific fields
  signatureSettings: {
    maxWidth: {
      type: Number,
      default: 200
    },
    maxHeight: {
      type: Number,
      default: 100
    },
    penColor: {
      type: String,
      default: '#000000'
    },
    penWidth: {
      type: Number,
      default: 2,
      min: 1,
      max: 10
    },
    backgroundColor: {
      type: String,
      default: 'transparent'
    }
  }
}, {
  timestamps: true,
  versionKey: '__v'
});

// Indexes for better query performance
fieldSchema.index({ templateId: 1, status: 1 });
fieldSchema.index({ projectId: 1, status: 1 });
fieldSchema.index({ createdBy: 1, createdAt: -1 });
fieldSchema.index({ type: 1, category: 1 });
fieldSchema.index({ tags: 1 });
fieldSchema.index({ 'position.page': 1 });

// Virtual for field URL
fieldSchema.virtual('url').get(function() {
  return `/api/fields/${this._id}`;
});

// Virtual for field position string
fieldSchema.virtual('positionString').get(function() {
  return `Page ${this.position.page}: (${this.position.x}, ${this.position.y})`;
});

// Instance methods
fieldSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.permissions;
  delete obj.__v;
  return obj;
};

fieldSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

fieldSchema.methods.addToChangelog = function(changes, author = 'system') {
  this.changelog.push({
    version: this.version,
    changes,
    author
  });
  return this.save();
};

fieldSchema.methods.canUserAccess = function(userId, action = 'read') {
  if (this.createdBy === userId) return true;
  if (this.isPublic && action === 'read') return true;
  
  const permissions = this.permissions[action] || [];
  return permissions.includes(userId) || permissions.includes('*');
};

fieldSchema.methods.updatePosition = function(newPosition) {
  this.position = { ...this.position.toObject(), ...newPosition };
  return this.save();
};

fieldSchema.methods.updateStyling = function(newStyling) {
  this.styling = { ...this.styling.toObject(), ...newStyling };
  return this.save();
};

// Static methods
fieldSchema.statics.findByTemplate = function(templateId, options = {}) {
  const query = { templateId, status: { $ne: 'archived' } };
  
  let findQuery = this.find(query);
  
  if (options.page) {
    findQuery = findQuery.where('position.page').equals(options.page);
  }
  
  if (options.type) {
    findQuery = findQuery.where('type').equals(options.type);
  }
  
  return findQuery.sort({ 'position.page': 1, 'position.y': 1, 'position.x': 1 });
};

fieldSchema.statics.findByProject = function(projectId, options = {}) {
  const query = { projectId, status: { $ne: 'archived' } };
  return this.find(query).sort({ createdAt: -1 });
};

fieldSchema.statics.findByUser = function(userId, options = {}) {
  const query = {
    $or: [
      { createdBy: userId },
      { 'permissions.read': { $in: [userId, '*'] } },
      { isPublic: true }
    ],
    status: { $ne: 'archived' }
  };
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

fieldSchema.statics.getFieldTypes = function() {
  return [
    'text', 'multiline', 'number', 'email', 'phone', 'url',
    'checkbox', 'radio', 'select', 'multiselect',
    'date', 'datetime', 'time',
    'signature', 'initial', 'image',
    'file', 'password', 'hidden',
    'calculation', 'barcode', 'qrcode'
  ];
};

fieldSchema.statics.validateFieldValue = function(field, value) {
  const validation = field.validation;
  const errors = [];
  
  // Required field check
  if (field.required && (value === null || value === undefined || value === '')) {
    errors.push('This field is required');
    return errors;
  }
  
  if (value === null || value === undefined || value === '') {
    return errors; // No further validation for empty optional fields
  }
  
  // Type-specific validation
  switch (field.type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push('Invalid email format');
      }
      break;
      
    case 'phone':
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
        errors.push('Invalid phone number format');
      }
      break;
      
    case 'number':
      if (isNaN(value)) {
        errors.push('Must be a valid number');
      } else {
        const numValue = parseFloat(value);
        if (validation.min !== null && numValue < validation.min) {
          errors.push(`Value must be at least ${validation.min}`);
        }
        if (validation.max !== null && numValue > validation.max) {
          errors.push(`Value must be at most ${validation.max}`);
        }
      }
      break;
      
    case 'text':
    case 'multiline':
      if (validation.minLength && value.length < validation.minLength) {
        errors.push(`Must be at least ${validation.minLength} characters`);
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        errors.push(`Must be at most ${validation.maxLength} characters`);
      }
      if (validation.pattern) {
        try {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(value)) {
            errors.push(validation.errorMessage || 'Invalid format');
          }
        } catch (e) {
          errors.push('Pattern validation error');
        }
      }
      break;
  }
  
  return errors;
};

// Pre-save middleware
fieldSchema.pre('save', function(next) {
  // Generate fieldId if not provided
  if (!this.fieldId) {
    this.fieldId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Set modifiedBy on updates
  if (!this.isNew && this.isModified()) {
    this.modifiedBy = this.createdBy; // In real app, get from request context
  }
  
  // Validate field-specific requirements
  if (this.type === 'signature' || this.type === 'initial') {
    if (!this.signatureSettings) {
      this.signatureSettings = {};
    }
  }
  
  next();
});

// Post-save middleware
fieldSchema.post('save', function(doc) {
  // Could trigger events, update template modification dates, etc.
  console.log(`Field ${doc.fieldId} saved`);
});

module.exports = mongoose.model('Field', fieldSchema);