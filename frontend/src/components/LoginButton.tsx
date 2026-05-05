type LoginButtonProps = {
  isAdmin: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

export default function LoginButton({ isAdmin, onLogin, onLogout }: LoginButtonProps) {
  if (!isAdmin) {
    return (
      <button className="secondary-button" type="button" onClick={onLogin}>
        Войти
      </button>
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
