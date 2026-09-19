'use client';

import { SuperTokensWrapper } from 'supertokens-auth-react';
import SuperTokensReact from 'supertokens-auth-react';
import { usePathname, useRouter } from 'next/navigation';
import { frontendConfig, setRouter } from '../config/frontend';

if (typeof window !== 'undefined') {
  // Init hanya dijalankan di browser (client side).
  SuperTokensReact.init(frontendConfig());
}

export default function SuperTokensProvider({ children }) {
  setRouter(useRouter(), usePathname() || window.location.pathname);

  return <SuperTokensWrapper>{children}</SuperTokensWrapper>;
}
