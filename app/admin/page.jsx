'use client';

import { SessionAuth } from 'supertokens-auth-react/recipe/session';
import AdminContent from './_components/AdminContent';
import './style.scss';

export default function AdminPage() {
  return (
    <SessionAuth>
      <AdminContent />
    </SessionAuth>
  );
}
