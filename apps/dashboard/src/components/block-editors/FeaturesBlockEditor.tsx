import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface Feature {
  icon?: string;
  title: string;
  description: string;
}

interface FeaturesBlockContent {
  title?: string;
  features: Feature[];
}

interface Props {
  initialContent?: FeaturesBlockContent;
  onSave: (content: FeaturesBlockContent) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function FeaturesBlockEditor({ initialContent, onSave, onCancel, isSaving = false }: Props) {
  const [content, setContent] = useState<FeaturesBlockContent>(
    initialContent || {
      title: '',
      features: [{ icon: '', title: '', description: '' }],
    }
  );

  const addFeature = () => {
    setContent({
      ...content,
      features: [...content.features, { icon: '', title: '', description: '' }],
    });
  };

  const removeFeature = (index: number) => {
    setContent({
      ...content,
      features: content.features.filter((_, i) => i !== index),
    });
  };

  const updateFeature = (index: number, field: keyof Feature, value: string) => {
    const updated = [...content.features];
    updated[index] = { ...updated[index], [field]: value };
    setContent({ ...content, features: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(content);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="section-title">Section Title</Label>
        <Input
          id="section-title"
          type="text"
          value={content.title}
          onChange={(e) => setContent({ ...content, title: e.target.value })}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <Label>Features</Label>
          <Button
            type="button"
            onClick={addFeature}
            variant="ghost"
            size="sm"
          >
            + Add Feature
          </Button>
        </div>

        <div className="space-y-4">
          {content.features.map((feature, index) => (
            <div key={index} className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium">Feature {index + 1}</span>
                {content.features.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeFeature(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Input
                    id={`feature-icon-${index}`}
                    type="text"
                    placeholder="Icon (emoji or URL)"
                    value={feature.icon}
                    onChange={(e) => updateFeature(index, 'icon', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id={`feature-title-${index}`}
                    type="text"
                    placeholder="Title *"
                    value={feature.title}
                    onChange={(e) => updateFeature(index, 'title', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Textarea
                    id={`feature-description-${index}`}
                    placeholder="Description *"
                    value={feature.description}
                    onChange={(e) => updateFeature(index, 'description', e.target.value)}
                    rows={2}
                    required
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Button type="submit" disabled={isSaving} className="flex-1">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Block'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
