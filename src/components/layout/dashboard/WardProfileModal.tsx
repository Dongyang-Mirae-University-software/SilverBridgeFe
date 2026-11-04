'use client';

import { InlineProfileModal } from './InlineProfileModal';
import { RoleProfileModalProps } from './profileModalTypes';

export function WardProfileModal(props: RoleProfileModalProps) {
  return <InlineProfileModal variant="ward" {...props} />;
}
