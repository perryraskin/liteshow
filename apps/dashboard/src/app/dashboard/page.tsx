'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function DashboardContent() {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for session token in URL (from OAuth callback)
    const sessionToken = searchParams.get('session');
    if (sessionToken) {
      // Store in localStorage
      localStorage.setItem('session_token', sessionToken);
      // Remove from URL
      router.replace('/dashboard');
      return;
    }

    // Get stored session token
    const storedToken = localStorage.getItem('session_token');

    if (!storedToken) {
      router.push('/login');
      return;
    }

    // Check session via API with token
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/session`, {
      headers: {
        'Authorization': `Bearer ${storedToken}`,
      },
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setSession(data);
        } else {
          localStorage.removeItem('session_token');
          router.push('/login');
        }
      })
      .catch(() => {
        localStorage.removeItem('session_token');
        router.push('/login');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router, searchParams]);

  const handleSignOut = async () => {
    localStorage.removeItem('session_token');
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">LiteShow</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {session.user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome back! Your projects will appear here.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No projects yet. Create your first project to get started!
          </p>
          <button
            onClick={() => router.push('/dashboard/projects/new')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Project
          </button>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
