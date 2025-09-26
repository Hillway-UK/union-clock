import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Eye, EyeOff, Lock, Loader2, AlertCircle, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type VerificationMethod = 'token-based' | 'otp-with-email' | 'pkce-fallback' | 'failed';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(true);
  const [canReset, setCanReset] = useState(false);
  
  // Hybrid verification states
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('failed');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [showResendOption, setShowResendOption] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Cooldown effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    const verifyResetLink = async () => {
      try {
        // Parse URL hash parameters (access_token, refresh_token, type)
        const hash = window.location.hash.slice(1);
        const hashParams = new URLSearchParams(hash);
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');
        
        // Also check query parameters (some environments deliver tokens in query)
        const queryAccessToken = searchParams.get('access_token');
        const queryRefreshToken = searchParams.get('refresh_token');
        const queryType = searchParams.get('type');
        const code = searchParams.get('code');
        const emailParam = searchParams.get('email');

        // Supabase may return error details in either hash or query
        const errorDescription =
          searchParams.get('error_description') ||
          searchParams.get('error') ||
          searchParams.get('error_code') ||
          hashParams.get('error_description') ||
          hashParams.get('error') ||
          hashParams.get('error_code');

        if (errorDescription) {
          throw new Error(errorDescription);
        }

        const accessToken = hashAccessToken || queryAccessToken;
        const refreshToken = hashRefreshToken || queryRefreshToken;
        const type = hashType || queryType;

        // Hybrid verification method detection
        if (type === 'recovery' && accessToken && refreshToken) {
          // Method 1: Token-based (fastest, most secure)
          console.log('🔐 Using token-based verification');
          setVerificationMethod('token-based');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          window.history.replaceState(null, '', window.location.pathname);
          setCanReset(true);
        } else if (code && emailParam) {
          // Method 2: OTP with email (cross-device compatible)
          console.log('📱 Using OTP with email verification');
          setVerificationMethod('otp-with-email');
          setEmail(emailParam);
          await handleOtpVerification(code, emailParam);
        } else if (code && !emailParam) {
          // Method 3: PKCE fallback (try PKCE first, then ask for email)
          console.log('🔄 Trying PKCE verification');
          setVerificationMethod('pkce-fallback');
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              if (error.message.includes('code verifier') || error.message.includes('PKCE')) {
                console.log('📧 PKCE failed, falling back to email input');
                setShowEmailInput(true);
                setShowOtpInput(true);
                setOtp(code);
              } else if (error.status === 403) {
                setShowResendOption(true);
                throw new Error('Your reset link has expired. Please request a new one.');
              } else {
                throw error;
              }
            } else {
              window.history.replaceState(null, '', window.location.pathname);
              setCanReset(true);
            }
          } catch (pkceError) {
            if (pkceError instanceof Error && pkceError.message.includes('expired')) {
              setShowResendOption(true);
            }
            throw pkceError;
          }
        } else {
          throw new Error('Invalid or expired reset link');
        }
      } catch (error) {
        console.error('❌ Reset link verification failed:', error);
        const description =
          error instanceof Error ? error.message : 'This password reset link is invalid or has expired.';
        toast.error('Invalid Reset Link', {
          description,
          className: 'bg-error text-error-foreground border-error',
        });
        setError(description);
        setVerificationMethod('failed');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyResetLink();
  }, [searchParams]);

  const handleOtpVerification = async (otpCode: string, userEmail: string) => {
    try {
      console.log('🔢 Verifying OTP for recovery');
      const { error } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otpCode,
        type: 'recovery'
      });
      
      if (error) {
        if (error.status === 403) {
          setShowResendOption(true);
          throw new Error('Your reset code has expired. Please request a new one.');
        }
        throw error;
      }
      
      setCanReset(true);
      window.history.replaceState(null, '', window.location.pathname);
    } catch (error) {
      console.error('❌ OTP verification failed:', error);
      throw error;
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Ensure we have an active session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found. Please click the reset link again.');
      }

      // Validate passwords
      const validation = passwordSchema.safeParse({ password, confirmPassword });
      if (!validation.success) {
        setError(validation.error.issues[0].message);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('❌ Password update error:', error.message);
        setError(error.message);
        toast.error('Reset Failed', {
          description: error.message,
          className: 'bg-error text-error-foreground border-error'
        });
        return;
      }

      toast.success('Password Updated', {
        description: 'Your password has been successfully updated.',
        className: 'bg-success text-success-foreground border-l-4 border-black'
      });

      // Sign out to force fresh login with new password
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('💥 Unexpected password reset error:', error);
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

  const handleEmailOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !otp.trim()) {
      setError('Please provide both email and verification code');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await handleOtpVerification(otp, email.trim());
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Verification failed';
      setError(description);
      toast.error('Verification Failed', {
        description,
        className: 'bg-error text-error-foreground border-error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetLink = async () => {
    if (resendCooldown > 0) return;
    
    setResendLoading(true);
    setError('');
    
    try {
      const resetEmail = email || '';
      if (!resetEmail) {
        throw new Error('Email address is required');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast.success('New Reset Link Sent', {
        description: 'Check your email for a new password reset link',
        className: 'bg-success text-success-foreground border-l-4 border-black'
      });
      
      setShowResendOption(false);
      setResendCooldown(60); // 60 second cooldown
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Failed to send reset link';
      setError(description);
      toast.error('Resend Failed', {
        description,
        className: 'bg-error text-error-foreground border-error'
      });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-black">AutoTime</h1>
          <p className="mt-2 text-gray-600">Reset Your Password</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm p-8">
          {isVerifying ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Verifying Reset Link</h3>
              <p className="text-gray-600">
                {verificationMethod === 'token-based' && 'Verifying security tokens...'}
                {verificationMethod === 'otp-with-email' && 'Verifying with email code...'}
                {verificationMethod === 'pkce-fallback' && 'Trying secure verification...'}
                {verificationMethod === 'failed' && 'Please wait while we verify your password reset link...'}
              </p>
            </div>
          ) : showEmailInput && showOtpInput ? (
            <div className="space-y-6">
              <div className="text-center">
                <Mail className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Verification Required</h3>
                <p className="text-gray-600 mb-6">
                  We need your email address to verify this reset code for cross-device compatibility.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleEmailOtpSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-black"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Code
                  </label>
                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !email.trim() || otp.length < 6}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Continue'
                  )}
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-black transition-colors"
                  onClick={() => navigate('/login')}
                >
                  Back to Login
                </button>
              </div>
            </div>
          ) : !canReset ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">Invalid Reset Link</h3>
              <p className="text-red-700 mb-6">{error}</p>
              
              {showResendOption ? (
                <div className="space-y-4">
                  <Button
                    onClick={handleResendResetLink}
                    disabled={resendLoading || resendCooldown > 0}
                    className="w-full"
                  >
                    {resendLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : resendCooldown > 0 ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend in {resendCooldown}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Send New Reset Link
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => navigate('/login')}
                    className="w-full"
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full"
                >
                  Request New Reset Link
                </Button>
              )}
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 mb-6">
                  <p className="text-red-700 text-sm font-body">{error}</p>
                </div>
              )}
              
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:border-black text-lg"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:border-black text-lg"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Password requirements:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>At least 8 characters long</li>
                    <li>Contains uppercase and lowercase letters</li>
                    <li>Contains at least one number</li>
                  </ul>
                </div>
                
                <button
                  type="submit"
                  className="w-full py-4 bg-black hover:bg-gray-800 text-white rounded-xl font-semibold text-lg transform transition-all active:scale-95 flex items-center justify-center gap-2"
                  disabled={loading || !canReset}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Update Password
                    </>
                  )}
                </button>
              </form>
              
              <div className="mt-6 text-center">
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-black transition-colors"
                  onClick={() => navigate('/login')}
                >
                  Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}