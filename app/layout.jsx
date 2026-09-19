import '../scss/globals.scss';

export const metadata = {
  title: 'Progress Dashboard',
  description: 'Progress reporting dashboard built with React and Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
