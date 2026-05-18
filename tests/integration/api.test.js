import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import fs from 'fs/promises';
import path from 'path';

describe('API Integration Tests', () => {
  let server;
  let testTemplateId;
  let testProjectId;

  beforeAll(async () => {
    // Start test server
    server = app.listen(0); // Use random port for testing
    
    // Create test template file
    const testTemplatePath = path.join(process.cwd(), 'public/uploads/templates/test-template.pdf');
    await fs.mkdir(path.dirname(testTemplatePath), { recursive: true });
    await fs.writeFile(testTemplatePath, 'mock pdf content');
  });

  afterAll(async () => {
    // Clean up test server and files
    if (server) {
      server.close();
    }
    
    // Clean up test files
    const uploadsDir = path.join(process.cwd(), 'public/uploads');
    try {
      await fs.rm(uploadsDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Reset database state or use test database
    // This would typically involve clearing test data
  });

  describe('Template Management API', () => {
    test('POST /api/templates - should create new template', async () => {
      const templateData = {
        name: 'Test Employment Form',
        description: 'Test template for employment verification',
        category: 'verification',
        fields: {
          employeeName: {
            type: 'text',
            required: true,
            coordinates: { x: 100, y: 50, width: 200, height: 20 }
          },
          employeeId: {
            type: 'text',
            required: true,
            coordinates: { x: 350, y: 50, width: 100, height: 20 }
          }
        }
      };

      const response = await request(app)
        .post('/api/templates')
        .send(templateData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        template: {
          name: templateData.name,
          description: templateData.description,
          category: templateData.category
        }
      });

      testTemplateId = response.body.template.id;
    });

    test('GET /api/templates - should retrieve all templates', async () => {
      const response = await request(app)
        .get('/api/templates')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        templates: expect.any(Array)
      });

      expect(response.body.templates.length).toBeGreaterThan(0);
    });

    test('GET /api/templates/:id - should retrieve specific template', async () => {
      const response = await request(app)
        .get(`/api/templates/${testTemplateId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        template: {
          id: testTemplateId,
          name: 'Test Employment Form'
        }
      });
    });

    test('PUT /api/templates/:id - should update template', async () => {
      const updateData = {
        name: 'Updated Employment Form',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/templates/${testTemplateId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        template: {
          id: testTemplateId,
          name: updateData.name,
          description: updateData.description
        }
      });
    });

    test('DELETE /api/templates/:id - should delete template', async () => {
      const response = await request(app)
        .delete(`/api/templates/${testTemplateId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Template deleted successfully'
      });

      // Verify template is actually deleted
      await request(app)
        .get(`/api/templates/${testTemplateId}`)
        .expect(404);
    });
  });

  describe('PDF Generation API', () => {
    beforeEach(async () => {
      // Create a test template for PDF generation tests
      const templateData = {
        name: 'PDF Test Template',
        description: 'Template for PDF generation testing',
        category: 'test',
        pdfTemplate: 'test-template.pdf',
        fields: {
          name: {
            pdfFieldName: 'full_name',
            type: 'text',
            required: true,
            coordinates: { x: 100, y: 50, width: 200, height: 20 }
          },
          email: {
            pdfFieldName: 'email_address',
            type: 'email',
            required: true,
            coordinates: { x: 100, y: 80, width: 250, height: 20 }
          }
        }
      };

      const response = await request(app)
        .post('/api/templates')
        .send(templateData);
      
      testTemplateId = response.body.template.id;
    });

    test('POST /api/pdf/generate - should generate PDF from template', async () => {
      const formData = {
        templateId: testTemplateId,
        data: {
          name: 'John Doe',
          email: 'john.doe@example.com'
        },
        options: {
          flatten: true,
          outputFormat: 'pdf'
        }
      };

      const response = await request(app)
        .post('/api/pdf/generate')
        .send(formData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        pdf: {
          filename: expect.stringMatching(/\.pdf$/),
          size: expect.any(Number),
          pages: expect.any(Number)
        }
      });

      // Verify PDF file was created
      const pdfPath = path.join(process.cwd(), 'public/uploads/pdfs', response.body.pdf.filename);
      const fileExists = await fs.access(pdfPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('POST /api/pdf/generate - should validate required fields', async () => {
      const formData = {
        templateId: testTemplateId,
        data: {
          name: '', // Missing required field
          email: 'john.doe@example.com'
        }
      };

      const response = await request(app)
        .post('/api/pdf/generate')
        .send(formData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        fieldErrors: {
          name: expect.arrayContaining(['This field is required'])
        }
      });
    });

    test('POST /api/pdf/merge - should merge multiple PDFs', async () => {
      // First, generate two PDFs
      const pdf1Data = {
        templateId: testTemplateId,
        data: { name: 'John Doe', email: 'john@example.com' }
      };
      
      const pdf2Data = {
        templateId: testTemplateId,
        data: { name: 'Jane Smith', email: 'jane@example.com' }
      };

      const pdf1Response = await request(app)
        .post('/api/pdf/generate')
        .send(pdf1Data);
      
      const pdf2Response = await request(app)
        .post('/api/pdf/generate')
        .send(pdf2Data);

      // Now merge them
      const mergeData = {
        pdfFiles: [
          pdf1Response.body.pdf.filename,
          pdf2Response.body.pdf.filename
        ],
        outputFilename: 'merged-document.pdf'
      };

      const response = await request(app)
        .post('/api/pdf/merge')
        .send(mergeData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        mergedPdf: {
          filename: 'merged-document.pdf',
          pageCount: 2,
          size: expect.any(Number)
        }
      });
    });
  });

  describe('File Upload API', () => {
    test('POST /api/upload/template - should upload PDF template', async () => {
      const mockPdfBuffer = Buffer.from('mock pdf content');
      
      const response = await request(app)
        .post('/api/upload/template')
        .attach('template', mockPdfBuffer, 'test-upload.pdf')
        .field('name', 'Uploaded Template')
        .field('category', 'test')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        template: {
          name: 'Uploaded Template',
          category: 'test',
          filename: expect.stringMatching(/\.pdf$/)
        }
      });
    });

    test('POST /api/upload/template - should validate file type', async () => {
      const mockTextBuffer = Buffer.from('not a pdf');
      
      const response = await request(app)
        .post('/api/upload/template')
        .attach('template', mockTextBuffer, 'invalid.txt')
        .field('name', 'Invalid File')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid file type. Only PDF files are allowed.'
      });
    });

    test('POST /api/upload/signature - should upload signature image', async () => {
      const mockImageBuffer = Buffer.from('mock image content');
      
      const response = await request(app)
        .post('/api/upload/signature')
        .attach('signature', mockImageBuffer, 'signature.png')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        signature: {
          filename: expect.stringMatching(/\.(png|jpg|jpeg)$/),
          size: expect.any(Number)
        }
      });
    });
  });

  describe('Project Management API', () => {
    test('POST /api/projects - should create new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Integration test project',
        templates: [testTemplateId]
      };

      const response = await request(app)
        .post('/api/projects')
        .send(projectData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        project: {
          name: projectData.name,
          description: projectData.description,
          templates: expect.arrayContaining([testTemplateId])
        }
      });

      testProjectId = response.body.project.id;
    });

    test('GET /api/projects/:id/status - should get project status', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/status`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        project: {
          id: testProjectId,
          status: expect.any(String),
          completedDocuments: expect.any(Number),
          totalDocuments: expect.any(Number)
        }
      });
    });
  });

  describe('Validation API', () => {
    test('POST /api/validate/field - should validate individual field', async () => {
      const fieldData = {
        value: 'john.doe@example.com',
        rules: {
          required: true,
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
        }
      };

      const response = await request(app)
        .post('/api/validate/field')
        .send(fieldData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        validation: {
          isValid: true,
          errors: []
        }
      });
    });

    test('POST /api/validate/form - should validate entire form', async () => {
      const formData = {
        data: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '555-123-4567'
        },
        rules: {
          name: { required: true, minLength: 2 },
          email: { required: true, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
          phone: { required: true, minLength: 10 }
        }
      };

      const response = await request(app)
        .post('/api/validate/form')
        .send(formData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        validation: {
          isValid: true,
          fieldErrors: {}
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Endpoint not found'
      });
    });

    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid JSON format'
      });
    });

    test('should handle missing required parameters', async () => {
      const response = await request(app)
        .post('/api/pdf/generate')
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Missing required parameters'
      });
    });
  });

  describe('Authentication & Authorization', () => {
    test('should require authentication for protected endpoints', async () => {
      const response = await request(app)
        .delete('/api/templates/any-id')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Authentication required'
      });
    });

    test('should accept valid API key', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', 'Bearer valid-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
