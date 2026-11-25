// «الفروع» in a solo clinic's settings (slice A-01-08 checkpoint 4; improvement f, spec gap 1):
// a clinic with one active branch has no branch screens, so its owner adds the second branch
// here; added, the clinic reads its branches and clinics again and the page goes to «الفروع».
// Archived branches waiting for a restore are linked to the branches page.
import { Button, Card } from '@shifa/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useBranchList } from '../team/data.ts';
import { useText } from '../text.ts';
import { BranchDialog } from './branch-dialog.tsx';
import { BranchNote, type PageNote } from './branch-note.tsx';
import { useBranchesChanged } from './branches-page.tsx';

export function SettingsBranchesCard({
  tenantId,
  userId,
  solo,
}: {
  tenantId: string;
  userId: string;
  /** Shown for a solo clinic only; the branches are read with the clinics, not after them. */
  solo: boolean;
}) {
  const text = useText();
  const navigate = useNavigate();
  const { data } = useBranchList(tenantId);
  const changed = useBranchesChanged(tenantId, userId);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<PageNote | null>(null);
  const archived = data?.archived.length ?? 0;
  if (!solo) return null;
  return (
    <div data-testid="settings-branches" className="max-w-(--shifa-width-140)">
      <Card className="gap-4 p-(--shifa-card-padding)">
        <h2 className="m-0 text-heading-sm leading-heading font-semibold">
          {text('settingsBranchesTitle')}
        </h2>
        <p className="m-0 text-body leading-body">{text('settingsBranchesSolo')}</p>
        <BranchNote note={note} />
        <div className="flex flex-wrap items-center gap-3">
          {archived > 0 && (
            <Link to="/branches" className="text-data font-medium text-brand-primary">
              {text('settingsBranchesArchived', { count: archived })}
            </Link>
          )}
          <span className="flex-1" />
          <Button
            variant="secondary"
            startIcon="plus"
            onClick={() => {
              setNote(null);
              setAdding(true);
            }}
          >
            {text('branchesAdd')}
          </Button>
        </div>
      </Card>
      {adding && (
        <BranchDialog
          onSaved={() => {
            setAdding(false);
            // The clinics read again first: the branches page sends a solo clinic here.
            void changed().then(() => navigate({ to: '/branches' }));
          }}
          onRefused={(next) => {
            setAdding(false);
            setNote(next);
            void changed();
          }}
          onClose={() => {
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
