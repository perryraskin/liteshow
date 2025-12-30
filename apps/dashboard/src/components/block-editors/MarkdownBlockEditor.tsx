import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface MarkdownBlockContent {
  markdown: string;
}

interface Props {
  initialContent?: MarkdownBlockContent;
  onSave: (content: MarkdownBlockContent) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function MarkdownBlockEditor({ initialContent, onSave, onCancel, isSaving = false }: Props) {
  const [content, setContent] = useState<MarkdownBlockContent>(
    initialContent || {
      markdown: '',
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(content);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="markdown-content">
          Markdown Content *
          <span className="text-xs text-gray-500 ml-2">
            (Novel editor will be integrated here in the future)
          </span>
        </Label>
        <Textarea
          id="markdown-content"
          value={content.markdown}
          onChange={(e) => setContent({ ...content, markdown: e.target.value })}
          className="font-mono text-sm"
          rows={12}
          required
          placeholder="# Your markdown content here..."
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
