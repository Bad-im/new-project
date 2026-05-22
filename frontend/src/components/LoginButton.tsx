import { FormEvent, useEffect, useState } from "react";

type LoginButtonProps = {
  isAdmin: boolean;
  loginError?: string;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => void;
};

export default function LoginButton({
  isAdmin,
  loginError = "",
  onLogin,
  onLogout,
}: LoginButtonProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const openLogin = () => setIsFormOpen(true);
    window.addEventListener("fireforest-open-login", openLogin);
    return () => window.removeEventListener("fireforest-open-login", openLogin);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onLogin(username, password);
      setPassword("");
      setIsFormOpen(false);
    } catch {
      // Error text is owned by App and rendered below the form.
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin) {
    if (!isFormOpen) {
      return (
        <button className="secondary-button" type="button" onClick={() => setIsFormOpen(true)}>
          Войти
        </button>
      );
    }

    return (
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          aria-label="Логин администратора"
          placeholder="admin"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <input
          aria-label="Пароль администратора"
          placeholder="пароль"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Вход..." : "Войти"}
        </button>
        <button className="secondary-button" type="button" onClick={() => setIsFormOpen(false)}>
          Отмена
        </button>
        {loginError && <span className="login-error">{loginError}</span>}
      </form>
    );
  }

  return (
    <div className="user-actions">
      <span className="role-badge">Администратор</span>
      <button className="secondary-button" type="button" onClick={onLogout}>
        Выйти
      </button>
    </div>
  );
}
