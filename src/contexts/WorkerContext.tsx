import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import TermsAndPrivacyDialog from '@/components/TermsAndPrivacyDialog';

interface Worker {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  hourly_rate: number;
  is_active: boolean;
  photo_url: string | null;
  organization_id: string;
  address: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  date_started: string;
  created_at: string;
  updated_at: string;
  must_change_password: boolean;
  first_login_info_dismissed: boolean;
  pwa_install_info_dismissed: boolean;
  terms_accepted: boolean | null;
  terms_accepted_at: string | null;
  shift_start: string;
  shift_end: string;
  shift_days: number[];
  organizations?: {
    name: string;
    logo_url: string | null;
  } | null;
}

interface WorkerContextType {
  worker: Worker | null;
  loading: boolean;
  error: Error | null;
  refreshWorker: () => Promise<void>;
}

const WorkerContext = createContext<WorkerContextType | undefined>(undefined);

export const useWorker = () => {
  const context = useContext(WorkerContext);
  if (context === undefined) {
    throw new Error('useWorker must be used within a WorkerProvider');
  }
  return context;
};

interface WorkerProviderProps {
  children: ReactNode;
}

export const WorkerProvider: React.FC<WorkerProviderProps> = ({ children }) => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showTermsDialog, setShowTermsDialog] = useState(false);

  const fetchWorker = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('⚠️ No authenticated user found');
        setLoading(false);
        return;
      }

      // Try to fetch worker with organization in one query
      let { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('*, organizations!organization_id(name, logo_url)')
        .eq('email', user.email)
        .maybeSingle();

      // Fallback for PGRST201 error (embed ambiguity)
      if (workerError && (workerError.code === 'PGRST201' || workerError.message?.includes('more than one relationship'))) {
        console.warn('⚠️ PGRST201 embed error, using fallback fetch');
        
        // Fetch worker without organization
        const { data: basicWorker, error: basicError } = await supabase
          .from('workers')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();

        if (basicError || !basicWorker) {
          throw new Error('Failed to fetch worker data');
        }

        // Fetch organization separately
        const { data: org } = await supabase
          .from('organizations')
          .select('name, logo_url')
          .eq('id', basicWorker.organization_id)
          .maybeSingle();

        workerData = {
          ...basicWorker,
          organizations: org || null
        };
      } else if (workerError) {
        throw workerError;
      }

      if (!workerData) {
        console.warn('⚠️ Worker not found');
        setLoading(false);
        return;
      }

      if (!workerData.is_active) {
        console.warn('⚠️ Worker account is inactive');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      console.log('✅ Worker data loaded:', {
        name: workerData.name,
        organization: workerData.organizations?.name,
        logo_url: workerData.organizations?.logo_url
      });

      setWorker(workerData as Worker);
    } catch (err) {
      console.error('❌ Error fetching worker:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorker();
  }, []);

  // Check if worker needs to accept terms
  useEffect(() => {
    if (worker && !loading) {
      // Show terms dialog if not accepted
      if (!worker.terms_accepted) {
        console.log('📋 Worker has not accepted terms, showing dialog');
        setShowTermsDialog(true);
      }
    }
  }, [worker, loading]);

  const handleTermsAccepted = async () => {
    console.log('✅ Terms accepted, refreshing worker data');
    setShowTermsDialog(false);
    // Refresh worker data to get updated terms_accepted status
    await fetchWorker();
  };

  return (
    <WorkerContext.Provider value={{ worker, loading, error, refreshWorker: fetchWorker }}>
      {children}

      {/* Terms & Privacy Dialog - blocks app usage until accepted */}
      {worker && (
        <TermsAndPrivacyDialog
          open={showTermsDialog}
          onAccepted={handleTermsAccepted}
          workerEmail={worker.email}
        />
      )}
    </WorkerContext.Provider>
  );
};
