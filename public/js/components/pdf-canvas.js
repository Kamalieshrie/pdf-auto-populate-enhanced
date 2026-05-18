import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCw, Download, Upload, Grid, Move, MousePointer } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface FieldInstance {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: {
    required: boolean;
    placeholder?: string;
    value?: string;
    label?: string;
    options?: string[];
  };
  selected?: boolean;
}

interface PdfCanvasProps {
  pdfFile: File | null;
  fields: FieldInstance[];
  selectedField?: string;
  onFieldAdd: (field: FieldInstance) => void;
  onFieldUpdate: (id: string, updates: Partial<FieldInstance>) => void;
  onFieldSelect: (id: string | null) => void;
  onFieldDelete: (id: string) => void;
}

export const PdfCanvas: React.FC<PdfCanvasProps> = ({
  pdfFile,
  fields,
  selectedField,
  onFieldAdd,
  onFieldUpdate,
  onFieldSelect,
  onFieldDelete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragField, setDragField] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(false);
  const [tool, setTool] = useState<'select' | 'move'>('select');

  // PDF rendering simulation
  const loadPdf = useCallback(async (file: File) => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Simulate PDF loading with placeholder
      canvas.width = 600;
      canvas.height = 800;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add grid if enabled
      if (showGrid) {
        drawGrid(ctx, canvas.width, canvas.height);
      }
      
      ctx.strokeStyle = '#e5e5e5';
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#666666';
      ctx.font = '16px Arial';
      ctx.fillText('PDF Document', 20, 40);
      ctx.fillText(`File: ${file.name}`, 20, 70);
      
      toast({
        title: "PDF Loaded",
        description: `Successfully loaded ${file.name}`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load PDF file",
        variant: "destructive"
      });
    }
  }, [showGrid]);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    
    // Draw vertical lines
    for (let x = 0; x <= width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (pdfFile) {
      loadPdf(pdfFile);
    } else {
      // Draw empty canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = 600;
          canvas.height = 800;
          ctx.fillStyle = '#f8f9fa';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          if (showGrid) {
            drawGrid(ctx, canvas.width, canvas.height);
          }
          
          ctx.strokeStyle = '#dee2e6';
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(0, 0, canvas.width, canvas.height);
          
          ctx.fillStyle = '#6c757d';
          ctx.font = '18px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Drop PDF here or click Upload', canvas.width / 2, canvas.height / 2);
        }
      }
    }
  }, [pdfFile, loadPdf, showGrid]);

  const renderFields = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Clear existing field overlays
    const existingOverlays = container.querySelectorAll('.field-overlay');
    existingOverlays.forEach(overlay => overlay.remove());

    // Render field overlays
    fields.forEach(field => {
      const fieldElement = document.createElement('div');
      fieldElement.className = `field-overlay absolute border-2 cursor-move transition-all duration-200 ${
        field.selected || selectedField === field.id 
          ? 'border-primary bg-primary/10 shadow-md' 
          : 'border-muted-foreground/50 bg-card/50 hover:bg-primary/5'
      }`;
      fieldElement.style.left = `${field.x * zoom}px`;
      fieldElement.style.top = `${field.y * zoom}px`;
      fieldElement.style.width = `${field.width * zoom}px`;
      fieldElement.style.height = `${field.height * zoom}px`;
      fieldElement.style.zIndex = '10';
      
      // Add field type indicator
      const typeIndicator = document.createElement('span');
      typeIndicator.className = 'text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded absolute -top-6 left-0 font-medium';
      typeIndicator.textContent = field.type;
      fieldElement.appendChild(typeIndicator);

      // Add resize handles for selected field
      if (field.selected || selectedField === field.id) {
        const corners = ['nw', 'ne', 'sw', 'se'];
        corners.forEach(corner => {
          const handle = document.createElement('div');
          handle.className = `resize-handle absolute w-3 h-3 bg-primary border-2 border-background rounded-sm ${corner}`;
          handle.style.cursor = `${corner}-resize`;
          
          switch (corner) {
            case 'nw':
              handle.style.top = '-6px';
              handle.style.left = '-6px';
              break;
            case 'ne':
              handle.style.top = '-6px';
              handle.style.right = '-6px';
              break;
            case 'sw':
              handle.style.bottom = '-6px';
              handle.style.left = '-6px';
              break;
            case 'se':
              handle.style.bottom = '-6px';
              handle.style.right = '-6px';
              break;
          }
          
          fieldElement.appendChild(handle);
        });
      }

      // Add event listeners
      fieldElement.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onFieldSelect(field.id);
        
        if (tool === 'move') {
          setIsDragging(true);
          setDragField(field.id);
          
          const rect = container.getBoundingClientRect();
          setDragOffset({
            x: e.clientX - rect.left - field.x * zoom,
            y: e.clientY - rect.top - field.y * zoom
          });
        }
      });

      fieldElement.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Open field properties dialog (handled by parent)
      });

      container.appendChild(fieldElement);
    });
  }, [fields, selectedField, zoom, tool, onFieldSelect]);

  useEffect(() => {
    renderFields();
  }, [renderFields]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // Check if clicking on a field
    const clickedField = fields.find(field => 
      x >= field.x && x <= field.x + field.width &&
      y >= field.y && y <= field.y + field.height
    );

    if (clickedField) {
      onFieldSelect(clickedField.id);
    } else {
      onFieldSelect(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragField) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - dragOffset.x) / zoom;
    const y = (e.clientY - rect.top - dragOffset.y) / zoom;

    onFieldUpdate(dragField, { x: Math.max(0, x), y: Math.max(0, y) });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragField(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const fieldData = JSON.parse(e.dataTransfer.getData('application/json'));
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      const newField: FieldInstance = {
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: fieldData.type,
        x: Math.max(0, x - fieldData.defaultProperties.width / 2),
        y: Math.max(0, y - fieldData.defaultProperties.height / 2),
        width: fieldData.defaultProperties.width,
        height: fieldData.defaultProperties.height,
        properties: {
          required: fieldData.defaultProperties.required,
          placeholder: fieldData.defaultProperties.placeholder,
          label: `${fieldData.name} ${fields.length + 1}`
        }
      };

      onFieldAdd(newField);
      onFieldSelect(newField.id);
      
      toast({
        title: "Field Added",
        description: `${fieldData.name} added to PDF`
      });
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' && selectedField) {
      onFieldDelete(selectedField);
      onFieldSelect(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b bg-card/50 backdrop-blur">
        <div className="flex items-center gap-1 mr-4">
          <Button 
            variant={tool === 'select' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setTool('select')}
          >
            <MousePointer className="w-4 h-4" />
          </Button>
          <Button 
            variant={tool === 'move' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setTool('move')}
          >
            <Move className="w-4 h-4" />
          </Button>
        </div>
        
        <Button variant="outline" size="sm" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium min-w-[60px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="outline" size="sm" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        
        <div className="h-6 w-px bg-border mx-2" />
        
        <Button 
          variant={showGrid ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setShowGrid(!showGrid)}
        >
          <Grid className="w-4 h-4" />
        </Button>
        
        <Button variant="outline" size="sm">
          <RotateCw className="w-4 h-4" />
        </Button>
        
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="default" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Upload PDF
          </Button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 overflow-auto bg-gradient-to-br from-muted/30 to-muted/50">
        <div 
          ref={containerRef}
          className="relative min-h-full p-8 flex items-center justify-center"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <Card className="inline-block shadow-canvas">
            <canvas
              ref={canvasRef}
              className="block rounded-lg"
              style={{ 
                transform: `scale(${zoom})`, 
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease'
              }}
              onClick={handleCanvasClick}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PdfCanvas;