import { ReactNode } from "react";

type ProtectedPageProps = {
  message: string;
  children: ReactNode;
  isAdmin: boolean;
  onLogin: () => void;
};

export default function ProtectedPage({
  message,
  children,
  isAdmin,
  onLogin,
}: ProtectedPageProps) {
  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <section className="protected-state">
      <div className="protected-card">
        <p className="eyebrow">Ограниченный доступ</p>
        <h1>Требуется режим администратора</h1>
        <p>{message}</p>
        <button className="primary-button" type="button" onClick={onLogin}>
          Войти как администратор
        </button>
      </div>
    </section>
  );
}
