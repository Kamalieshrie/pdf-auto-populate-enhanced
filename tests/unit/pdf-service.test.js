import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { PDFService } from '../../services/pdf-service.js';
import fs from 'fs/promises';
import path from 'path';

// Mock external dependencies
jest.mock('pdf-lib');
jest.mock('fs/promises');

describe('PDFService', () => {
  let pdfService;
  let mockPDFDocument;
  let mockPDFForm;
  
  beforeEach(() => {
    pdfService = new PDFService();
    
    // Mock PDF-lib
    mockPDFForm = {
      getTextField: jest.fn(),
      getCheckBox: jest.fn(),
      getDropdown: jest.fn(),
      getSignature: jest.fn(),
      flatten: jest.fn()
    };
    
    mockPDFDocument = {
      getForm: jest.fn().mockReturnValue(mockPDFForm),
      save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      getPages: jest.fn().mockReturnValue([
        { getWidth: () => 612, getHeight: () => 792 }
      ])
    };
    
    // Mock fs promises
    fs.readFile = jest.fn();
    fs.writeFile = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PDF Loading', () => {
    test('should load PDF template successfully', async () => {
      const mockPdfBuffer = new Uint8Array([1, 2, 3, 4]);
      fs.readFile.mockResolvedValue(mockPdfBuffer);
      
      const { PDFDocument } = require('pdf-lib');
      PDFDocument.load = jest.fn().mockResolvedValue(mockPDFDocument);

      const result = await pdfService.loadTemplate('test-template.pdf');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'templates', 'test-template.pdf')
      );
      expect(PDFDocument.load).toHaveBeenCalledWith(mockPdfBuffer);
      expect(result).toBe(mockPDFDocument);
    });

    test('should handle PDF loading errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(pdfService.loadTemplate('nonexistent.pdf'))
        .rejects.toThrow('Failed to load PDF template: File not found');
    });
  });

  describe('Field Population', () => {
    test('should populate text fields correctly', async () => {
      const mockTextField = {
        setText: jest.fn(),
        setFontSize: jest.fn(),
        setAlignment: jest.fn()
      };
      
      mockPDFForm.getTextField.mockReturnValue(mockTextField);

      const fieldData = [
        {
          pdfFieldName: 'first_name',
          value: 'John',
          type: 'text',
          coordinates: { x: 100, y: 50, width: 200, height: 20 }
        }
      ];

      await pdfService.populateFields(mockPDFDocument, fieldData);

      expect(mockPDFForm.getTextField).toHaveBeenCalledWith('first_name');
      expect(mockTextField.setText).toHaveBeenCalledWith('John');
    });

    test('should populate checkbox fields correctly', async () => {
      const mockCheckBox = {
        check: jest.fn(),
        uncheck: jest.fn()
      };
      
      mockPDFForm.getCheckBox.mockReturnValue(mockCheckBox);

      const fieldData = [
        {
          pdfFieldName: 'terms_accepted',
          value: true,
          type: 'checkbox'
        }
      ];

      await pdfService.populateFields(mockPDFDocument, fieldData);

      expect(mockPDFForm.getCheckBox).toHaveBeenCalledWith('terms_accepted');
      expect(mockCheckBox.check).toHaveBeenCalled();
    });

    test('should populate dropdown fields correctly', async () => {
      const mockDropdown = {
        select: jest.fn(),
        getOptions: jest.fn().mockReturnValue(['Option1', 'Option2'])
      };
      
      mockPDFForm.getDropdown.mockReturnValue(mockDropdown);

      const fieldData = [
        {
          pdfFieldName: 'state',
          value: 'California',
          type: 'select'
        }
      ];

      await pdfService.populateFields(mockPDFDocument, fieldData);

      expect(mockPDFForm.getDropdown).toHaveBeenCalledWith('state');
      expect(mockDropdown.select).toHaveBeenCalledWith('California');
    });

    test('should handle missing PDF fields gracefully', async () => {
      mockPDFForm.getTextField.mockImplementation(() => {
        throw new Error('Field not found');
      });

      const fieldData = [
        {
          pdfFieldName: 'nonexistent_field',
          value: 'test',
          type: 'text'
        }
      ];

      // Should not throw an error
      await expect(pdfService.populateFields(mockPDFDocument, fieldData))
        .resolves.not.toThrow();
    });
  });

  describe('Signature Handling', () => {
    test('should add signature images to PDF', async () => {
      const mockPage = {
        drawImage: jest.fn(),
        getWidth: jest.fn().mockReturnValue(612),
        getHeight: jest.fn().mockReturnValue(792)
      };
      
      mockPDFDocument.getPages.mockReturnValue([mockPage]);
      mockPDFDocument.embedPng = jest.fn().mockResolvedValue('mockImageObj');

      const signatureData = {
        pdfFieldName: 'signature',
        value: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
        type: 'signature',
        coordinates: { x: 100, y: 50, width: 200, height: 50 }
      };

      await pdfService.addSignature(mockPDFDocument, signatureData);

      expect(mockPDFDocument.embedPng).toHaveBeenCalled();
      expect(mockPage.drawImage).toHaveBeenCalledWith('mockImageObj', {
        x: 100,
        y: 742, // 792 - 50 (converted coordinate system)
        width: 200,
        height: 50
      });
    });

    test('should handle invalid signature data', async () => {
      const signatureData = {
        pdfFieldName: 'signature',
        value: 'invalid-data',
        type: 'signature',
        coordinates: { x: 100, y: 50, width: 200, height: 50 }
      };

      await expect(pdfService.addSignature(mockPDFDocument, signatureData))
        .rejects.toThrow('Invalid signature data format');
    });
  });

  describe('PDF Generation', () => {
    test('should generate populated PDF successfully', async () => {
      const templatePath = 'lease-agreement.pdf';
      const fieldData = [
        {
          pdfFieldName: 'tenant_name',
          value: 'John Doe',
          type: 'text'
        }
      ];
      const outputPath = 'output/completed-lease.pdf';

      // Mock loadTemplate
      pdfService.loadTemplate = jest.fn().mockResolvedValue(mockPDFDocument);
      pdfService.populateFields = jest.fn().mockResolvedValue();

      const result = await pdfService.generatePDF(templatePath, fieldData, outputPath);

      expect(pdfService.loadTemplate).toHaveBeenCalledWith(templatePath);
      expect(pdfService.populateFields).toHaveBeenCalledWith(mockPDFDocument, fieldData);
      expect(mockPDFDocument.save).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(outputPath, expect.any(Uint8Array));
      expect(result).toEqual({
        success: true,
        outputPath: outputPath,
        fileSize: 3
      });
    });

    test('should handle PDF generation errors', async () => {
      pdfService.loadTemplate = jest.fn().mockRejectedValue(new Error('Template error'));

      const result = await pdfService.generatePDF('invalid.pdf', [], 'output.pdf');

      expect(result).toEqual({
        success: false,
        error: 'Template error'
      });
    });
  });

  describe('PDF Merging', () => {
    test('should merge multiple PDFs successfully', async () => {
      const { PDFDocument } = require('pdf-lib');
      const mockTargetDoc = {
        copyPages: jest.fn().mockResolvedValue(['page1', 'page2']),
        addPage: jest.fn(),
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5]))
      };
      
      const mockSourceDoc = {
        getPages: jest.fn().mockReturnValue(['sourcePage1', 'sourcePage2'])
      };

      PDFDocument.create = jest.fn().mockResolvedValue(mockTargetDoc);
      PDFDocument.load = jest.fn().mockResolvedValue(mockSourceDoc);
      
      fs.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const pdfPaths = ['doc1.pdf', 'doc2.pdf'];
      const outputPath = 'merged.pdf';

      const result = await pdfService.mergePDFs(pdfPaths, outputPath);

      expect(PDFDocument.create).toHaveBeenCalled();
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(mockTargetDoc.copyPages).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledWith(outputPath, expect.any(Uint8Array));
      expect(result).toEqual({
        success: true,
        outputPath: outputPath,
        pageCount: 4,
        fileSize: 5
      });
    });
  });

  describe('PDF Validation', () => {
    test('should validate PDF structure', async () => {
      const mockForm = {
        getFields: jest.fn().mockReturnValue([
          { getName: () => 'field1' },
          { getName: () => 'field2' }
        ])
      };
      
      mockPDFDocument.getForm.mockReturnValue(mockForm);

      const result = await pdfService.validatePDFStructure(mockPDFDocument);

      expect(result).toEqual({
        isValid: true,
        fieldCount: 2,
        fieldNames: ['field1', 'field2'],
        hasForm: true
      });
    });

    test('should detect PDFs without forms', async () => {
      mockPDFDocument.getForm.mockImplementation(() => {
        throw new Error('No form found');
      });

      const result = await pdfService.validatePDFStructure(mockPDFDocument);

      expect(result).toEqual({
        isValid: false,
        fieldCount: 0,
        fieldNames: [],
        hasForm: false,
        error: 'No form found'
      });
    });
  });

  describe('Coordinate Conversion', () => {
    test('should convert web coordinates to PDF coordinates', () => {
      const webCoords = { x: 100, y: 50, width: 200, height: 30 };
      const pageHeight = 792;

      const pdfCoords = pdfService.convertToPDFCoordinates(webCoords, pageHeight);

      expect(pdfCoords).toEqual({
        x: 100,
        y: 762, // 792 - 50 + 30
        width: 200,
        height: 30
      });
    });
  });
});
