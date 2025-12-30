import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface Faq {
  question: string;
  answer: string;
}

interface FaqBlockContent {
  title?: string;
  faqs: Faq[];
}

interface Props {
  initialContent?: FaqBlockContent;
  onSave: (content: FaqBlockContent) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function FaqBlockEditor({ initialContent, onSave, onCancel, isSaving = false }: Props) {
  const [content, setContent] = useState<FaqBlockContent>(
    initialContent || {
      title: '',
      faqs: [{ question: '', answer: '' }],
    }
  );

  const addFaq = () => {
    setContent({
      ...content,
      faqs: [...content.faqs, { question: '', answer: '' }],
    });
  };

  const removeFaq = (index: number) => {
    setContent({
      ...content,
      faqs: content.faqs.filter((_, i) => i !== index),
    });
  };

  const updateFaq = (index: number, field: keyof Faq, value: string) => {
    const updated = [...content.faqs];
    updated[index] = { ...updated[index], [field]: value };
    setContent({ ...content, faqs: updated });
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
          <Label>FAQs</Label>
          <Button
            type="button"
            onClick={addFaq}
            variant="ghost"
            size="sm"
          >
            + Add FAQ
          </Button>
        </div>

        <div className="space-y-4">
          {content.faqs.map((faq, index) => (
            <div key={index} className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium">FAQ {index + 1}</span>
                {content.faqs.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeFaq(index)}
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
                    id={`faq-question-${index}`}
                    type="text"
                    placeholder="Question *"
                    value={faq.question}
                    onChange={(e) => updateFaq(index, 'question', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Textarea
                    id={`faq-answer-${index}`}
                    placeholder="Answer *"
                    value={faq.answer}
                    onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                    rows={3}
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
