import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import pioneerLogo from '@/assets/pioneer-logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        toast.error('Login failed: ' + error.message);
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
          toast.error('Not authorized as worker');
          await supabase.auth.signOut();
          return;
        }

        if (!worker.is_active) {
          toast.error('Worker account is inactive');
          await supabase.auth.signOut();
          return;
        }
        
        localStorage.setItem('worker', JSON.stringify(worker));
        toast.success('Login successful!');
        window.location.href = '/clock';
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-2 bg-primary/10 rounded-lg w-24 h-16 flex items-center justify-center overflow-hidden">
              <img 
                src={pioneerLogo} 
                alt="Pioneer Construction" 
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <CardTitle className="text-2xl font-bold">Time Keeper</CardTitle>
            <p className="text-muted-foreground">Construction Time Tracking</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-base"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}