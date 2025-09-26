import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, AlertCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address')
});

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');

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
        
        // Add a small delay to let session fully stabilize after password reset
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
        toast.success('Welcome to AutoTime!', {
          description: 'Login successful',
          className: 'bg-success text-success-foreground border-l-4 border-black'
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordError('');

    try {
      // Validate email
      const validation = emailSchema.safeParse({ email: forgotPasswordEmail });
      if (!validation.success) {
        setForgotPasswordError(validation.error.issues[0].message);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error('❌ Password reset error:', error.message);
        setForgotPasswordError(error.message);
        toast.error('Reset Failed', {
          description: error.message,
          className: 'bg-error text-error-foreground border-error'
        });
        return;
      }

      toast.success('Reset Email Sent', {
        description: 'Check your email for password reset instructions',
        className: 'bg-success text-success-foreground border-l-4 border-black'
      });
      
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    } catch (error) {
      console.error('💥 Unexpected forgot password error:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      setForgotPasswordError(errorMsg);
      toast.error('Error', {
        description: errorMsg,
        className: 'bg-error text-error-foreground border-error'
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-black">AutoTime</h1>
          <p className="mt-2 text-gray-600">Worker Time Management</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm p-8">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-red-700 text-sm font-body">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-black text-lg"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoCapitalize="none"
              />
            </div>
            
            <div>
              <input
                type="password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-black text-lg"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            
            <label className="flex items-center space-x-2 text-sm">
              <Checkbox 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <span>Remember me</span>
            </label>
            
            <button
              type="submit"
              className="w-full py-4 bg-black hover:bg-gray-800 text-white rounded-xl font-semibold text-lg transform transition-all active:scale-95"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-black transition-colors"
                >
                  Forgot your password?
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Reset Password
                  </DialogTitle>
                </DialogHeader>
                
                {forgotPasswordError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-red-700 text-sm">{forgotPasswordError}</p>
                  </div>
                )}
                
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-black"
                      placeholder="Enter your email address"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowForgotPassword(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={forgotPasswordLoading}
                    >
                      {forgotPasswordLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Reset Email'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}