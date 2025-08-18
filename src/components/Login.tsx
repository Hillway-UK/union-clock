import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle, Construction } from 'lucide-react';
import { toast } from 'sonner';
import { PioneerLogoBrand } from '@/components/PioneerLogo';

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
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        setError(error.message);
        toast.error('Login failed', {
          description: error.message,
          className: 'bg-error text-error-foreground border-error'
        });
        return;
      }

      if (user) {
        // Check if user exists in workers table
        const { data: worker, error: workerError } = await supabase
          .from('workers')
          .select('*')
          .eq('email', user.email)
          .single();
          
        if (workerError || !worker) {
          const errorMsg = 'Not authorized as worker';
          setError(errorMsg);
          toast.error('Access Denied', {
            description: errorMsg,
            className: 'bg-error text-error-foreground border-error'
          });
          await supabase.auth.signOut();
          return;
        }

        if (!worker.is_active) {
          const errorMsg = 'Worker account is inactive';
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
        
        toast.success('Welcome to Pioneer Auto Timesheets!', {
          description: 'Login successful',
          className: 'bg-success text-success-foreground border-l-4 border-[#FF6B35]'
        });
        window.location.href = '/clock';
      }
    } catch (error) {
      const errorMsg = 'An unexpected error occurred';
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
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-xl backdrop-blur-sm bg-card/95 animate-slide-in-up border-l-4 border-[#FF6B35]">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-8">
              <PioneerLogoBrand />
            </div>
            <CardTitle className="text-3xl font-bold text-foreground">Pioneer Auto Timesheets</CardTitle>
            <p className="text-muted-foreground text-lg">Worker Portal</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-error/10 border border-error/20 flex items-center gap-3 animate-slide-in-up">
                <AlertCircle className="h-5 w-5 text-error flex-shrink-0" />
                <p className="text-sm text-error font-medium">{error}</p>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 text-base border-2 focus:border-primary transition-all duration-200"
                  required
                  autoComplete="email"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 text-base border-2 focus:border-primary transition-all duration-200"
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="border-2"
                />
                <label 
                  htmlFor="remember" 
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  Remember me
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 text-base font-semibold bg-[#FF6B35] hover:bg-[#E85A2A] text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}