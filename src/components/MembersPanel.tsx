import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'react-toastify';
import { Member, User } from '../types/interfaces';
import { useUser } from '../contexts/UserContext';

interface MembersPanelProps {
    topicId: string;
}

// Activity timeout constant - users are inactive if not seen within this time
const ACTIVITY_TIMEOUT_MS = 10 * 1000; // 10 seconds

const MembersPanel: React.FC<MembersPanelProps> = ({ topicId }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const { currentUser } = useUser();

    const fetchMembers = async () => {
        setLoading(true);
        try {
            // Use get_users_by_topic_id to get all users for the topic efficiently
            const users = await invoke<User[]>('get_users_by_topic_id', { topicId });

            // Convert users to members format, getting the actual iroh node ID for each user
            const fetchedMembers: Member[] = await Promise.all(
                users.map(async (user) => {
                    let irohNodeId = '';
                    if (user.nodeId) {
                        try {
                            const node = await invoke<{ nodeId: string }>('get_node_by_id', { id: user.nodeId });
                            irohNodeId = node.nodeId;
                        } catch (error) {
                            console.error('Failed to get node for user:', user.id, error);
                        }
                    }

                    return {
                        nodeId: irohNodeId,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        lastSeen: Date.now(),
                        isActive: true
                    };
                })
            );
            setMembers(fetchedMembers.filter(member => member.nodeId)); // Filter out members without valid node IDs
        } catch (error) {
            console.error('Failed to fetch members:', error);
            toast.error('Could not load topic members');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (topicId) {
            fetchMembers();
        }

        // Listen for check-in messages to update member status
        const unlistenGossipMessage = listen('gossip-message', async (event) => {
            const message = event.payload as string;

            try {
                const parsedMessage = JSON.parse(message);

                if (parsedMessage.type === 'check_in') {
                    const sender = parsedMessage.sender;
                    const meta = parsedMessage.meta;

                    setMembers(prev => {
                        const existingMemberIndex = prev.findIndex(m => m.nodeId === sender);
                        const now = Date.now();

                        let updatedMembers;
                        if (existingMemberIndex >= 0) {
                            // Update existing member
                            updatedMembers = [...prev];
                            updatedMembers[existingMemberIndex] = {
                                ...updatedMembers[existingMemberIndex],
                                firstName: meta.first_name || meta.firstName || updatedMembers[existingMemberIndex].firstName,
                                lastName: meta.last_name || meta.lastName,
                                lastSeen: now,
                                isActive: true
                            };
                        } else {
                            // Add new member
                            const newMember = {
                                nodeId: sender,
                                firstName: meta.first_name || meta.firstName || 'Unknown',
                                lastName: meta.last_name || meta.lastName,
                                lastSeen: now,
                                isActive: true
                            };

                            // Show a toast notification for new members
                            toast.info(`${newMember.firstName} joined the topic`);

                            updatedMembers = [...prev, newMember];
                        }

                        // Update activity status for all members after receiving any check-in
                        return updatedMembers.map(member => ({
                            ...member,
                            isActive: member.nodeId === currentUser?.nodeId ||
                                now - member.lastSeen < ACTIVITY_TIMEOUT_MS
                        }));
                    });
                }
            } catch (error) {
                console.error('Failed to process check-in message:', error);
            }
        });

        // Update activity status every 5 seconds for more responsive status updates
        const activityInterval = setInterval(() => {
            setMembers(prev =>
                prev.map(member => ({
                    ...member,
                    // Current user is always active, others are active if seen within ACTIVITY_TIMEOUT_MS
                    isActive: member.nodeId === currentUser?.nodeId ||
                        Date.now() - member.lastSeen < ACTIVITY_TIMEOUT_MS
                }))
            );
        }, 5000); // Check every 5 seconds for more responsive updates

        return () => {
            unlistenGossipMessage.then(fn => fn());
            clearInterval(activityInterval);
        };
    }, [topicId]);

    return (
        <div className="members-panel">
            <div className="panel-header">
                <h2 className="panel-title">Members</h2>
                <div className="members-count">
                    {members.length} member{members.length !== 1 ? 's' : ''}
                </div>
            </div>

            <div className="panel-content">
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading members...</p>
                    </div>
                ) : members.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <p className="empty-title">No members yet</p>
                        <p className="empty-subtitle">Invite others to join this topic</p>
                    </div>
                ) : (
                    <div className="members-list">
                        {members.map((member) => (
                            <div key={member.nodeId} className={`member-card ${member.isActive ? 'active' : 'inactive'}`}>
                                <div className="member-avatar">
                                    <div className="avatar-circle">
                                        {member.firstName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={`status-dot ${member.isActive ? 'online' : 'offline'}`}></div>
                                </div>
                                <div className="member-info">
                                    <div className="member-name">
                                        {member.firstName} {member.lastName || ''}
                                    </div>
                                    <div className="member-status">
                                        <span className={`status-text ${member.isActive ? 'active' : 'inactive'}`}>
                                            {member.isActive ? 'Active now' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                <div className="member-actions">
                                    <button className="member-action-btn" title="More options">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MembersPanel;
