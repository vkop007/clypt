"use client"
import dynamic from 'next/dynamic';

const Home = dynamic(
  () => import('@/components/home').then(m => ({ default: m.Home })),
  { ssr: false }
);

export default function Page() {
  return <Home />;
}
