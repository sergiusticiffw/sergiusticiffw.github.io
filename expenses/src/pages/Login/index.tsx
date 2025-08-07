import React from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { loginUser } from '@context/actions';
import { useNavigate } from 'react-router-dom';
import { AuthState } from '@type/types';
import { useGoogleLogin, TokenResponse } from '@react-oauth/google';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';


const Login = () => {
  const dispatch = useAuthDispatch();
  const navigate = useNavigate();
  const { loading, errorMessage, userIsLoggedIn } = useAuthState() as AuthState;

  if (userIsLoggedIn) {
    navigate('/expenses');
  }

  const handleLogin = async (googleResponse: TokenResponse) => {
    if ('access_token' in googleResponse) {
      const payload = { access_token: googleResponse.access_token };
      try {
        const response = await loginUser(dispatch, payload);
        if (response && !response.current_user) {
          return;
        }
        navigate(`/expenses`);
      } catch (error) {
        console.log(error);
      }
    }
  };

  const failedResponseGoogle = (response: Response) => {
    console.log(response);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="text-center pb-6">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg shadow-primary/25 border-4 border-background mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            Welcome Back
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            Sign in to access your expense tracker
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/50 rounded-lg">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <p className="text-sm text-destructive">
                {errorMessage}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Please login using Google to access app functionality
              </p>
            </div>

            <Button
              // @ts-expect-error
              onClick={useGoogleLogin({
                onSuccess: handleLogin,
                onError: failedResponseGoogle,
                onNonOAuthError: failedResponseGoogle,
              })}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-[1.02] font-semibold h-12"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              By signing in, you agree to our terms of service and privacy policy
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
