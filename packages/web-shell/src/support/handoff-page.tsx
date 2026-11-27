// `/support#<token>`: the support hand-off (slice A-02-10; contract row "Support session · the
// hand-off"; ADR-0050). The token is read from the fragment and the fragment leaves the address and
// history at once; it travels only in the body of POST /auth/support/session, never in a URL, the
// query cache, storage or a log. 200: the session it answers goes into the cache and the tab goes
// home, the clinic as its owner sees it. 404 `link_invalid` (used, older than 2 minutes, unknown,
// or the grant ended) or no token: «انتهى دخول الدعم».
import { SkeletonGroup, SkeletonText } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { AuthLayout } from '../auth/auth-layout.tsx';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { sessionQueryKey } from '../session.ts';
import { useText } from '../text.ts';
import { SupportEndedView } from './ended-page.tsx';
import { rememberSupportEnd } from './state.ts';

/** 43 base64url characters (the contract's `SupportHandoffRequest`). */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

type Shown = 'opening' | 'invalid' | 'failed';

export function SupportHandoffPage() {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const hash = useRouterState({ select: (s) => s.location.hash });
  // Read once, at mount: the fragment is gone from the address right after.
  const [token] = useState(() => {
    const raw = hash.replace(/^#/, '');
    return TOKEN.test(raw) ? raw : null;
  });
  const [shown, setShown] = useState<Shown>(token === null ? 'invalid' : 'opening');
  const asked = useRef(false);

  useEffect(() => {
    if (hash !== '') void navigate({ to: '/support', hash: '', replace: true });
  }, [hash, navigate]);

  useEffect(() => {
    if (token === null || asked.current) return;
    asked.current = true;
    void (async () => {
      try {
        const { data, error } = await shell.api.POST('/auth/support/session', {
          body: { token },
        });
        if (data) {
          // A session read started before the cookie existed must not answer "signed out" after.
          await queryClient.cancelQueries({ queryKey: sessionQueryKey });
          queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: data });
          await navigate({ to: '/', replace: true });
          return;
        }
        if (errorFacts(error).code === 'link_invalid') {
          rememberSupportEnd({ kind: 'link' });
          setShown('invalid');
        } else setShown('failed');
      } catch {
        setShown('failed');
      }
    })();
  }, [token, shell, queryClient, navigate]);

  if (shown === 'invalid') return <SupportEndedView end={{ kind: 'link' }} />;
  return (
    <AuthLayout>
      {shown === 'failed' ? (
        <p role="alert" className="m-0 text-body leading-body">
          {text('supportOpenFailed')}
        </p>
      ) : (
        <SkeletonGroup label={text('supportOpening')}>
          <SkeletonText lines={3} />
        </SkeletonGroup>
      )}
    </AuthLayout>
  );
}
