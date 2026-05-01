// Root mode switcher. Decides whether to render the editor (<App/>) or the
// game UI (<GameApp/>). Mode is persisted in localStorage so reloads keep
// the user where they were.

const MODE_KEY = 'squadron-mode';

function readInitialMode() {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'dev' || v === 'prod') return v;
  } catch (e) {}
  return 'dev';
}

function Root() {
  const [mode, setMode] = React.useState(readInitialMode);

  const switchMode = React.useCallback((next) => {
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch (e) {}
  }, []);

  if (mode === 'prod') {
    const GameApp = window.SquadronGame && window.SquadronGame.GameApp;
    if (!GameApp) {
      return <div style={{ padding: 20, fontFamily: 'monospace' }}>Loading game…</div>;
    }
    return <GameApp onSwitchMode={switchMode} />;
  }

  const App = window.SquadronUI && window.SquadronUI.App;
  return <App onSwitchMode={switchMode} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
