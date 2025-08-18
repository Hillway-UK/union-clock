import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PioneerLogo } from '@/components/PioneerLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      console.log('🔐 Attempting login for:', email);
      
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('❌ Login error:', error.message);
        setError(error.message);
        toast.error('Login failed', {
          description: error.message,
          className: 'bg-error text-error-foreground border-error'
        });
        return;
      }

      if (user) {
        console.log('✅ Authentication successful for user:', user.email);
        
        // Verify session is established
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔧 Session check:', session ? 'Active' : 'None');
        
        // Check if user exists in workers table with better error handling
        console.log('🔍 Looking up worker record...');
        const { data: worker, error: workerError } = await supabase
          .from('workers')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();
          
        if (workerError) {
          console.error('❌ Worker lookup error:', workerError.message);
          const errorMsg = `Database error: ${workerError.message}`;
          setError(errorMsg);
          toast.error('Database Error', {
            description: 'Unable to verify worker status. Please contact support.',
            className: 'bg-error text-error-foreground border-error'
          });
          await supabase.auth.signOut();
          return;
        }

        if (!worker) {
          console.warn('⚠️ No worker record found for:', user.email);
          const errorMsg = 'Worker account not found. Please contact your administrator.';
          setError(errorMsg);
          toast.error('Access Denied', {
            description: errorMsg,
            className: 'bg-error text-error-foreground border-error'
          });
          await supabase.auth.signOut();
          return;
        }

        console.log('👤 Worker found:', worker.name, 'Active:', worker.is_active);

        if (!worker.is_active) {
          const errorMsg = 'Worker account is inactive. Please contact your administrator.';
          setError(errorMsg);
          toast.error('Account Inactive', {
            description: errorMsg,
            className: 'bg-error text-error-foreground border-error'
          });
          await supabase.auth.signOut();
          return;
        }
        
        localStorage.setItem('worker', JSON.stringify(worker));
        if (rememberMe) {
          localStorage.setItem('rememberLogin', 'true');
        }
        
        console.log('✅ Login complete, redirecting to clock screen');
        toast.success('Welcome to Pioneer Auto Timesheets!', {
          description: 'Login successful',
          className: 'bg-success text-success-foreground border-l-4 border-[#702D30]'
        });
        window.location.href = '/clock';
      }
    } catch (error) {
      console.error('💥 Unexpected login error:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMsg);
      toast.error('Error', {
        description: errorMsg,
        className: 'bg-error text-error-foreground border-error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EAEAEA] to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-1 pb-6 bg-white rounded-t-lg">
          <div className="flex justify-center mb-4">
            <PioneerLogo className="h-14" />
          </div>
          <CardTitle className="text-2xl text-center font-heading font-extrabold text-[#111111]">
            Worker Portal
          </CardTitle>
          <p className="text-center text-[#939393] font-body text-sm">
            Pioneer Auto Timesheets System
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-red-700 text-sm font-body">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 font-body"
              />
            </div>
            <div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 font-body"
              />
            </div>
            
            <label className="flex items-center space-x-2 text-sm font-body">
              <Checkbox 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <span>Remember me</span>
            </label>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#702D30] hover:bg-[#420808] text-white font-heading font-semibold transition-all duration-200 transform hover:scale-[1.02]"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}