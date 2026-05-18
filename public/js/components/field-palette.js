import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Type, 
  CheckSquare, 
  Circle, 
  Calendar, 
  Mail, 
  Phone, 
  Hash, 
  FileText,
  PenTool,
  Image as ImageIcon,
  ChevronDown
} from 'lucide-react';

export interface FieldType {
  id: string;
  name: string;
  icon: React.ReactNode;
  type: 'text' | 'checkbox' | 'radio' | 'date' | 'email' | 'tel' | 'number' | 'textarea' | 'signature' | 'image' | 'select';
  defaultProperties: {
    width: number;
    height: number;
    required: boolean;
    placeholder?: string;
  };
}

const fieldTypes: FieldType[] = [
  {
    id: 'text',
    name: 'Text Field',
    icon: <Type className="w-4 h-4" />,
    type: 'text',
    defaultProperties: {
      width: 200,
      height: 40,
      required: false,
      placeholder: 'Enter text...'
    }
  },
  {
    id: 'textarea',
    name: 'Text Area',
    icon: <FileText className="w-4 h-4" />,
    type: 'textarea',
    defaultProperties: {
      width: 300,
      height: 80,
      required: false,
      placeholder: 'Enter text...'
    }
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    icon: <CheckSquare className="w-4 h-4" />,
    type: 'checkbox',
    defaultProperties: {
      width: 20,
      height: 20,
      required: false
    }
  },
  {
    id: 'radio',
    name: 'Radio Button',
    icon: <Circle className="w-4 h-4" />,
    type: 'radio',
    defaultProperties: {
      width: 20,
      height: 20,
      required: false
    }
  },
  {
    id: 'select',
    name: 'Dropdown',
    icon: <ChevronDown className="w-4 h-4" />,
    type: 'select',
    defaultProperties: {
      width: 200,
      height: 40,
      required: false
    }
  },
  {
    id: 'date',
    name: 'Date Picker',
    icon: <Calendar className="w-4 h-4" />,
    type: 'date',
    defaultProperties: {
      width: 150,
      height: 40,
      required: false
    }
  },
  {
    id: 'email',
    name: 'Email Field',
    icon: <Mail className="w-4 h-4" />,
    type: 'email',
    defaultProperties: {
      width: 250,
      height: 40,
      required: false,
      placeholder: 'example@email.com'
    }
  },
  {
    id: 'tel',
    name: 'Phone Field',
    icon: <Phone className="w-4 h-4" />,
    type: 'tel',
    defaultProperties: {
      width: 200,
      height: 40,
      required: false,
      placeholder: '(123) 456-7890'
    }
  },
  {
    id: 'number',
    name: 'Number Field',
    icon: <Hash className="w-4 h-4" />,
    type: 'number',
    defaultProperties: {
      width: 150,
      height: 40,
      required: false,
      placeholder: '0'
    }
  },
  {
    id: 'signature',
    name: 'Signature',
    icon: <PenTool className="w-4 h-4" />,
    type: 'signature',
    defaultProperties: {
      width: 300,
      height: 100,
      required: false
    }
  },
  {
    id: 'image',
    name: 'Image Upload',
    icon: <ImageIcon className="w-4 h-4" />,
    type: 'image',
    defaultProperties: {
      width: 200,
      height: 150,
      required: false
    }
  }
];

interface FieldPaletteProps {
  onFieldSelect?: (fieldType: FieldType) => void;
  selectedField?: string;
}

export const FieldPalette: React.FC<FieldPaletteProps> = ({
  onFieldSelect,
  selectedField
}) => {
  const handleFieldClick = (fieldType: FieldType) => {
    onFieldSelect?.(fieldType);
  };

  const handleDragStart = (e: React.DragEvent, fieldType: FieldType) => {
    e.dataTransfer.setData('application/json', JSON.stringify(fieldType));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <Card className="w-64 h-full shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Type className="w-5 h-5 text-primary" />
          Field Palette
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
        {fieldTypes.map((fieldType) => (
          <Button
            key={fieldType.id}
            variant={selectedField === fieldType.id ? "default" : "outline"}
            className="w-full justify-start h-12 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md"
            onClick={() => handleFieldClick(fieldType)}
            draggable
            onDragStart={(e) => handleDragStart(e, fieldType)}
          >
            <div className="flex items-center gap-3">
              <div className="p-1 rounded bg-primary/10 text-primary">
                {fieldType.icon}
              </div>
              <span className="text-sm font-medium">{fieldType.name}</span>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};

export default FieldPalette;