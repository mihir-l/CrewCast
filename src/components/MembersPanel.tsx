import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'react-toastify';
import { Member } from '../types/interfaces';

interface MembersPanelProps {
    topicId: string;
}

const MembersPanel: React.FC<MembersPanelProps> = ({ topicId }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            // Get topic info which includes members
            const topic = await invoke<{ members: string[] }>('get_topic_by_topic_id', { topicId });

            if (!topic.members) {
                setMembers([]);
                setLoading(false);
                return;
            }

            // Fetch user info for each member
            const memberPromises = topic.members.map(async (nodeId) => {
                try {
                    const user = await invoke<any>('get_user_by_node_id', { nodeId });
                    return {
                        nodeId,
                        firstName: user.firstName || 'Unknown',
                        lastName: user.lastName,
                        lastSeen: Date.now(),
                        isActive: true
                    };
                } catch (error) {
                    return {
                        nodeId,
                        firstName: 'Unknown User',
                        lastName: undefined,
                        lastSeen: 0,
                        isActive: false
                    };
                }
            });

            const fetchedMembers = await Promise.all(memberPromises);
            setMembers(fetchedMembers);
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

                        if (existingMemberIndex >= 0) {
                            // Update existing member
                            const updatedMembers = [...prev];
                            updatedMembers[existingMemberIndex] = {
                                ...updatedMembers[existingMemberIndex],
                                firstName: meta.first_name || meta.firstName || updatedMembers[existingMemberIndex].firstName,
                                lastName: meta.last_name || meta.lastName,
                                lastSeen: Date.now(),
                                isActive: true
                            };
                            return updatedMembers;
                        } else {
                            // Add new member
                            const newMember = {
                                nodeId: sender,
                                firstName: meta.first_name || meta.firstName || 'Unknown',
                                lastName: meta.last_name || meta.lastName,
                                lastSeen: Date.now(),
                                isActive: true
                            };

                            // Show a toast notification for new members
                            toast.info(`${newMember.firstName} joined the topic`);

                            return [...prev, newMember];
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to process check-in message:', error);
            }
        });

        // Update activity status every 30 seconds
        const activityInterval = setInterval(() => {
            setMembers(prev =>
                prev.map(member => ({
                    ...member,
                    isActive: Date.now() - member.lastSeen < 60000 // Active if seen in the last minute
                }))
            );
        }, 30000);

        return () => {
            unlistenGossipMessage.then(fn => fn());
            clearInterval(activityInterval);
        };
    }, [topicId]);

    return (
        <div className="members-panel">
            <h2>Members</h2>

            {loading ? (
                <div className="loading">Loading members...</div>
            ) : members.length === 0 ? (
                <div className="no-members">
                    <p>No members found in this topic</p>
                </div>
            ) : (
                <ul className="members-list">
                    {members.map((member) => (
                        <li key={member.nodeId} className={`member-item ${member.isActive ? 'active' : 'inactive'}`}>
                            <div className="member-avatar">
                                {member.firstName.charAt(0).toUpperCase()}
                            </div>
                            <div className="member-info">
                                <div className="member-name">
                                    {member.firstName} {member.lastName || ''}
                                </div>
                                <div className="member-status">
                                    {member.isActive ? 'Active' : 'Inactive'}
                                </div>
                            </div>
                            <div className={`status-indicator ${member.isActive ? 'online' : 'offline'}`}></div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default MembersPanel;
