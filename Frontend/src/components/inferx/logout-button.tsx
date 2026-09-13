import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export function LogoutButton() {
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.assign('/');
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[12px] text-foreground transition-colors hover:bg-secondary cursor-pointer text-left"
    >
      <LogOut className="size-4" />
      <span>Logout</span>
    </button>
  );
}