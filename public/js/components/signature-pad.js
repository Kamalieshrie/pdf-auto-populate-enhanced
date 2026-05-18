import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PenTool, 
  Eraser, 
  RotateCcw, 
  Download, 
  Upload, 
  Type, 
  Save,
  Palette,
  Square
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface SignaturePadProps {
  onSignatureSave?: (signatureData: string) => void;
  initialSignature?: string;
  width?: number;
  height?: number;
  readonly?: boolean;
}

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureSave,
  initialSignature,
  width = 400,
  height = 200,
  readonly = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [penColor, setPenColor] = useState('#000000');
  const [penSize, setPenSize] = useState(2);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [typedSignature, setTypedSignature] = useState('');
  const [fontFamily, setFontFamily] = useState('Brush Script MT');
  const [fontSize, setFontSize] = useState(32);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas defaults
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        saveToHistory();
      };
      img.src = initialSignature;
    } else {
      saveToHistory();
    }
  }, [width, height, initialSignature]);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL();
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(dataUrl);
      return newHistory.slice(-10); // Keep last 10 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 9));
  }, [historyIndex]);

  const getPointFromEvent = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
        pressure: (touch as any).force || 0.5
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        pressure: 0.5
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (readonly) return;
    
    e.preventDefault();
    setIsDrawing(true);
    const point = getPointFromEvent(e);
    setLastPoint(point);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readonly) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const currentPoint = getPointFromEvent(e);
    
    if (lastPoint) {
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = tool === 'eraser' ? '#000000' : penColor;
      ctx.lineWidth = tool === 'eraser' ? penSize * 2 : penSize;
      
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();
    }

    setLastPoint(currentPoint);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setLastPoint(null);
    saveToHistory();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const undo = () => {
    if (historyIndex > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const newIndex = historyIndex - 1;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = history[newIndex];
      setHistoryIndex(newIndex);
    }
  };

  const addTypedSignature = () => {
    if (!typedSignature.trim()) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = penColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const x = canvas.width / 2;
    const y = canvas.height / 2;
    
    ctx.fillText(typedSignature, x, y);
    saveToHistory();
    setTypedSignature('');
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    onSignatureSave?.(dataUrl);
    
    toast({
      title: "Signature Saved",
      description: "Your signature has been saved successfully."
    });
  };

  const downloadSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `signature_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const uploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Scale image to fit canvas
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        saveToHistory();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <PenTool className="w-4 h-4 mr-2" />
          Open Signature Pad
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-primary" />
            Digital Signature Pad
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="draw" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="draw">Draw Signature</TabsTrigger>
            <TabsTrigger value="type">Type Signature</TabsTrigger>
          </TabsList>
          
          <TabsContent value="draw" className="space-y-4">
            {/* Drawing Tools */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-2">
                    <Button
                      variant={tool === 'pen' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTool('pen')}
                    >
                      <PenTool className="w-4 h-4 mr-2" />
                      Pen
                    </Button>
                    <Button
                      variant={tool === 'eraser' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTool('eraser')}
                    >
                      <Eraser className="w-4 h-4 mr-2" />
                      Eraser
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    <input
                      type="color"
                      value={penColor}
                      onChange={(e) => setPenColor(e.target.value)}
                      className="w-8 h-8 border border-border rounded cursor-pointer"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pen-size">Size:</Label>
                    <Input
                      id="pen-size"
                      type="range"
                      min="1"
                      max="20"
                      value={penSize}
                      onChange={(e) => setPenSize(parseInt(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm w-6">{penSize}</span>
                  </div>
                  
                  <div className="flex gap-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex <= 0}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearCanvas}>
                      <Square className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Canvas */}
            <Card>
              <CardContent className="p-4 flex justify-center">
                <canvas
                  ref={canvasRef}
                  className="border border-border rounded cursor-crosshair touch-none shadow-md"
                  style={{ maxWidth: '100%', height: 'auto' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="type" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Typed Signature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="typed-signature">Type your signature</Label>
                    <Input
                      id="typed-signature"
                      value={typedSignature}
                      onChange={(e) => setTypedSignature(e.target.value)}
                      placeholder="Your Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="font-family">Font</Label>
                    <select
                      id="font-family"
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md"
                    >
                      <option value="Brush Script MT">Brush Script MT</option>
                      <option value="Lucida Handwriting">Lucida Handwriting</option>
                      <option value="Dancing Script">Dancing Script</option>
                      <option value="Pacifico">Pacifico</option>
                      <option value="Kaushan Script">Kaushan Script</option>
                      <option value="cursive">Cursive</option>
                      <option value="serif">Serif</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="font-size">Size:</Label>
                    <Input
                      id="font-size"
                      type="range"
                      min="16"
                      max="64"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm w-8">{fontSize}</span>
                  </div>
                  
                  <Button onClick={addTypedSignature} disabled={!typedSignature.trim()}>
                    <Type className="w-4 h-4 mr-2" />
                    Add to Canvas
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Canvas for typed signature */}
            <Card>
              <CardContent className="p-4 flex justify-center">
                <canvas
                  ref={canvasRef}
                  className="border border-border rounded shadow-md"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadSignature}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" asChild>
              <label htmlFor="upload-signature" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </label>
            </Button>
            <input
              id="upload-signature"
              type="file"
              accept="image/*"
              onChange={uploadSignature}
              className="hidden"
            />
          </div>
          
          <Button onClick={saveSignature} className="bg-gradient-to-r from-primary to-primary-glow">
            <Save className="w-4 h-4 mr-2" />
            Save Signature
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignaturePad;