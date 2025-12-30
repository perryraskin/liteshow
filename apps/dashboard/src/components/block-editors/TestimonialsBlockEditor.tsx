import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface Testimonial {
  quote: string;
  author: string;
  role?: string;
  avatarUrl?: string;
}

interface TestimonialsBlockContent {
  title?: string;
  testimonials: Testimonial[];
}

interface Props {
  initialContent?: TestimonialsBlockContent;
  onSave: (content: TestimonialsBlockContent) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function TestimonialsBlockEditor({ initialContent, onSave, onCancel, isSaving = false }: Props) {
  const [content, setContent] = useState<TestimonialsBlockContent>({
    title: initialContent?.title || '',
    testimonials: initialContent?.testimonials && Array.isArray(initialContent.testimonials) && initialContent.testimonials.length > 0
      ? initialContent.testimonials
      : [{ quote: '', author: '', role: '', avatarUrl: '' }],
  });

  const addTestimonial = () => {
    setContent({
      ...content,
      testimonials: [...content.testimonials, { quote: '', author: '', role: '', avatarUrl: '' }],
    });
  };

  const removeTestimonial = (index: number) => {
    setContent({
      ...content,
      testimonials: content.testimonials.filter((_, i) => i !== index),
    });
  };

  const updateTestimonial = (index: number, field: keyof Testimonial, value: string) => {
    const updated = [...content.testimonials];
    updated[index] = { ...updated[index], [field]: value };
    setContent({ ...content, testimonials: updated });
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
          <Label>Testimonials</Label>
          <Button
            type="button"
            onClick={addTestimonial}
            variant="ghost"
            size="sm"
          >
            + Add Testimonial
          </Button>
        </div>

        <div className="space-y-4">
          {content.testimonials.map((testimonial, index) => (
            <div key={index} className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium">Testimonial {index + 1}</span>
                {content.testimonials.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeTestimonial(index)}
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
                  <Textarea
                    id={`testimonial-quote-${index}`}
                    placeholder="Quote *"
                    value={testimonial.quote}
                    onChange={(e) => updateTestimonial(index, 'quote', e.target.value)}
                    rows={3}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id={`testimonial-author-${index}`}
                    type="text"
                    placeholder="Author Name *"
                    value={testimonial.author}
                    onChange={(e) => updateTestimonial(index, 'author', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id={`testimonial-role-${index}`}
                    type="text"
                    placeholder="Role/Title"
                    value={testimonial.role}
                    onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id={`testimonial-avatar-${index}`}
                    type="url"
                    placeholder="Avatar URL"
                    value={testimonial.avatarUrl}
                    onChange={(e) => updateTestimonial(index, 'avatarUrl', e.target.value)}
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
