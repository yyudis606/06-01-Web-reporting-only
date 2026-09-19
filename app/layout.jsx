import '../scss/globals.scss';
import SuperTokensProvider from './components/supertokensProvider';

export const metadata = {
  title: 'Progress Dashboard',
  description: 'Progress reporting dashboard built with React and Next.js',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SuperTokensProvider>{children}</SuperTokensProvider>
      </body>
    </html>
  );
}
