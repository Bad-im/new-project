import { ReactNode } from "react";

type InfoCardProps = {
  title: string;
  children: ReactNode;
};

export default function InfoCard({ title, children }: InfoCardProps) {
  return (
    <section className="info-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
