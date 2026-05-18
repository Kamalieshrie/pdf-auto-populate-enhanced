import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PDFService } from '../../services/pdf-service.js';
import { FieldService } from '../../services/field-service.js';
import { ValidationService } from '../../services/validation-service.js';
import fs from 'fs/promises';
import path from 'path';

// Mock PDF files for testing
const createMockPDF = async (filename) => {
  const mockPdfPath = path.join(process.cwd(), 'tests/fixtures', filename);
  await fs.mkdir(path.dirname(mockPdfPath), { recursive: true });
  await fs.writeFile(mockPdfPath, 'mock pdf content');
  return mockPdfPath;
};

describe('PDF Generation Integration Tests', () => {
  let pdfService;
  let fieldService;
  let validationService;
  let testFixturesDir;
  let testOutputDir;

  beforeAll(async () => {
    pdfService = new PDFService();
    fieldService = new FieldService();
    validationService = new ValidationService();
    
    testFixturesDir = path.join(process.cwd(), 'tests/fixtures');
    testOutputDir = path.join(process.cwd(), 'tests/output');
    
    // Create test directories
    await fs.mkdir(testFixturesDir, { recursive: true });
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directories
    try {
      await fs.rm(testFixturesDir, { recursive: true, force: true });
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clean output directory before each test
    try {
      const files = await fs.readdir(testOutputDir);
      await Promise.all(files.map(file => 
        fs.rm(path.join(testOutputDir, file), { force: true })
      ));
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('End-to-End PDF Population Workflow', () => {
    test('should complete full lease agreement workflow', async () => {
      // 1. Create mock template
      const templatePath = await createMockPDF('lease-agreement.pdf');
      
      // 2. Define template structure
      const templateDefinition = {
        name: 'Residential Lease Agreement',
        pdfTemplate: 'lease-agreement.pdf',
        fields: {
          landlord: {
            landlordName: {
              pdfFieldName: 'landlord_name',
              type: 'text',
              required: true,
              coordinates: { x: 120, y: 150, width: 200, height: 20 }
            },
            landlordPhone: {
              pdfFieldName: 'landlord_phone',
              type: 'tel',
              required: true,
              coordinates: { x: 450, y: 150, width: 150, height: 20 }
            }
          },
          tenant: {
            tenantName: {
              pdfFieldName: 'tenant_name',
              type: 'text',
              required: true,
              coordinates: { x: 120, y: 280, width: 200, height: 20 }
            },
            tenantEmail: {
              pdfFieldName: 'tenant_email',
              type: 'email',
              required: true,
              coordinates: { x: 450, y: 310, width: 150, height: 20 }
            }
          },
          lease: {
            monthlyRent: {
              pdfFieldName: 'monthly_rent',
              type: 'currency',
              required: true,
              coordinates: { x: 400, y: 580, width: 100, height: 20 }
            },
            leaseStartDate: {
              pdfFieldName: 'lease_start_date',
              type: 'date',
              required: true,
              coordinates: { x: 120, y: 580, width: 120, height: 20 }
            }
          }
        }
      };

      // 3. Prepare form data
      const formData = {
        landlordName: 'Property Management LLC',
        landlordPhone: '(555) 987-6543',
        tenantName: 'John and Jane Doe',
        tenantEmail: 'john.doe@email.com',
        monthlyRent: '2500',
        leaseStartDate: '2024-02-01'
      };

      // 4. Validate all fields
      const allFields = {
        ...templateDefinition.fields.landlord,
        ...templateDefinition.fields.tenant,
        ...templateDefinition.fields.lease
      };

      const validationResult = validationService.validateForm(formData, allFields);
      expect(validationResult.isValid).toBe(true);

      // 5. Map fields for PDF population
      const mappedFields = fieldService.mapFieldsToPdf(formData, allFields);
      expect(mappedFields).toHaveLength(6);

      // 6. Generate PDF
      const outputPath = path.join(testOutputDir, 'completed-lease.pdf');
      const result = await pdfService.generatePDF(templatePath, mappedFields, outputPath);

      // 7. Verify result
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      
      // Verify file was created
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('should handle property inspection workflow with conditional fields', async () => {
      const templatePath = await createMockPDF('property-inspection.pdf');
      
      const templateDefinition = {
        name: 'Property Inspection Report',
        fields: {
          inspection: {
            inspectionDate: {
              pdfFieldName: 'inspection_date',
              type: 'date',
              required: true,
              coordinates: { x: 120, y: 100, width: 120, height: 20 }
            },
            inspectionType: {
              pdfFieldName: 'inspection_type',
              type: 'select',
              required: true,
              options: ['Move-in', 'Move-out', 'Annual'],
              coordinates: { x: 480, y: 100, width: 120, height: 20 }
            }
          },
          condition: {
            overallCondition: {
              pdfFieldName: 'overall_condition',
              type: 'select',
              required: true,
              options: ['Excellent', 'Good', 'Fair', 'Poor'],
              coordinates: { x: 200, y: 520, width: 150, height: 20 }
            },
            repairNeeded: {
              pdfFieldName: 'repair_needed',
              type: 'checkbox',
              required: false,
              coordinates: { x: 400, y: 520, width: 15, height: 15 }
            },
            repairDescription: {
              pdfFieldName: 'repair_description',
              type: 'textarea',
              required: false,
              dependsOn: 'repairNeeded',
              showWhen: [true],
              coordinates: { x: 120, y: 560, width: 480, height: 80 }
            }
          }
        }
      };

      const formData = {
        inspectionDate: '2024-01-15',
        inspectionType: 'Annual',
        overallCondition: 'Good',
        repairNeeded: true,
        repairDescription: 'Kitchen faucet needs replacement. Minor wall scuffs in bedroom.'
      };

      // Validate with conditional logic
      const allFields = {
        ...templateDefinition.fields.inspection,
        ...templateDefinition.fields.condition
      };

      // Check field visibility
      const shouldShowRepairDescription = fieldService.shouldShowField(
        'repairDescription', 
        formData, 
        allFields
      );
      expect(shouldShowRepairDescription).toBe(true);

      // Validate form
      const validationResult = validationService.validateForm(formData, allFields);
      expect(validationResult.isValid).toBe(true);

      // Generate PDF
      const mappedFields = fieldService.mapFieldsToPdf(formData, allFields);
      const outputPath = path.join(testOutputDir, 'inspection-report.pdf');
      const result = await pdfService.generatePDF(templatePath, mappedFields, outputPath);

      expect(result.success).toBe(true);
    });
  });

  describe('Complex Field Type Handling', () => {
    test('should handle signature fields with image data', async () => {
      const templatePath = await createMockPDF('signature-form.pdf');
      
      const signatureData = {
        customerSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        signatureDate: '2024-01-15'
      };

      const fields = {
        customerSignature: {
          pdfFieldName: 'customer_signature',
          type: 'signature',
          required: true,
          coordinates: { x: 120, y: 610, width: 200, height: 50 }
        },
        signatureDate: {
          pdfFieldName: 'signature_date',
          type: 'date',
          required: true,
          coordinates: { x: 340, y: 630, width: 120, height: 20 }
        }
      };

      const mappedFields = fieldService.mapFieldsToPdf(signatureData, fields);
      const outputPath = path.join(testOutputDir, 'signed-document.pdf');
      
      const result = await pdfService.generatePDF(templatePath, mappedFields, outputPath);
      expect(result.success).toBe(true);
    });

    test('should format currency and numeric fields correctly', async () => {
      const templatePath = await createMockPDF('financial-form.pdf');
      
      const financialData = {
        annualIncome: '85000',
        monthlyExpenses: '3250.50',
        creditScore: '750',
        debtToIncomeRatio: '0.28'
      };

      const fields = {
        annualIncome: {
          pdfFieldName: 'annual_income',
          type: 'currency',
          required: true,
          coordinates: { x: 200, y: 200, width: 150, height: 20 }
        },
        monthlyExpenses: {
          pdfFieldName: 'monthly_expenses',
          type: 'currency',
          required: true,
          coordinates: { x: 200, y: 230, width: 150, height: 20 }
        },
        creditScore: {
          pdfFieldName: 'credit_score',
          type: 'number',
          required: true,
          coordinates: { x: 200, y: 260, width: 100, height: 20 }
        },
        debtToIncomeRatio: {
          pdfFieldName: 'debt_ratio',
          type: 'number',
          required: true,
          coordinates: { x: 200, y: 290, width: 100, height: 20 }
        }
      };

      // Test field formatting
      expect(fieldService.formatCurrency('85000')).toBe('$85,000.00');
      expect(fieldService.formatCurrency('3250.50')).toBe('$3,250.50');

      const mappedFields = fieldService.mapFieldsToPdf(financialData, fields);
      const outputPath = path.join(testOutputDir, 'financial-document.pdf');
      
      const result = await pdfService.generatePDF(templatePath, mappedFields, outputPath);
      expect(result.success).toBe(true);
    });
  });

  describe('PDF Merging and Batch Processing', () => {
    test('should merge multiple completed forms into single document', async () => {
      // Create multiple source PDFs
      const template1Path = await createMockPDF('form1.pdf');
      const template2Path = await createMockPDF('form2.pdf');
      
      const form1Data = {
        name: 'John Doe',
        date: '2024-01-15'
      };
      
      const form2Data = {
        name: 'John Doe',
        amount: '5000'
      };

      const fields1 = {
        name: {
          pdfFieldName: 'applicant_name',
          type: 'text',
          coordinates: { x: 100, y: 100, width: 200, height: 20 }
        },
        date: {
          pdfFieldName: 'application_date',
          type: 'date',
          coordinates: { x: 100, y: 130, width: 120, height: 20 }
        }
      };

      const fields2 = {
        name: {
          pdfFieldName: 'borrower_name',
          type: 'text',
          coordinates: { x: 100, y: 100, width: 200, height: 20 }
        },
        amount: {
          pdfFieldName: 'loan_amount',
          type: 'currency',
          coordinates: { x: 100, y: 130, width: 150, height: 20 }
        }
      };

      // Generate individual PDFs
      const pdf1Path = path.join(testOutputDir, 'form1-completed.pdf');
      const pdf2Path = path.join(testOutputDir, 'form2-completed.pdf');
      
      const mappedFields1 = fieldService.mapFieldsToPdf(form1Data, fields1);
      const mappedFields2 = fieldService.mapFieldsToPdf(form2Data, fields2);
      
      await pdfService.generatePDF(template1Path, mappedFields1, pdf1Path);
      await pdfService.generatePDF(template2Path, mappedFields2, pdf2Path);

      // Merge PDFs
      const mergedPath = path.join(testOutputDir, 'merged-application.pdf');
      const mergeResult = await pdfService.mergePDFs([pdf1Path, pdf2Path], mergedPath);

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.pageCount).toBe(2);
      
      // Verify merged file exists
      const fileExists = await fs.access(mergedPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('should process batch of similar forms with different data', async () => {
      const templatePath = await createMockPDF('batch-template.pdf');
      
      const batchData = [
        { name: 'John Doe', email: 'john@example.com', id: '001' },
        { name: 'Jane Smith', email: 'jane@example.com', id: '002' },
        { name: 'Bob Johnson', email: 'bob@example.com', id: '003' }
      ];

      const fields = {
        name: {
          pdfFieldName: 'participant_name',
          type: 'text',
          coordinates: { x: 100, y: 100, width: 200, height: 20 }
        },
        email: {
          pdfFieldName: 'participant_email',
          type: 'email',
          coordinates: { x: 100, y: 130, width: 250, height: 20 }
        },
        id: {
          pdfFieldName: 'participant_id',
          type: 'text',
          coordinates: { x: 400, y: 100, width: 100, height: 20 }
        }
      };

      const results = [];
      
      for (let i = 0; i < batchData.length; i++) {
        const data = batchData[i];
        const mappedFields = fieldService.mapFieldsToPdf(data, fields);
        const outputPath = path.join(testOutputDir, `batch-${data.id}.pdf`);
        
        const result = await pdfService.generatePDF(templatePath, mappedFields, outputPath);
        results.push(result);
      }

      // Verify all PDFs were generated successfully
      expect(results.every(r => r.success)).toBe(true);
      
      // Verify all files exist
      for (const data of batchData) {
        const outputPath = path.join(testOutputDir, `batch-${data.id}.pdf`);
        const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle corrupted template files gracefully', async () => {
      const corruptedPath = path.join(testFixturesDir, 'corrupted.pdf');
      await fs.writeFile(corruptedPath, 'this is not a valid pdf');

      const formData = { name: 'Test User' };
      const fields = {
        name: {
          pdfFieldName: 'user_name',
          type: 'text',
          coordinates: { x: 100, y: 100, width: 200, height: 20 }
        }
      };

      const mappedFields = fieldService.mapFieldsToPdf(formData, fields);
      const outputPath = path.join(testOutputDir, 'failed-output.pdf');

      const result = await pdfService.generatePDF(corruptedPath, mappedFields, outputPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load PDF template');
    });

    test('should handle validation errors during generation', async () => {
      const templatePath = await createMockPDF('validation-test.pdf');
      
      const invalidData = {
        name: '', // Required but empty
        email: 'invalid-email', // Invalid format
        age: -5 // Invalid range
      };

      const fields = {
        name: {
          pdfFieldName: 'user_name',
          type: 'text',
          required: true,
          coordinates: { x: 100, y: 100, width: 200, height: 20 }
        },
        email: {
          pdfFieldName: 'user_email',
          type: 'email',
          required: true,
          coordinates: { x: 100, y: 130, width: 250, height: 20 }
        },
        age: {
          pdfFieldName: 'user_age',
          type: 'number',
          required: true,
          min: 0,
          max: 120,
          coordinates: { x: 100, y: 160, width: 100, height: 20 }
        }
      };

      const validationResult = validationService.validateForm(invalidData, fields);
      expect(validationResult.isValid).toBe(false);
      expect(Object.keys(validationResult.fieldErrors)).toEqual(['name', 'email', 'age']);

      // Should not proceed with PDF generation if validation fails
      expect(validationResult.fieldErrors.name).toContain('This field is required');
      expect(validationResult.fieldErrors.email).toContain('Invalid format');
      expect(validationResult.fieldErrors.age).toContain('Value must be greater than or equal to 0');
    });
  });
});
