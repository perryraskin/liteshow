import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface CtaBlockContent {
  headline: string;
  subheadline?: string;
  buttonText: string;
  buttonUrl: string;
  backgroundColor?: string;
}

interface Props {
  initialContent?: CtaBlockContent;
  onSave: (content: CtaBlockContent) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function CtaBlockEditor({ initialContent, onSave, onCancel, isSaving = false }: Props) {
  const [content, setContent] = useState<CtaBlockContent>(
    initialContent || {
      headline: '',
      subheadline: '',
      buttonText: '',
      buttonUrl: '',
      backgroundColor: '',
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(content);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="headline">Headline *</Label>
        <Input
          id="headline"
          type="text"
          value={content.headline}
          onChange={(e) => setContent({ ...content, headline: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subheadline">Subheadline</Label>
        <Input
          id="subheadline"
          type="text"
          value={content.subheadline}
          onChange={(e) => setContent({ ...content, subheadline: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="buttonText">Button Text *</Label>
        <Input
          id="buttonText"
          type="text"
          value={content.buttonText}
          onChange={(e) => setContent({ ...content, buttonText: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="buttonUrl">Button URL *</Label>
        <Input
          id="buttonUrl"
          type="url"
          value={content.buttonUrl}
          onChange={(e) => setContent({ ...content, buttonUrl: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="backgroundColor">Background Color</Label>
        <Input
          id="backgroundColor"
          type="text"
          value={content.backgroundColor}
          onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
          placeholder="#3B82F6 or rgb(59, 130, 246)"
        />
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
