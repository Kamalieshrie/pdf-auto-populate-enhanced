import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Trash2, Copy, Settings, Plus, Minus } from 'lucide-react';
import { FieldInstance } from './PdfCanvas';
import { toast } from '@/hooks/use-toast';

interface PropertyPanelProps {
  selectedField: FieldInstance | null;
  onFieldUpdate: (id: string, updates: Partial<FieldInstance>) => void;
  onFieldDelete: (id: string) => void;
  onFieldDuplicate: (field: FieldInstance) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedField,
  onFieldUpdate,
  onFieldDelete,
  onFieldDuplicate
}) => {
  const [localProperties, setLocalProperties] = useState<any>({});

  useEffect(() => {
    if (selectedField) {
      setLocalProperties({
        ...selectedField.properties,
        x: selectedField.x,
        y: selectedField.y,
        width: selectedField.width,
        height: selectedField.height
      });
    }
  }, [selectedField]);

  const handlePropertyChange = (key: string, value: any) => {
    setLocalProperties((prev: any) => ({
      ...prev,
      [key]: value
    }));

    if (!selectedField) return;

    if (['x', 'y', 'width', 'height'].includes(key)) {
      onFieldUpdate(selectedField.id, { [key]: value });
    } else {
      onFieldUpdate(selectedField.id, {
        properties: {
          ...selectedField.properties,
          [key]: value
        }
      });
    }
  };

  const handleOptionsChange = (options: string[]) => {
    setLocalProperties((prev: any) => ({
      ...prev,
      options
    }));

    if (!selectedField) return;

    onFieldUpdate(selectedField.id, {
      properties: {
        ...selectedField.properties,
        options
      }
    });
  };

  const addOption = () => {
    const currentOptions = localProperties.options || [];
    handleOptionsChange([...currentOptions, `Option ${currentOptions.length + 1}`]);
  };

  const removeOption = (index: number) => {
    const currentOptions = localProperties.options || [];
    handleOptionsChange(currentOptions.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const currentOptions = [...(localProperties.options || [])];
    currentOptions[index] = value;
    handleOptionsChange(currentOptions);
  };

  const handleDelete = () => {
    if (!selectedField) return;
    onFieldDelete(selectedField.id);
    toast({
      title: "Field Deleted",
      description: "The selected field has been removed."
    });
  };

  const handleDuplicate = () => {
    if (!selectedField) return;
    onFieldDuplicate(selectedField);
    toast({
      title: "Field Duplicated",
      description: "A copy of the field has been created."
    });
  };

  if (!selectedField) {
    return (
      <Card className="w-80 h-full shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Properties
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium mb-2">No Field Selected</p>
            <p className="text-sm">Select a field to edit its properties</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80 h-full shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Properties
          </CardTitle>
          <Badge variant="secondary" className="font-medium">
            {selectedField.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 overflow-auto max-h-[calc(100vh-200px)]">
        {/* Basic Properties */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-primary">Basic Settings</h3>
          
          <div className="space-y-2">
            <Label htmlFor="field-label">Label</Label>
            <Input
              id="field-label"
              value={localProperties.label || ''}
              onChange={(e) => handlePropertyChange('label', e.target.value)}
              placeholder="Field label"
            />
          </div>

          {selectedField.type !== 'checkbox' && selectedField.type !== 'radio' && (
            <div className="space-y-2">
              <Label htmlFor="field-placeholder">Placeholder</Label>
              <Input
                id="field-placeholder"
                value={localProperties.placeholder || ''}
                onChange={(e) => handlePropertyChange('placeholder', e.target.value)}
                placeholder="Placeholder text"
              />
            </div>
          )}

          {selectedField.type === 'textarea' && (
            <div className="space-y-2">
              <Label htmlFor="field-value">Default Value</Label>
              <Textarea
                id="field-value"
                value={localProperties.value || ''}
                onChange={(e) => handlePropertyChange('value', e.target.value)}
                placeholder="Default value"
                rows={3}
              />
            </div>
          )}

          {selectedField.type !== 'textarea' && selectedField.type !== 'signature' && selectedField.type !== 'image' && (
            <div className="space-y-2">
              <Label htmlFor="field-value">Default Value</Label>
              <Input
                id="field-value"
                value={localProperties.value || ''}
                onChange={(e) => handlePropertyChange('value', e.target.value)}
                placeholder="Default value"
              />
            </div>
          )}

          {(selectedField.type === 'radio' || selectedField.type === 'select') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button size="sm" variant="outline" onClick={addOption}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {(localProperties.options || []).map((option: string, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeOption(index)}
                      className="p-1 h-8 w-8"
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {(!localProperties.options || localProperties.options.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No options added yet
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Position & Size */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-primary">Position & Size</h3>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="field-x">X Position</Label>
              <Input
                id="field-x"
                type="number"
                value={localProperties.x || 0}
                onChange={(e) => handlePropertyChange('x', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="field-y">Y Position</Label>
              <Input
                id="field-y"
                type="number"
                value={localProperties.y || 0}
                onChange={(e) => handlePropertyChange('y', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="field-width">Width</Label>
              <Input
                id="field-width"
                type="number"
                value={localProperties.width || 0}
                onChange={(e) => handlePropertyChange('width', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="field-height">Height</Label>
              <Input
                id="field-height"
                type="number"
                value={localProperties.height || 0}
                onChange={(e) => handlePropertyChange('height', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Validation */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-primary">Validation</h3>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="field-required">Required Field</Label>
            <Switch
              id="field-required"
              checked={localProperties.required || false}
              onCheckedChange={(checked) => handlePropertyChange('required', checked)}
            />
          </div>

          {selectedField.type === 'text' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="field-minlength">Minimum Length</Label>
                <Input
                  id="field-minlength"
                  type="number"
                  value={localProperties.minLength || ''}
                  onChange={(e) => handlePropertyChange('minLength', parseInt(e.target.value) || undefined)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-maxlength">Maximum Length</Label>
                <Input
                  id="field-maxlength"
                  type="number"
                  value={localProperties.maxLength || ''}
                  onChange={(e) => handlePropertyChange('maxLength', parseInt(e.target.value) || undefined)}
                  placeholder="No limit"
                />
              </div>
            </>
          )}

          {selectedField.type === 'number' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="field-min">Minimum Value</Label>
                <Input
                  id="field-min"
                  type="number"
                  value={localProperties.min || ''}
                  onChange={(e) => handlePropertyChange('min', parseFloat(e.target.value) || undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-max">Maximum Value</Label>
                <Input
                  id="field-max"
                  type="number"
                  value={localProperties.max || ''}
                  onChange={(e) => handlePropertyChange('max', parseFloat(e.target.value) || undefined)}
                />
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-primary">Actions</h3>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              className="flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Field Info */}
        <div className="pt-4 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>ID:</strong> <code className="text-xs">{selectedField.id}</code></p>
            <p><strong>Type:</strong> {selectedField.type}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PropertyPanel;