import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Share,
  Copy,
  Edit,
  Trash2,
  FileText,
  Star,
  Clock,
  User,
  Tag,
  Grid,
  List
} from 'lucide-react';
import { FieldInstance } from './PdfCanvas';
import { toast } from '@/hooks/use-toast';

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  fields: FieldInstance[];
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  author: string;
  isPublic: boolean;
  isFavorite: boolean;
  downloadCount: number;
}

interface TemplateManagerProps {
  templates: Template[];
  onTemplateLoad: (template: Template) => void;
  onTemplateSave: (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onTemplateDelete: (templateId: string) => void;
  onTemplateUpdate: (templateId: string, updates: Partial<Template>) => void;
  currentFields: FieldInstance[];
  currentTemplateName?: string;
}

const categories = [
  'All',
  'Forms',
  'Contracts',
  'Reports',
  'Invoices',
  'Applications',
  'Certificates',
  'Other'
];

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  templates,
  onTemplateLoad,
  onTemplateSave,
  onTemplateDelete,
  onTemplateUpdate,
  currentFields,
  currentTemplateName = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'popularity'>('date');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // New template form state
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'Forms',
    tags: '',
    isPublic: false
  });

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'date':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'popularity':
        return b.downloadCount - a.downloadCount;
      default:
        return 0;
    }
  });

  const handleTemplateLoad = (template: Template) => {
    onTemplateLoad(template);
    toast({
      title: "Template Loaded",
      description: `"${template.name}" has been loaded successfully.`
    });
  };

  const handleTemplateSave = () => {
    if (!newTemplate.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a template name.",
        variant: "destructive"
      });
      return;
    }

    if (currentFields.length === 0) {
      toast({
        title: "Error",
        description: "Cannot save template with no fields.",
        variant: "destructive"
      });
      return;
    }

    const template = {
      name: newTemplate.name.trim(),
      description: newTemplate.description.trim(),
      thumbnail: generateThumbnail(currentFields),
      fields: currentFields,
      category: newTemplate.category,
      tags: newTemplate.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      author: 'Current User', // Would come from auth context
      isPublic: newTemplate.isPublic,
      isFavorite: false,
      downloadCount: 0
    };

    onTemplateSave(template);
    setIsCreateDialogOpen(false);
    setNewTemplate({
      name: '',
      description: '',
      category: 'Forms',
      tags: '',
      isPublic: false
    });

    toast({
      title: "Template Saved",
      description: `"${template.name}" has been saved to your templates.`
    });
  };

  const handleTemplateDelete = (template: Template) => {
    onTemplateDelete(template.id);
    toast({
      title: "Template Deleted",
      description: `"${template.name}" has been deleted.`
    });
  };

  const handleTemplateDuplicate = (template: Template) => {
    const duplicatedTemplate = {
      ...template,
      name: `${template.name} (Copy)`,
      isPublic: false,
      isFavorite: false,
      downloadCount: 0
    };
    delete (duplicatedTemplate as any).id;
    delete (duplicatedTemplate as any).createdAt;
    delete (duplicatedTemplate as any).updatedAt;
    
    onTemplateSave(duplicatedTemplate);
    toast({
      title: "Template Duplicated",
      description: `"${template.name}" has been duplicated.`
    });
  };

  const toggleFavorite = (template: Template) => {
    onTemplateUpdate(template.id, { isFavorite: !template.isFavorite });
  };

  const generateThumbnail = (fields: FieldInstance[]): string => {
    // Generate a simple SVG thumbnail showing field positions
    const svg = `
      <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="150" fill="#f8f9fa" stroke="#e9ecef" stroke-width="2" rx="8"/>
        ${fields.slice(0, 10).map((field, index) => {
          const x = (field.x / 600) * 180 + 10;
          const y = (field.y / 800) * 130 + 10;
          const width = Math.min((field.width / 600) * 180, 50);
          const height = Math.min((field.height / 800) * 130, 20);
          
          return `<rect x="${x}" y="${y}" width="${width}" height="${height}" 
                    fill="hsl(217, 91%, 60%, 0.1)" stroke="hsl(217, 91%, 60%)" stroke-width="1" rx="2"/>`;
        }).join('')}
        <text x="10" y="140" font-family="Arial" font-size="10" fill="#666">
          ${fields.length} fields
        </text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  const exportTemplate = (template: Template) => {
    const exportData = {
      name: template.name,
      description: template.description,
      fields: template.fields,
      category: template.category,
      tags: template.tags,
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Template Exported",
      description: "Template has been downloaded as JSON file."
    });
  };

  const importTemplate = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      toast({
        title: "Error",
        description: "Please select a JSON file.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        if (!importData.name || !importData.fields) {
          throw new Error('Invalid template format');
        }

        const template = {
          name: `${importData.name} (Imported)`,
          description: importData.description || '',
          thumbnail: generateThumbnail(importData.fields),
          fields: importData.fields,
          category: importData.category || 'Forms',
          tags: importData.tags || [],
          author: 'Imported',
          isPublic: false,
          isFavorite: false,
          downloadCount: 0
        };

        onTemplateSave(template);
        toast({
          title: "Template Imported",
          description: `"${template.name}" has been imported successfully.`
        });
      } catch (error) {
        toast({
          title: "Import Error",
          description: "Failed to import template. Please check the file format.",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [onTemplateSave]);

  const TemplateCard: React.FC<{ template: Template }> = ({ template }) => (
    <Card className="relative group hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
      {template.isFavorite && (
        <Star className="absolute top-2 right-2 w-4 h-4 fill-yellow-400 text-yellow-400 z-10" />
      )}
      
      <CardHeader className="pb-3">
        <div className="aspect-[4/3] bg-muted rounded-md mb-3 overflow-hidden">
          <img 
            src={template.thumbnail} 
            alt={template.name}
            className="w-full h-full object-cover"
          />
        </div>
        <CardTitle className="text-sm font-medium truncate">{template.name}</CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="w-3 h-3" />
          <span>{template.author}</span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {template.description}
        </p>
        
        <div className="flex flex-wrap gap-1 mb-3">
          <Badge variant="secondary" className="text-xs">{template.category}</Badge>
          <Badge variant="outline" className="text-xs">{template.fields.length} fields</Badge>
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            <span>{template.downloadCount}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => handleTemplateLoad(template)}>
            Load Template
          </Button>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className="flex-1 p-1"
              onClick={() => toggleFavorite(template)}
            >
              <Star className={`w-3 h-3 ${template.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="flex-1 p-1"
              onClick={() => handleTemplateDuplicate(template)}
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="flex-1 p-1"
              onClick={() => exportTemplate(template)}
            >
              <Share className="w-3 h-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="flex-1 p-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Template</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{template.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleTemplateDelete(template)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Template Manager
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <label htmlFor="import-template" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </label>
            </Button>
            <input
              id="import-template"
              type="file"
              accept=".json"
              onChange={importTemplate}
              className="hidden"
            />
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-to-r from-primary to-primary-glow">
                  <Plus className="w-4 h-4 mr-2" />
                  Save Current
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter template name..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-description">Description</Label>
                    <Textarea
                      id="template-description"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe this template..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-category">Category</Label>
                    <select
                      id="template-category"
                      value={newTemplate.category}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-md"
                    >
                      {categories.slice(1).map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="template-tags">Tags (comma separated)</Label>
                    <Input
                      id="template-tags"
                      value={newTemplate.tags}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="tag1, tag2, tag3..."
                    />
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleTemplateSave}>
                      Save Template
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
            
            <div className="ml-auto flex items-center gap-2">
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              
              <Label htmlFor="sort-by" className="text-sm">Sort:</Label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 border border-border rounded text-sm"
              >
                <option value="date">Date</option>
                <option value="name">Name</option>
                <option value="popularity">Popularity</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Content */}
      <div className="flex-1 overflow-auto p-4">
        {sortedTemplates.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-2">No templates found</p>
              <p className="text-sm">Create your first template or adjust your filters</p>
            </div>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
            : "space-y-4"
          }>
            {sortedTemplates.map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateManager;