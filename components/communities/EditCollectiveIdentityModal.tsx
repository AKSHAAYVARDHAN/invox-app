import React from 'react';
import type { Community } from '../../types';
import { CreateCommunityModal } from './CreateCommunityModal';

export interface EditCollectiveIdentityModalProps {
    isOpen: boolean;
    onClose: () => void;
    community: Community;
    onSaved?: (updated?: Community) => void;
}

/**
 * EditCollectiveIdentityModal delegates strictly to the unified 6-step
 * Community Management workflow in Edit Mode.
 */
export const EditCollectiveIdentityModal: React.FC<EditCollectiveIdentityModalProps> = ({
    isOpen,
    onClose,
    community,
    onSaved,
}) => {
    return (
        <CreateCommunityModal
            isOpen={isOpen}
            onClose={onClose}
            community={community}
            mode="edit"
            onUpdated={(updated) => {
                if (onSaved) {
                    onSaved(updated);
                }
            }}
        />
    );
};

export default EditCollectiveIdentityModal;
