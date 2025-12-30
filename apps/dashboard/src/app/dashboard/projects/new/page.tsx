'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NewProjectPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('session_token');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const project = await response.json();
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    setFormData({ ...formData, name, slug });
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Button variant="ghost" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
            <CardDescription>
              Set up a new website with its own content database and GitHub repository.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-destructive/15 border border-destructive/50 rounded-lg p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  placeholder="My Awesome Site"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Project Slug *</Label>
                <Input
                  id="slug"
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="my-awesome-site"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Used for GitHub repository and database names
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="A brief description of your project"
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Creating...' : 'Create Project'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>

              <div className="text-sm text-muted-foreground space-y-2 pt-4">
                <p className="font-medium">This will:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Create a new Turso database for your content</li>
                  <li>Create a GitHub repository in your account</li>
                  <li>Set up the initial project structure</li>
                </ul>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
