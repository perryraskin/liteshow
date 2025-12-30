'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, FileText, Loader2 } from 'lucide-react';

interface Page {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function PagesListPage() {
  const router = useRouter();
  const params = useParams();
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
  });

  useEffect(() => {
    fetchPages();
  }, [params.id]);

  const fetchPages = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${params.id}/pages`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch pages');
      }

      const data = await response.json();
      setPages(data);
    } catch (error) {
      console.error('Error fetching pages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    setFormData({ ...formData, title, slug });
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${params.id}/pages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to create page');
        setIsCreating(false);
        return;
      }

      const newPage = await response.json();
      setShowCreateModal(false);
      setFormData({ title: '', slug: '', description: '' });
      setIsCreating(false);
      router.push(`/dashboard/projects/${params.id}/pages/${newPage.id}`);
    } catch (error) {
      console.error('Error creating page:', error);
      alert('Failed to create page');
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Button variant="ghost" onClick={() => router.push(`/dashboard/projects/${params.id}`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Project
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Pages</h1>
            <p className="text-muted-foreground">Manage your site pages</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Page
          </Button>
        </div>

        {pages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No pages yet</CardTitle>
              <CardDescription className="mb-6 text-center">
                Create your first page to start building your site.
              </CardDescription>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Page
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pages.map((page) => (
              <Card
                key={page.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => router.push(`/dashboard/projects/${params.id}/pages/${page.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-lg">{page.title}</CardTitle>
                    <Badge variant={page.status === 'published' ? "default" : "secondary"}>
                      {page.status}
                    </Badge>
                  </div>
                  <CardDescription>/{page.slug}</CardDescription>
                </CardHeader>
                {page.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {page.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Create Page Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="max-w-2xl w-full mx-4">
              <CardHeader>
                <CardTitle>Create New Page</CardTitle>
                <CardDescription>Add a new page to your site</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePage}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Page Title</Label>
                      <Input
                        id="title"
                        type="text"
                        value={formData.title}
                        onChange={handleNameChange}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slug">URL Slug</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">/</span>
                        <Input
                          id="slug"
                          type="text"
                          value={formData.slug}
                          onChange={(e) =>
                            setFormData({ ...formData, slug: e.target.value })
                          }
                          pattern="[a-z0-9-]+"
                          required
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Lowercase letters, numbers, and hyphens only
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 mt-6">
                    <Button type="submit" disabled={isCreating} className="flex-1">
                      {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isCreating ? 'Creating...' : 'Create Page'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateModal(false);
                        setFormData({ title: '', slug: '', description: '' });
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
