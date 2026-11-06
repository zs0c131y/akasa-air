import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Moon, Sun, ALargeSmall } from 'lucide-react';
import { Button } from './ui/button.jsx';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from './ui/dropdown-menu.jsx';

const ThemeContext = createContext(null);
const read = (key, fallback) => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: the choice lasts for this visit only */ }
};
const systemDark = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => read('lms-theme', 'system'));
  const [textSize, setTextSizeState] = useState(() => read('lms-text', 'md'));
  const [prefersDark, setPrefersDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const on = (e) => setPrefersDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);
  useEffect(() => {
    if (textSize === 'md') document.documentElement.removeAttribute('data-text');
    else document.documentElement.setAttribute('data-text', textSize);
  }, [textSize]);

  const setTheme = useCallback((t) => { setThemeState(t); write('lms-theme', t); }, []);
  const setTextSize = useCallback((s) => { setTextSizeState(s); write('lms-text', s); }, []);
  const value = useMemo(() => ({ theme, resolved, setTheme, textSize, setTextSize }), [theme, resolved, setTheme, textSize, setTextSize]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const fallback = { theme: 'light', resolved: 'light', setTheme() {}, textSize: 'md', setTextSize() {} };
export const useTheme = () => useContext(ThemeContext) ?? fallback;

/** One button that flips between light and dark. */
export function ThemeToggle({ className }) {
  const { resolved, setTheme } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <Button variant="ghost" size="icon" className={className} onClick={() => setTheme(next)} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {resolved === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

/** Standard / larger / largest text for readers who want bigger type. */
export function TextSizeMenu() {
  const { textSize, setTextSize } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Text size" title="Text size"><ALargeSmall /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Text size</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={textSize} onValueChange={setTextSize}>
          <DropdownMenuRadioItem value="md">Standard</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="lg">Larger</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="xl">Largest</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
