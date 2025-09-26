import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let stabilizeTimer: NodeJS.Timeout;
    
    // Set up auth state listener with stabilization delay
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          // Clear any existing timer
          if (stabilizeTimer) {
            clearTimeout(stabilizeTimer);
          }
          
          // For sign out events, update immediately
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          
          // For sign in events, add small delay to let session stabilize
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            stabilizeTimer = setTimeout(() => {
              if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
              }
            }, 200);
          } else {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
          }
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (stabilizeTimer) {
        clearTimeout(stabilizeTimer);
      }
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      localStorage.removeItem('worker');
      window.location.href = '/login';
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return <>{children}</>;
}