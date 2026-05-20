import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PRGE · Neighborhood Watch",
  description: "Real-time crisis monitoring — Madison, WI — Purge Night",
};

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
