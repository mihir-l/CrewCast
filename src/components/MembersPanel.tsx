import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'react-toastify';
import { Member, User } from '../types/interfaces';

interface MembersPanelProps {
    topicId: string;
}

const MembersPanel: React.FC<MembersPanelProps> = ({ topicId }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            // Use get_users_by_topic_id to get all users for the topic efficiently
            const users = await invoke<User[]>('get_users_by_topic_id', { topicId });

            // Get topic info to get all member node_ids
            const topic = await invoke<{ members: string[] }>('get_topic_by_topic_id', { topicId });

            if (!topic.members) {
                setMembers([]);
                setLoading(false);
                return;
            }

            // For each user, get their node info to map to iroh node_id
            // This is more efficient than individual get_user_by_node_id calls
            const userNodePromises = users.map(async (user) => {
                if (user.nodeId) {
                    try {
                        const node = await invoke<{ nodeId: string }>('get_node_by_id', { id: user.nodeId });
                        return { user, irohNodeId: node.nodeId };
                    } catch (error) {
                        return null;
                    }
                }
                return null;
            });

            const userNodeMappings = await Promise.all(userNodePromises);

            // Create a map of users by iroh node_id
            const userMap = new Map<string, User>();
            userNodeMappings.forEach(mapping => {
                if (mapping) {
                    userMap.set(mapping.irohNodeId, mapping.user);
                }
            });

            // Map all members (including those without user records)
            const fetchedMembers: Member[] = topic.members.map((nodeId) => {
                const user = userMap.get(nodeId);

                if (user) {
                    return {
                        nodeId,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        lastSeen: Date.now(),
                        isActive: true
                    };
                } else {
                    // Member without user record
                    return {
                        nodeId,
                        firstName: 'Unknown User',
                        lastName: undefined,
                        lastSeen: 0,
                        isActive: false
                    };
                }
            });

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
