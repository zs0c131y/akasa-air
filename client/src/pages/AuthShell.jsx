import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { passwordProblem } from '@lms/shared';
import { useAuth } from '../auth.jsx';
import { Brand, FieldError } from '../components.jsx';
import { ThemeToggle } from '../theme.jsx';
import { Button } from '../ui/button.jsx';
import { Input, Label } from '../ui/input.jsx';

/** Page frame shared by sign up, forgot password, reset and verify: header, a narrow column, a heading. */
export function AuthShell({ kicker, title, intro, children, back = true }) {
  const signedIn = Boolean(useAuth()?.user);
  const body = (
    <>
      {back && !signedIn && (
        <Link to="/login" className="mb-8 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to sign in
        </Link>
      )}
      <div className="max-w-md">
        {kicker && <p className="kicker mb-2.5">{kicker}</p>}
        <h1 className="font-display text-3xl leading-[1.1] sm:text-4xl">{title}</h1>
        {intro && <p className="mt-2.5 text-muted-foreground">{intro}</p>}
        <div className="mt-7 rounded-lg border bg-card p-5 shadow-soft sm:p-6">{children}</div>
      </div>
    </>
  );
  // Signed in, the app shell already supplies the header and main area.
  if (signedIn) return <section>{body}</section>;
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="rounded-md" aria-label="Layover by Akasa Air, home"><Brand /></Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="content" className="container pb-24 pt-8 sm:pt-12">{body}</main>
    </div>
  );
}

/**
 * Password input with a show/hide button, a field error and, once the person has typed
 * something, a quiet hint about what is still missing.
 */
export function PasswordField({ id, label, value, onChange, autoComplete, error, hint = false, context, describedBy }) {
  const [shown, setShown] = useState(false);
  const live = hint && value ? passwordProblem(value, context) : null;
  const errId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          aria-describedby={[error ? errId : null, live ? hintId : null, describedBy].filter(Boolean).join(' ') || undefined}
          className="pr-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 text-muted-foreground"
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      <FieldError msg={error} id={errId} />
      {!error && live && <p id={hintId} className="mt-1.5 text-sm text-muted-foreground">{live}</p>}
    </div>
  );
}
