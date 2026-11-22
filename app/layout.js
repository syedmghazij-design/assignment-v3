import './globals.css';

export const metadata = {
  title: 'GIMS Portal — Assignment & Attendance Management',
  description: 'University assignment portal: students upload, teachers review, admin controls everything.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f7b3f',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
