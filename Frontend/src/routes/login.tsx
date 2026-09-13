import React from "react";
import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import LoginPage from "@/components/inferx/login-page";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search ?? "");
  const initialMode = params.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = React.useState<'login' | 'register'>(initialMode);

  React.useEffect(() => {
    setMode(params.get("mode") === "register" ? "register" : "login");
  }, [params, location.search]);

  const handleSuccess = () => {
    navigate({ to: '/' });
  };

  const handleCreateAccount = () => {
    const nextMode = mode === 'login' ? 'register' : 'login';
    navigate({
      to: '/login',
      search: { mode: nextMode },
    });
  };

  const handleForgotPassword = () => {
    alert('Forgot password functionality coming soon');
  };

  return (
    <LoginPage
      mode={mode}
      onSuccess={handleSuccess}
      onCreateAccount={handleCreateAccount}
      onForgotPassword={handleForgotPassword}
    />
  );
}