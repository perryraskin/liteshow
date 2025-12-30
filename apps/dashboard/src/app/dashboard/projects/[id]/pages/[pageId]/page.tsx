'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, FileText, Loader2 } from 'lucide-react';
import HeroBlockEditor from '@/components/block-editors/HeroBlockEditor';
import FeaturesBlockEditor from '@/components/block-editors/FeaturesBlockEditor';
import TestimonialsBlockEditor from '@/components/block-editors/TestimonialsBlockEditor';
import MarkdownBlockEditor from '@/components/block-editors/MarkdownBlockEditor';
import CtaBlockEditor from '@/components/block-editors/CtaBlockEditor';
import FaqBlockEditor from '@/components/block-editors/FaqBlockEditor';
import { VersionHistory } from '@/components/VersionHistory';

interface Block {
  id: string;
  type: string;
  content: any;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface Page {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  hasUnpublishedChanges: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  createdAt: string;
  updatedAt: string;
  blocks: Block[];
}

export default function PageEditorPage() {
  const router = useRouter();
  const params = useParams();
  const [page, setPage] = useState<Page | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSavingBlock, setIsSavingBlock] = useState(false);
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [selectedBlockType, setSelectedBlockType] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);

  useEffect(() => {
    fetchPage();
  }, [params.id, params.pageId]);

  const fetchPage = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${params.id}/pages/${params.pageId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch page');
      }

      const data = await response.json();
      setPage(data);
    } catch (error) {
      console.error('Error fetching page:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${params.id}/pages/${params.pageId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update page status');
      }

      const updatedPage = await response.json();
      setPage({ ...page!, ...updatedPage });
    } catch (error) {
      console.error('Error updating page:', error);
      alert('Failed to update page status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('Are you sure you want to delete this block?')) {
      return;
    }

    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${params.id}/pages/${params.pageId}/blocks/${blockId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete block');
      }

      // Refresh page
      fetchPage();
    } catch (error) {
      console.error('Error deleting block:', error);
      alert('Failed to delete block');
    }
  };

  const handleSaveBlock = async (content: any) => {
    setIsSavingBlock(true);
    try {
      const token = localStorage.getItem('session_token');

      // Determine if we're editing or creating
      const isEditing = editingBlock !== null;
      const url = isEditing
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${params.id}/pages/${params.pageId}/blocks/${editingBlock.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${params.id}/pages/${params.pageId}/blocks`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: selectedBlockType,
          content,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} block`);
      }

      // Reset state and refresh
      setShowAddBlockModal(false);
      setSelectedBlockType(null);
      setEditingBlock(null);
      fetchPage();
    } catch (error) {
      console.error(`Error ${editingBlock ? 'updating' : 'creating'} block:`, error);
      alert(`Failed to ${editingBlock ? 'update' : 'create'} block`);
    } finally {
      setIsSavingBlock(false);
    }
  };

  const handleEditBlock = (block: Block) => {
    // Handle both old (double-encoded) and new (properly encoded) data
    let parsedContent = block.content;

    // If content is a string, it's old double-encoded data
    if (typeof block.content === 'string') {
      try {
        parsedContent = JSON.parse(block.content);
      } catch (e) {
        console.error('Failed to parse block content:', e);
        parsedContent = {};
      }
    }

    setEditingBlock({
      ...block,
      content: parsedContent
    });
    setSelectedBlockType(block.type);
    setShowAddBlockModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="h-9 w-32 bg-muted rounded-full animate-pulse"></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-5 w-16 bg-muted rounded-full animate-pulse"></div>
                <div className="h-9 w-24 bg-muted rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="h-9 w-64 bg-muted rounded mb-2 animate-pulse"></div>
            <div className="h-4 w-32 bg-muted rounded animate-pulse"></div>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div className="h-7 w-40 bg-muted rounded animate-pulse"></div>
              <div className="h-9 w-28 bg-muted rounded-full animate-pulse"></div>
            </div>

            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="h-5 w-20 bg-muted rounded-full"></div>
                      <div className="h-8 w-16 bg-muted rounded-full"></div>
                    </div>
                    <div className="h-32 bg-muted rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Page not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                onClick={() => router.push(`/dashboard/projects/${params.id}/pages`)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Pages
              </Button>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Badge variant={page.status === 'published' ? 'default' : 'secondary'} className="hidden sm:inline-flex">
                {page.status}
              </Badge>
              {page.hasUnpublishedChanges && (
                <Badge variant="outline" className="hidden sm:inline-flex border-yellow-500 text-yellow-600 dark:text-yellow-400">
                  Unpublished Changes
                </Badge>
              )}
              <VersionHistory
                projectId={params.id as string}
                pageId={params.pageId as string}
                currentPageStatus={{
                  status: page.status,
                  hasUnpublishedChanges: page.hasUnpublishedChanges
                }}
                onRestore={fetchPage}
              />
              <Button
                onClick={() => {
                  // If published with unpublished changes, re-publish to trigger sync
                  // Otherwise, toggle status
                  if (page.status === 'published' && page.hasUnpublishedChanges) {
                    handleUpdateStatus('published');
                  } else {
                    handleUpdateStatus(page.status === 'published' ? 'draft' : 'published');
                  }
                }}
                disabled={isUpdatingStatus}
                size="sm"
                variant={page.hasUnpublishedChanges && page.status === 'published' ? 'default' : undefined}
              >
                {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span className="hidden sm:inline">
                  {page.status === 'published'
                    ? (page.hasUnpublishedChanges ? 'Publish Changes' : 'Unpublish')
                    : 'Publish'}
                </span>
                <span className="sm:hidden">
                  {page.status === 'published' ? 'Draft' : 'Publish'}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{page.title}</h1>
          <p className="text-muted-foreground">/{page.slug}</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Content Blocks</h2>
            <Button onClick={() => {
              setEditingBlock(null);
              setSelectedBlockType(null);
              setShowAddBlockModal(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Block
            </Button>
          </div>

          {page.blocks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">No blocks yet</CardTitle>
                <CardDescription className="mb-6 text-center">
                  Add your first content block to start building this page.
                </CardDescription>
                <Button onClick={() => {
                  setEditingBlock(null);
                  setSelectedBlockType(null);
                  setShowAddBlockModal(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Block
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {page.blocks.map((block) => (
                <Card key={block.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant="secondary">{block.type}</Badge>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditBlock(block)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteBlock(block.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">
                      {JSON.stringify(block.content, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Add Block Modal */}
        {showAddBlockModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              {!selectedBlockType ? (
                <>
                  <CardHeader>
                    <CardTitle>Select Block Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                      {[
                        { type: 'hero', label: 'Hero', description: 'Large banner with headline and CTA' },
                        { type: 'features', label: 'Features', description: 'Grid of feature highlights' },
                        { type: 'testimonials', label: 'Testimonials', description: 'Customer reviews and quotes' },
                        { type: 'markdown', label: 'Markdown', description: 'Rich text content' },
                        { type: 'cta', label: 'Call to Action', description: 'Prominent action button' },
                        { type: 'faq', label: 'FAQ', description: 'Frequently asked questions' },
                      ].map((blockType) => (
                        <Card
                          key={blockType.type}
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() => setSelectedBlockType(blockType.type)}
                        >
                          <CardContent className="p-6">
                            <h3 className="font-semibold mb-2">{blockType.label}</h3>
                            <p className="text-sm text-muted-foreground">{blockType.description}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddBlockModal(false);
                        setSelectedBlockType(null);
                        setEditingBlock(null);
                      }}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </CardContent>
                </>
              ) : (
                <>
                  <CardHeader>
                    <CardTitle>
                      {editingBlock ? 'Edit' : 'Add'} {selectedBlockType.charAt(0).toUpperCase() + selectedBlockType.slice(1)} Block
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                  {selectedBlockType === 'hero' && (
                    <HeroBlockEditor
                      initialContent={editingBlock?.type === 'hero' ? editingBlock.content : undefined}
                      onSave={handleSaveBlock}
                      onCancel={() => {
                        setShowAddBlockModal(false);
                        setSelectedBlockType(null);
                        setEditingBlock(null);
                      }}
                      isSaving={isSavingBlock}
                    />
                  )}
                  {selectedBlockType === 'features' && (
                    <FeaturesBlockEditor
                      initialContent={editingBlock?.type === 'features' ? editingBlock.content : undefined}
                      onSave={handleSaveBlock}
                      onCancel={() => {
                        setShowAddBlockModal(false);
                        setSelectedBlockType(null);
                        setEditingBlock(null);
                      }}
                      isSaving={isSavingBlock}
                    />
                  )}
                  {selectedBlockType === 'testimonials' && (
                    <TestimonialsBlockEditor
                      initialContent={editingBlock?.type === 'testimonials' ? editingBlock.content : undefined}
                      onSave={handleSaveBlock}
                      onCancel={() => {
                        setShowAddBlockModal(false);
                        setSelectedBlockType(null);
                        setEditingBlock(null);
                      }}
                      isSaving={isSavingBlock}
                    />
                  )}
                  {selectedBlockType === 'markdown' && (
                    <MarkdownBlockEditor
                      initialContent={editingBlock?.type === 'markdown' ? editingBlock.content : undefined}
                      onSave={handleSaveBlock}
                      onCancel={() => {
                        setShowAddBlockModal(false);
                        setSelectedBlockType(null);
                        setEditingBlock(null);
                      }}
                      isSaving={isSavingBlock}
                    />
                  )}
                  {selectedBlockType === 'cta' && (
                    <CtaBlockEditor
                      initialContent={editingBlock?.type === 'cta' ? editingBlock.content : undefined}
                      onSave={handleSaveBlock}
                      onCancel={() => {
                        setShowAddBlockModal(false);
                        setSelectedBlockType(null);
                        setEditingBlock(null);
                      }}
                      isSaving={isSavingBlock}
                    />
                  )}
                  {selectedBlockType === 'faq' && (
                    <FaqBlockEditor
                      initialContent={editingBlock?.type === 'faq' ? editingBlock.content : undefined}
                      onSave={handleSaveBlock}
                      onCancel={() => {
                        setShowAddBlockModal(false);
                        setSelectedBlockType(null);
                        setEditingBlock(null);
                      }}
                      isSaving={isSavingBlock}
                    />
                  )}
                  </CardContent>
                </>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
