import React, { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

interface Props {
  adminOnly?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Renders children only if user has the required role. */
export default function RoleGuard({ adminOnly = false, children, fallback = null }: Props) {
  const { user, isAdmin } = useAuth();
  if (!user) return null;
  if (adminOnly && !isAdmin) return <>{fallback}</>;
  return <>{children}</>;
}
