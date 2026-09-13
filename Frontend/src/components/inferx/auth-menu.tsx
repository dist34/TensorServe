import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useNavigate } from '@tanstack/react-router';
import { LogoutButton } from './logout-button';

interface AuthMenuProps {
  variant?: 'header' | 'nav';
}

export function AuthMenu({ variant = 'header' }: AuthMenuProps) {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogin = () => {
    navigate({ to: '/login' });
  };

  if (!isAuthenticated) {
    return (
      <button
        onClick={handleLogin}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] text-foreground transition-colors hover:border-border-strong"
      >
        <UserIcon className="size-4 text-muted-foreground" />
        <span className="font-medium">Sign In</span>
      </button>
    );
  }

  const buttonClass = variant === 'nav' 
    ? 'ts-nav-cta flex items-center gap-2' 
    : 'flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] text-foreground transition-colors hover:border-border-strong';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClass}
      >
        <div className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
          {user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <span className="font-medium text-sm">{user?.email?.split('@')[0] || 'User'}</span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-border bg-elevated shadow-lg">
          <div className="p-1">
            <button
              type="button"
              className="w-full px-3 py-2 text-[11px] text-muted-foreground border-b border-border pb-2 mb-1 text-left cursor-default"
              disabled
            >
              {user?.email}
            </button>
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}