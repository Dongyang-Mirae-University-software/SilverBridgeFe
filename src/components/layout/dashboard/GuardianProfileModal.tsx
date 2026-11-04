'use client';

import { InlineProfileModal } from './InlineProfileModal';
import { RoleProfileModalProps } from './profileModalTypes';

export function GuardianProfileModal(props: RoleProfileModalProps) {
  return <InlineProfileModal variant="guardian" {...props} />;
}
