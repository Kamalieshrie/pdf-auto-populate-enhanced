
import { describe, test, expect, beforeEach } from '@jest/globals';
import { ValidationService } from '../../services/validation-service.js';

describe('ValidationService', () => {
  let validationService;
  
  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('Basic Field Validation', () => {
    test('should validate required fields', () => {
      const rule = { required: true };
      
      expect(validationService.validateField('', rule)).toEqual({
        isValid: false,
        errors: ['This field is required']
      });
      
      expect(validationService.validateField('value', rule)).toEqual({
        isValid: true,
        errors: []
      });
      
      expect(validationService.validateField(null, rule)).toEqual({
        isValid: false,
        errors: ['This field is required']
      });
      
      expect(validationService.validateField(undefined, rule)).toEqual({
        isValid: false,
        errors: ['This field is required']
      });
    });

    test('should validate minimum length', () => {
      const rule = { minLength: 5 };
      
      expect(validationService.validateField('test', rule)).toEqual({
        isValid: false,
        errors: ['Must be at least 5 characters']
      });
      
      expect(validationService.validateField('testing', rule)).toEqual({
        isValid: true,
        errors: []
      });
    });

    test('should validate maximum length', () => {
      const rule = { maxLength: 10 };
      
      expect(validationService.validateField('this is too long', rule)).toEqual({
        isValid: false,
        errors: ['Must be no more than 10 characters']
      });
      
      expect(validationService.validateField('short', rule)).toEqual({
        isValid: true,
        errors: []
      });
    });

    test('should validate patterns using regex', () => {
      const emailRule = { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' };
      
      expect(validationService.validateField('invalid-email', emailRule)).toEqual({
        isValid: false,
        errors: ['Invalid format']
      });
      
      expect(validationService.validateField('valid@email.com', emailRule)).toEqual({
        isValid: true,
        errors: []
      });
    });

    test('should validate numeric ranges', () => {
      const rule = { min: 0, max: 100 };
      
      expect(validationService.validateField(-5, rule)).toEqual({
        isValid: false,
        errors: ['Value must be greater than or equal to 0']
      });
      
      expect(validationService.validateField(150, rule)).toEqual({
        isValid: false,
        errors: ['Value must be less than or equal to 100']
      });
      
      expect(validationService.validateField(50, rule)).toEqual({
        isValid: true,
        errors: []
      });
    });
  });

  describe('Email Validation', () => {
    test('should validate email formats correctly', () => {
      const validEmails = [
        'user@example.com',
        'test.user+tag@example.co.uk',
        'user123@subdomain.example.org',
        'firstname-lastname@example.com'
      ];

      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user.example.com',
        'user @example.com',
        'user@example',
        ''
      ];

      validEmails.forEach(email => {
        expect(validationService.validateEmail(email)).toEqual({
          isValid: true,
          errors: []
        });
      });

      invalidEmails.forEach(email => {
        const result = validationService.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Phone Number Validation', () => {
    test('should validate US phone number formats', () => {
      const validPhones = [
        '(555) 123-4567',
        '555-123-4567',
        '555.123.4567',
        '5551234567',
        '+1 555 123 4567',
        '1-555-123-4567'
      ];

      const invalidPhones = [
        '123',
        'not-a-phone',
        '555-123-456',
        '555-123-45678',
        '(555) 123-456'
      ];

      validPhones.forEach(phone => {
        expect(validationService.validatePhoneNumber(phone)).toEqual({
          isValid: true,
          errors: []
        });
      });

      invalidPhones.forEach(phone => {
        const result = validationService.validatePhoneNumber(phone);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Date Validation', () => {
    test('should validate date ranges', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Test maxDate: today
      expect(validationService.validateDate(
        yesterday.toISOString().split('T')[0], 
        { maxDate: 'today' }
      )).toEqual({
        isValid: true,
        errors: []
      });

      expect(validationService.validateDate(
        tomorrow.toISOString().split('T')[0], 
        { maxDate: 'today' }
      )).toEqual({
        isValid: false,
        errors: ['Date cannot be in the future']
      });

      // Test minDate: today
      expect(validationService.validateDate(
        tomorrow.toISOString().split('T')[0], 
        { minDate: 'today' }
      )).toEqual({
        isValid: true,
        errors: []
      });

      expect(validationService.validateDate(
        yesterday.toISOString().split('T')[0], 
        { minDate: 'today' }
      )).toEqual({
        isValid: false,
        errors: ['Date cannot be in the past']
      });
    });

    test('should validate date formats', () => {
      const validDates = [
        '2024-01-15',
        '2024-12-31',
        '2023-02-28'
      ];

      const invalidDates = [
        'invalid-date',
        '2024-13-01',
        '2024-01-32',
        '24-01-15',
        ''
      ];

      validDates.forEach(date => {
        expect(validationService.validateDate(date)).toEqual({
          isValid: true,
          errors: []
        });
      });

      invalidDates.forEach(date => {
        const result = validationService.validateDate(date);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Currency Validation', () => {
    test('should validate currency amounts', () => {
      const validAmounts = [
        '100',
        '1000.50',
        '0',
        '999999.99'
      ];

      const invalidAmounts = [
        'not-a-number',
        '$100',
        '100.123',
        '-50'
      ];

      validAmounts.forEach(amount => {
        expect(validationService.validateCurrency(amount)).toEqual({
          isValid: true,
          errors: []
        });
      });

      invalidAmounts.forEach(amount => {
        const result = validationService.validateCurrency(amount);
        expect(result.isValid).toBe(false);
      });
    });

    test('should validate currency ranges', () => {
      const rule = { min: 100, max: 50000 };

      expect(validationService.validateCurrency('50', rule)).toEqual({
        isValid: false,
        errors: ['Amount must be at least $100.00']
      });

      expect(validationService.validateCurrency('75000', rule)).toEqual({
        isValid: false,
        errors: ['Amount must be no more than $50,000.00']
      });

      expect(validationService.validateCurrency('25000', rule)).toEqual({
        isValid: true,
        errors: []
      });
    });
  });

  describe('Complex Form Validation', () => {
    test('should validate entire forms with multiple fields', () => {
      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        salary: '75000',
        startDate: '2024-01-15'
      };

      const formRules = {
        firstName: { required: true, minLength: 2 },
        lastName: { required: true, minLength: 2 },
        email: { required: true, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
        phone: { required: true, pattern: '^[\\d\\s\\-\\(\\)\\+]+$' },
        salary: { required: true, min: 0, max: 200000 },
        startDate: { required: true, minDate: 'today' }
      };

      const result = validationService.validateForm(formData, formRules);

      expect(result.isValid).toBe(true);
      expect(result.fieldErrors).toEqual({});
    });

    test('should collect all validation errors for invalid forms', () => {
      const formData = {
        firstName: '',
        lastName: 'D',
        email: 'invalid-email',
        phone: '123',
        salary: '-1000',
        startDate: '2023-01-01'
      };

      const formRules = {
        firstName: { required: true },
        lastName: { required: true, minLength: 2 },
        email: { required: true, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
        phone: { required: true, minLength: 10 },
        salary: { required: true, min: 0 },
        startDate: { required: true, minDate: 'today' }
      };

      const result = validationService.validateForm(formData, formRules);

      expect(result.isValid).toBe(false);
      expect(Object.keys(result.fieldErrors)).toEqual([
        'firstName', 'lastName', 'email', 'phone', 'salary', 'startDate'
      ]);
    });
  });

  describe('Custom Validation Rules', () => {
    test('should support custom validation functions', () => {
      const customRule = {
        custom: (value) => {
          if (value === 'forbidden') {
            return { isValid: false, message: 'This value is not allowed' };
          }
          return { isValid: true };
        }
      };

      expect(validationService.validateField('allowed', customRule)).toEqual({
        isValid: true,
        errors: []
      });

      expect(validationService.validateField('forbidden', customRule)).toEqual({
        isValid: false,
        errors: ['This value is not allowed']
      });
    });

    test('should support async custom validation', async () => {
      const asyncRule = {
        asyncCustom: async (value) => {
          // Simulate API check
          await new Promise(resolve => setTimeout(resolve, 10));
          if (value === 'taken@example.com') {
            return { isValid: false, message: 'Email already exists' };
          }
          return { isValid: true };
        }
      };

      const result1 = await validationService.validateFieldAsync('new@example.com', asyncRule);
      expect(result1).toEqual({
        isValid: true,
        errors: []
      });

      const result2 = await validationService.validateFieldAsync('taken@example.com', asyncRule);
      expect(result2).toEqual({
        isValid: false,
        errors: ['Email already exists']
      });
    });
  });

  describe('Conditional Validation', () => {
    test('should validate fields based on conditions', () => {
      const formData = {
        hasSpouse: true,
        spouseName: ''
      };

      const rules = {
        spouseName: {
          required: (data) => data.hasSpouse,
          minLength: 2
        }
      };

      const result = validationService.validateForm(formData, rules);
      
      expect(result.isValid).toBe(false);
      expect(result.fieldErrors.spouseName).toContain('This field is required');
    });

    test('should skip validation when condition is not met', () => {
      const formData = {
        hasSpouse: false,
        spouseName: ''
      };

      const rules = {
        spouseName: {
          required: (data) => data.hasSpouse,
          minLength: 2
        }
      };

      const result = validationService.validateForm(formData, rules);
      
      expect(result.isValid).toBe(true);
      expect(result.fieldErrors.spouseName).toBeUndefined();
    });
  });
});