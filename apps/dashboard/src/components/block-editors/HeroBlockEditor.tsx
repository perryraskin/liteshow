import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface HeroBlockContent {
  headline: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  backgroundImage?: string;
}

interface Props {
  initialContent?: HeroBlockContent;
  onSave: (content: HeroBlockContent) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function HeroBlockEditor({ initialContent, onSave, onCancel, isSaving = false }: Props) {
  const [content, setContent] = useState<HeroBlockContent>(
    initialContent || {
      headline: '',
      subheadline: '',
      ctaText: '',
      ctaUrl: '',
      backgroundImage: '',
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
        <Label htmlFor="ctaText">CTA Button Text</Label>
        <Input
          id="ctaText"
          type="text"
          value={content.ctaText}
          onChange={(e) => setContent({ ...content, ctaText: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ctaUrl">CTA Button URL</Label>
        <Input
          id="ctaUrl"
          type="url"
          value={content.ctaUrl}
          onChange={(e) => setContent({ ...content, ctaUrl: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="backgroundImage">Background Image URL</Label>
        <Input
          id="backgroundImage"
          type="url"
          value={content.backgroundImage}
          onChange={(e) => setContent({ ...content, backgroundImage: e.target.value })}
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
