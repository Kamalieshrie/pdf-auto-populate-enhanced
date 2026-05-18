import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { FieldService } from '../../services/field-service.js';

describe('FieldService', () => {
  let fieldService;
  
  beforeEach(() => {
    fieldService = new FieldService();
  });

  describe('Field Validation', () => {
    test('should validate required fields correctly', () => {
      const fieldDefinition = {
        type: 'text',
        required: true,
        validation: {
          minLength: 2,
          maxLength: 50
        }
      };

      // Test valid input
      expect(fieldService.validateField('John Doe', fieldDefinition)).toEqual({
        isValid: true,
        errors: []
      });

      // Test empty required field
      expect(fieldService.validateField('', fieldDefinition)).toEqual({
        isValid: false,
        errors: ['This field is required']
      });

      // Test too short
      expect(fieldService.validateField('J', fieldDefinition)).toEqual({
        isValid: false,
        errors: ['Must be at least 2 characters']
      });
    });

    test('should validate email fields correctly', () => {
      const emailField = {
        type: 'email',
        required: true,
        validation: {
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
        }
      };

      expect(fieldService.validateField('user@example.com', emailField)).toEqual({
        isValid: true,
        errors: []
      });

      expect(fieldService.validateField('invalid-email', emailField)).toEqual({
        isValid: false,
        errors: ['Invalid format']
      });
    });

    test('should validate phone number fields', () => {
      const phoneField = {
        type: 'tel',
        required: true,
        validation: {
          pattern: '^[\\d\\s\\-\\(\\)\\+]+$',
          minLength: 10,
          maxLength: 15
        }
      };

      expect(fieldService.validateField('(555) 123-4567', phoneField)).toEqual({
        isValid: true,
        errors: []
      });

      expect(fieldService.validateField('555-123-456', phoneField)).toEqual({
        isValid: false,
        errors: ['Must be at least 10 characters']
      });
    });

    test('should validate currency fields', () => {
      const currencyField = {
        type: 'currency',
        required: false,
        validation: {
          min: 0,
          max: 1000000
        }
      };

      expect(fieldService.validateField('50000', currencyField)).toEqual({
        isValid: true,
        errors: []
      });

      expect(fieldService.validateField('-100', currencyField)).toEqual({
        isValid: false,
        errors: ['Value must be greater than or equal to 0']
      });
    });

    test('should validate date fields', () => {
      const dateField = {
        type: 'date',
        required: true,
        validation: {
          maxDate: 'today'
        }
      };

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      expect(fieldService.validateField(yesterday.toISOString().split('T')[0], dateField)).toEqual({
        isValid: true,
        errors: []
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      expect(fieldService.validateField(tomorrow.toISOString().split('T')[0], dateField)).toEqual({
        isValid: false,
        errors: ['Date cannot be in the future']
      });
    });
  });

  describe('Field Mapping', () => {
    test('should map template fields to PDF coordinates', () => {
      const templateFields = {
        firstName: {
          pdfFieldName: 'first_name',
          type: 'text',
          coordinates: { x: 100, y: 50, width: 200, height: 20 }
        },
        lastName: {
          pdfFieldName: 'last_name',
          type: 'text',
          coordinates: { x: 320, y: 50, width: 200, height: 20 }
        }
      };

      const formData = {
        firstName: 'John',
        lastName: 'Doe'
      };

      const result = fieldService.mapFieldsToPdf(formData, templateFields);

      expect(result).toEqual([
        {
          pdfFieldName: 'first_name',
          value: 'John',
          coordinates: { x: 100, y: 50, width: 200, height: 20 },
          type: 'text'
        },
        {
          pdfFieldName: 'last_name',
          value: 'Doe',
          coordinates: { x: 320, y: 50, width: 200, height: 20 },
          type: 'text'
        }
      ]);
    });

    test('should handle missing field values gracefully', () => {
      const templateFields = {
        firstName: {
          pdfFieldName: 'first_name',
          type: 'text',
          coordinates: { x: 100, y: 50, width: 200, height: 20 }
        }
      };

      const formData = {};

      const result = fieldService.mapFieldsToPdf(formData, templateFields);

      expect(result).toEqual([
        {
          pdfFieldName: 'first_name',
          value: '',
          coordinates: { x: 100, y: 50, width: 200, height: 20 },
          type: 'text'
        }
      ]);
    });
  });

  describe('Field Transformation', () => {
    test('should format currency values correctly', () => {
      expect(fieldService.formatCurrency('50000')).toBe('$50,000.00');
      expect(fieldService.formatCurrency('1234.56')).toBe('$1,234.56');
      expect(fieldService.formatCurrency('')).toBe('');
    });

    test('should format phone numbers correctly', () => {
      expect(fieldService.formatPhoneNumber('5551234567')).toBe('(555) 123-4567');
      expect(fieldService.formatPhoneNumber('555-123-4567')).toBe('(555) 123-4567');
      expect(fieldService.formatPhoneNumber('')).toBe('');
    });

    test('should format dates correctly', () => {
      expect(fieldService.formatDate('2024-01-15')).toBe('01/15/2024');
      expect(fieldService.formatDate('')).toBe('');
    });
  });

  describe('Field Dependencies', () => {
    test('should handle conditional field visibility', () => {
      const fields = {
        employmentStatus: {
          type: 'select',
          options: ['Employed', 'Self-employed', 'Unemployed']
        },
        employer: {
          type: 'text',
          dependsOn: 'employmentStatus',
          showWhen: ['Employed']
        }
      };

      expect(fieldService.shouldShowField('employer', { employmentStatus: 'Employed' }, fields)).toBe(true);
      expect(fieldService.shouldShowField('employer', { employmentStatus: 'Unemployed' }, fields)).toBe(false);
    });

    test('should validate dependent fields only when visible', () => {
      const fields = {
        employmentStatus: {
          type: 'select',
          options: ['Employed', 'Unemployed']
        },
        employer: {
          type: 'text',
          required: true,
          dependsOn: 'employmentStatus',
          showWhen: ['Employed']
        }
      };

      const formData = {
        employmentStatus: 'Unemployed',
        employer: '' // Empty but should not be validated since field is hidden
      };

      const result = fieldService.validateAllFields(formData, fields);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Field Auto-completion', () => {
    test('should suggest field values based on history', async () => {
      const mockHistory = ['John Doe', 'Jane Smith', 'Bob Johnson'];
      fieldService.getFieldHistory = jest.fn().mockResolvedValue(mockHistory);

      const suggestions = await fieldService.getFieldSuggestions('firstName', 'Jo');
      
      expect(suggestions).toEqual(['John Doe']);
      expect(fieldService.getFieldHistory).toHaveBeenCalledWith('firstName');
    });

    test('should limit suggestion count', async () => {
      const mockHistory = Array.from({ length: 20 }, (_, i) => `User ${i}`);
      fieldService.getFieldHistory = jest.fn().mockResolvedValue(mockHistory);

      const suggestions = await fieldService.getFieldSuggestions('firstName', '', 5);
      
      expect(suggestions).toHaveLength(5);
    });
  });
});