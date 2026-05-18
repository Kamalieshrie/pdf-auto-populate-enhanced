import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';

describe('User Workflow E2E Tests', () => {
  let browser;
  let context;
  let page;
  const baseURL = process.env.TEST_URL || 'http://localhost:3000';

  beforeAll(async () => {
    // Launch browser for testing
    browser = await chromium.launch({
      headless: process.env.CI === 'true', // Run headless in CI
      slowMo: 100 // Add delay for better visibility in non-headless mode
    });
    
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: process.env.CI ? undefined : {
        dir: 'tests/videos/',
        size: { width: 1280, height: 720 }
      }
    });
    
    page = await context.newPage();
    
    // Set up request/response logging
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  describe('Template Management Workflow', () => {
    test('should navigate through template management interface', async () => {
      // Navigate to application
      await page.goto(baseURL);
      
      // Verify main page loads
      await expect(page.locator('h1')).toContainText('PDF Template Manager');
      
      // Check that template tabs are visible
      await expect(page.locator('[role="tab"]')).toHaveCount(3);
      
      // Navigate to Property Management tab
      await page.click('[role="tab"]:has-text("Property Management")');
      
      // Verify template cards are displayed
      const templateCards = page.locator('[data-testid="template-card"]');
      await expect(templateCards).toHaveCount.toBeGreaterThan(0);
      
      // Check for lease agreement template
      const leaseTemplate = page.locator('[data-testid="template-card"]:has-text("Lease Agreement")');
      await expect(leaseTemplate).toBeVisible();
    });

    test('should create new custom template', async () => {
      await page.goto(baseURL);
      
      // Click new template button
      await page.click('button:has-text("New Template")');
      
      // Fill template creation form
      await page.fill('[data-testid="template-name"]', 'E2E Test Template');
      await page.fill('[data-testid="template-description"]', 'Created during E2E testing');
      await page.selectOption('[data-testid="template-category"]', 'test');
      
      // Add fields to template
      await page.click('[data-testid="add-field-button"]');
      await page.fill('[data-testid="field-name"]', 'testField');
      await page.selectOption('[data-testid="field-type"]', 'text');
      await page.check('[data-testid="field-required"]');
      
      // Set field coordinates
      await page.fill('[data-testid="field-x"]', '100');
      await page.fill('[data-testid="field-y"]', '50');
      await page.fill('[data-testid="field-width"]', '200');
      await page.fill('[data-testid="field-height"]', '20');
      
      // Save template
      await page.click('button:has-text("Save Template")');
      
      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Template created successfully');
    });

    test('should preview template structure', async () => {
      await page.goto(baseURL);
      
      // Navigate to Custom Templates tab
      await page.click('[role="tab"]:has-text("Custom Templates")');
      
      // Click preview on first template
      await page.click('[data-testid="template-card"]:first-child button:has-text("Preview")');
      
      // Verify preview modal opens
      await expect(page.locator('[data-testid="template-preview-modal"]')).toBeVisible();
      
      // Check that template details are shown
      await expect(page.locator('[data-testid="template-fields-list"]')).toBeVisible();
      
      // Close preview
      await page.click('[data-testid="close-preview"]');
      await expect(page.locator('[data-testid="template-preview-modal"]')).not.toBeVisible();
    });
  });

  describe('PDF Form Filling Workflow', () => {
    test('should complete lease agreement form', async () => {
      await page.goto(baseURL);
      
      // Select lease agreement template
      await page.click('[role="tab"]:has-text("Property Management")');
      const leaseTemplate = page.locator('[data-testid="template-card"]:has-text("Lease Agreement")');
      await leaseTemplate.locator('button:has-text("Use")').click();
      
      // Verify form opens
      await expect(page.locator('[data-testid="pdf-form"]')).toBeVisible();
      
      // Fill landlord information
      await page.fill('[data-testid="field-landlordName"]', 'ABC Property Management');
      await page.fill('[data-testid="field-landlordPhone"]', '(555) 987-6543');
      
      // Fill tenant information
      await page.fill('[data-testid="field-tenantName"]', 'John and Jane Doe');
      await page.fill('[data-testid="field-tenantEmail"]', 'john.doe@example.com');
      
      // Fill property details
      await page.fill('[data-testid="field-propertyAddress"]', '123 Main Street\\nAnytown, CA 12345');
      await page.selectOption('[data-testid="field-propertyType"]', 'House');
      await page.fill('[data-testid="field-bedrooms"]', '3');
      await page.fill('[data-testid="field-bathrooms"]', '2');
      
      // Fill lease terms
      await page.fill('[data-testid="field-leaseStartDate"]', '2024-02-01');
      await page.fill('[data-testid="field-leaseEndDate"]', '2025-01-31');
      await page.fill('[data-testid="field-monthlyRent"]', '2500');
      await page.fill('[data-testid="field-securityDeposit"]', '2500');
      
      // Add signatures
      await page.click('[data-testid="landlord-signature-pad"]');
      // Simulate signature drawing
      await page.mouse.move(100, 100);
      await page.mouse.down();
      await page.mouse.move(200, 120);
      await page.mouse.move(150, 140);
      await page.mouse.up();
      
      await page.click('[data-testid="tenant-signature-pad"]');
      // Simulate tenant signature
      await page.mouse.move(100, 100);
      await page.mouse.down();
      await page.mouse.move(180, 115);
      await page.mouse.move(160, 130);
      await page.mouse.up();
      
      // Generate PDF
      await page.click('button:has-text("Generate PDF")');
      
      // Verify success and download
      await expect(page.locator('[data-testid="generation-success"]')).toBeVisible();
      
      // Check download button appears
      const downloadButton = page.locator('button:has-text("Download PDF")');
      await expect(downloadButton).toBeVisible();
    });

    test('should validate required fields before submission', async () => {
      await page.goto(baseURL);
      
      // Select property inspection template
      await page.click('[role="tab"]:has-text("Property Management")');
      const inspectionTemplate = page.locator('[data-testid="template-card"]:has-text("Property Inspection")');
      await inspectionTemplate.locator('button:has-text("Use")').click();
      
      // Try to submit without filling required fields
      await page.click('button:has-text("Generate PDF")');
      
      // Verify validation errors appear
      await expect(page.locator('[data-testid="validation-error"]')).toHaveCount.toBeGreaterThan(0);
      
      // Check specific field errors
      await expect(page.locator('[data-testid="field-inspectionDate-error"]')).toContainText('required');
      await expect(page.locator('[data-testid="field-inspectorName-error"]')).toContainText('required');
      
      // Fill required fields and verify errors clear
      await page.fill('[data-testid="field-inspectionDate"]', '2024-01-15');
      await page.fill('[data-testid="field-inspectorName"]', 'John Inspector');
      await page.selectOption('[data-testid="field-inspectionType"]', 'Annual');
      
      // Errors should disappear
      await expect(page.locator('[data-testid="field-inspectionDate-error"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="field-inspectorName-error"]')).not.toBeVisible();
    });
  });

  describe('Field Auto-completion and Suggestions', () => {
    test('should provide field suggestions based on history', async () => {
      await page.goto(baseURL);
      
      // Select a template with common fields
      await page.click('[role="tab"]:has-text("Custom Templates")');
      const employmentTemplate = page.locator('[data-testid="template-card"]:has-text("Employment")');
      await employmentTemplate.locator('button:has-text("Use")').click();
      
      // Start typing in name field
      await page.fill('[data-testid="field-employeeName"]', 'Jo');
      
      // Wait for suggestions to appear
      await expect(page.locator('[data-testid="field-suggestions"]')).toBeVisible();
      
      // Check that suggestions contain relevant matches
      const suggestions = page.locator('[data-testid="suggestion-item"]');
      await expect(suggestions).toHaveCount.toBeGreaterThan(0);
      
      // Click on a suggestion
      await suggestions.first().click();
      
      // Verify field is populated
      const fieldValue = await page.inputValue('[data-testid="field-employeeName"]');
      expect(fieldValue).toMatch(/^Jo/);
    });

    test('should remember and suggest previously used values', async () => {
      await page.goto(baseURL);
      
      // Fill a form completely
      await page.click('[role="tab"]:has-text("Custom Templates")');
      const eventTemplate = page.locator('[data-testid="template-card"]:has-text("Event Registration")');
      await eventTemplate.locator('button:has-text("Use")').click();
      
      // Fill unique test data
      const testEmail = `test-${Date.now()}@example.com`;
      await page.fill('[data-testid="field-email"]', testEmail);
      await page.fill('[data-testid="field-firstName"]', 'TestUser');
      await page.fill('[data-testid="field-lastName"]', 'AutoComplete');
      
      // Submit form
      await page.click('button:has-text("Generate PDF")');
      await expect(page.locator('[data-testid="generation-success"]')).toBeVisible();
      
      // Start a new form with same template
      await page.click('button:has-text("New Form")');
      
      // Start typing the same email
      await page.fill('[data-testid="field-email"]', testEmail.substring(0, 10));
      
      // Verify suggestion appears
      await expect(page.locator('[data-testid="field-suggestions"]')).toBeVisible();
      const emailSuggestion = page.locator(`[data-testid="suggestion-item"]:has-text("${testEmail}")`);
      await expect(emailSuggestion).toBeVisible();
    });
  });

  describe('PDF Preview and Editing Workflow', () => {
    test('should preview PDF with field overlays', async () => {
      await page.goto(baseURL);
      
      // Select template and fill some fields
      await page.click('[role="tab"]:has-text("Property Management")');
      const maintenanceTemplate = page.locator('[data-testid="template-card"]:has-text("Maintenance Request")');
      await maintenanceTemplate.locator('button:has-text("Use")').click();
      
      // Fill basic information
      await page.fill('[data-testid="field-requestDate"]', '2024-01-15');
      await page.selectOption('[data-testid="field-priority"]', 'Normal');
      await page.selectOption('[data-testid="field-category"]', 'Plumbing');
      await page.fill('[data-testid="field-problemDescription"]', 'Kitchen faucet is leaking');
      
      // Open PDF preview
      await page.click('button:has-text("Preview PDF")');
      
      // Verify preview modal opens
      await expect(page.locator('[data-testid="pdf-preview-modal"]')).toBeVisible();
      
      // Check that PDF canvas is displayed
      await expect(page.locator('[data-testid="pdf-canvas"]')).toBeVisible();
      
      // Verify field overlays are shown
      const fieldOverlays = page.locator('[data-testid="field-overlay"]');
      await expect(fieldOverlays).toHaveCount.toBeGreaterThan(0);
      
      // Check that filled fields show values
      const requestDateOverlay = page.locator('[data-testid="field-overlay"][data-field="requestDate"]');
      await expect(requestDateOverlay).toContainText('2024-01-15');
    });

    test('should allow field repositioning in preview mode', async () => {
      await page.goto(baseURL);
      
      // Navigate to template editor or preview mode
      await page.click('[role="tab"]:has-text("Custom Templates")');
      const template = page.locator('[data-testid="template-card"]').first();
      await template.locator('button:has-text("Edit")').click();
      
      // Open field editor
      await expect(page.locator('[data-testid="template-editor"]')).toBeVisible();
      
      // Select a field overlay
      const fieldOverlay = page.locator('[data-testid="field-overlay"]').first();
      await fieldOverlay.click();
      
      // Verify field is selected
      await expect(fieldOverlay).toHaveClass(/selected/);
      
      // Drag field to new position
      const fieldBounds = await fieldOverlay.boundingBox();
      await page.mouse.move(fieldBounds.x + fieldBounds.width/2, fieldBounds.y + fieldBounds.height/2);
      await page.mouse.down();
      await page.mouse.move(fieldBounds.x + 50, fieldBounds.y + 30);
      await page.mouse.up();
      
      // Verify field coordinates updated
      const newBounds = await fieldOverlay.boundingBox();
      expect(newBounds.x).not.toBe(fieldBounds.x);
      expect(newBounds.y).not.toBe(fieldBounds.y);
      
      // Save changes
      await page.click('button:has-text("Save Changes")');
      await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    });
  });

  describe('Batch Processing Workflow', () => {
    test('should process multiple forms with CSV data', async () => {
      await page.goto(baseURL);
      
      // Navigate to batch processing section
      await page.click('button:has-text("Batch Process")');
      
      // Select template for batch processing
      await page.selectOption('[data-testid="batch-template-select"]', 'employment-verification');
      
      // Upload CSV data file
      const csvContent = `name,employeeId,department,position
John Doe,EMP001,IT,Developer
Jane Smith,EMP002,HR,Manager
Bob Johnson,EMP003,Finance,Analyst`;
      
      // Create temporary CSV file
      const csvPath = path.join(process.cwd(), 'temp-batch-data.csv');
      await fs.writeFile(csvPath, csvContent);
      
      // Upload file
      await page.setInputFiles('[data-testid="csv-upload"]', csvPath);
      
      // Verify data preview
      await expect(page.locator('[data-testid="data-preview"]')).toBeVisible();
      const previewRows = page.locator('[data-testid="preview-row"]');
      await expect(previewRows).toHaveCount(3);
      
      // Map CSV columns to template fields
      await page.selectOption('[data-testid="field-mapping-name"]', 'name');
      await page.selectOption('[data-testid="field-mapping-employeeId"]', 'employeeId');
      await page.selectOption('[data-testid="field-mapping-department"]', 'department');
      
      // Start batch processing
      await page.click('button:has-text("Process Batch")');
      
      // Verify progress indicator
      await expect(page.locator('[data-testid="batch-progress"]')).toBeVisible();
      
      // Wait for completion
      await expect(page.locator('[data-testid="batch-complete"]')).toBeVisible({ timeout: 30000 });
      
      // Verify results summary
      await expect(page.locator('[data-testid="batch-results"]')).toContainText('3 documents generated');
      
      // Clean up
      await fs.unlink(csvPath);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network errors gracefully', async () => {
      await page.goto(baseURL);
      
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      // Try to perform action that requires API call
      await page.click('[role="tab"]:has-text("Property Management")');
      const template = page.locator('[data-testid="template-card"]').first();
      await template.locator('button:has-text("Use")').click();
      
      // Verify error message appears
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="network-error"]')).toContainText('connection');
      
      // Verify retry mechanism
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
      
      // Restore network and retry
      await page.unroute('**/api/**');
      await page.click('button:has-text("Retry")');
      
      // Verify normal operation resumes
      await expect(page.locator('[data-testid="pdf-form"]')).toBeVisible();
    });

    test('should recover from browser refresh during form filling', async () => {
      await page.goto(baseURL);
      
      // Start filling a form
      await page.click('[role="tab"]:has-text("Custom Templates")');
      const template = page.locator('[data-testid="template-card"]').first();
      await template.locator('button:has-text("Use")').click();
      
      // Fill some fields
      await page.fill('[data-testid="field-firstName"]', 'Test');
      await page.fill('[data-testid="field-lastName"]', 'User');
      await page.fill('[data-testid="field-email"]', 'test@example.com');
      
      // Refresh page
      await page.reload();
      
      // Check if draft recovery is offered
      const recoveryBanner = page.locator('[data-testid="draft-recovery"]');
      if (await recoveryBanner.isVisible()) {
        await page.click('button:has-text("Restore Draft")');
        
        // Verify form data is restored
        await expect(page.inputValue('[data-testid="field-firstName"]')).resolves.toBe('Test');
        await expect(page.inputValue('[data-testid="field-lastName"]')).resolves.toBe('User');
        await expect(page.inputValue('[data-testid="field-email"]')).resolves.toBe('test@example.com');
      }
    });
  });

  describe('Accessibility and Usability', () => {
    test('should be navigable via keyboard', async () => {
      await page.goto(baseURL);
      
      // Tab through main navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveText('New Template');
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('role', 'tab');
      
      // Use arrow keys to navigate tabs
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('[role="tab"][aria-selected="true"]')).toContainText('Custom Templates');
      
      // Enter to activate focused elements
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Enter');
      await expect(page.locator('[role="tabpanel"]')).toBeVisible();
    });

    test('should provide proper ARIA labels and descriptions', async () => {
      await page.goto(baseURL);
      
      // Check main landmarks
      await expect(page.locator('[role="main"]')).toBeVisible();
      await expect(page.locator('[role="navigation"]')).toBeVisible();
      
      // Check form accessibility
      await page.click('[role="tab"]:has-text("Property Management")');
      const template = page.locator('[data-testid="template-card"]').first();
      await template.locator('button:has-text("Use")').click();
      
      // Verify form fields have proper labels
      const formFields = page.locator('input, select, textarea');
      const fieldCount = await formFields.count();
      
      for (let i = 0; i < fieldCount; i++) {
        const field = formFields.nth(i);
        const hasLabel = await field.getAttribute('aria-label') || 
                        await field.getAttribute('aria-labelledby') ||
                        await page.locator(`label[for="${await field.getAttribute('id')}"]`).count() > 0;
        expect(hasLabel).toBeTruthy();
      }
      
      // Check required field indicators
      const requiredFields = page.locator('[required]');
      const requiredCount = await requiredFields.count();
      
      for (let i = 0; i < requiredCount; i++) {
        const field = requiredFields.nth(i);
        const hasRequiredIndicator = await field.getAttribute('aria-required') === 'true' ||
                                   await page.locator(`[aria-describedby*="required"]`).count() > 0;
        expect(hasRequiredIndicator).toBeTruthy();
      }
    });
  });
});