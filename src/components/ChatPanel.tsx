import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'react-toastify';
import { Chat, User } from '../types/interfaces';
import { useUser } from '../contexts/UserContext';

interface ChatPanelProps {
    topicId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ topicId }) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [userCache, setUserCache] = useState<Record<string, { firstName: string }>>({});
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { currentUser } = useUser();

    // Scroll to bottom of messages with enhanced behavior
    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'end',
                inline: 'nearest'
            });
        }, 100);
    };

    useEffect(() => {
        scrollToBottom();
    }, [chats]);

    // Also scroll to bottom when the component mounts
    useEffect(() => {
        if (!loading && chats.length > 0) {
            scrollToBottom();
        }
    }, [loading]);

    // Load existing chats when topic changes
    const loadChats = async () => {
        if (!topicId) return;

        try {
            setLoading(true);
            const existingChats = await invoke<Chat[]>('list_messages', { topicId });
            setChats(existingChats.reverse()); // Reverse to show oldest first

            // Pre-load users for this topic to avoid individual calls
            const users = await invoke<User[]>('get_users_by_topic_id', { topicId });

            // Map users to their iroh node_ids
            const newUserCache: Record<string, { firstName: string }> = {};

            for (const user of users) {
                if (user.nodeId) {
                    try {
                        const node = await invoke<{ nodeId: string }>('get_node_by_id', { id: user.nodeId });
                        newUserCache[node.nodeId] = { firstName: user.firstName };
                    } catch (error) {
                        console.warn(`Failed to get node for user ${user.id}:`, error);
                    }
                }
            }

            setUserCache(newUserCache);
        } catch (error) {
            console.error('Failed to load chats:', error);
            toast.error('Failed to load chat history');
        } finally {
            setLoading(false);
        }
    }; useEffect(() => {
        loadChats();
    }, [topicId]);

    // Function to fetch user by nodeId and cache it
    const fetchUserByNodeId = async (nodeId: string) => {
        if (userCache[nodeId]) {
            return userCache[nodeId];
        }

        try {
            const user = await invoke<{ firstName: string }>('get_user_by_node_id', { nodeId });
            setUserCache(prev => ({ ...prev, [nodeId]: user }));
            return user;
        } catch (error) {
            console.error(`Failed to fetch user for nodeId ${nodeId}:`, error);
            return { firstName: 'Unknown' };
        }
    };

    useEffect(() => {
        if (!topicId) return;

        // Listen for new messages
        const unlistenGossipMessage = listen('gossip-message', async (event) => {
            const message = event.payload as string;

            try {
                const parsedMessage = JSON.parse(message);

                if (parsedMessage.type === 'chat') {
                    // Single chat message
                    if (parsedMessage.chat) {
                        // Use the full chat object from the database
                        const newChat: Chat = parsedMessage.chat;
                        setChats(prev => [...prev, newChat]);
                    } else {
                        // Fallback for older format
                        const sender = parsedMessage.sender;
                        const newChat: Chat = {
                            id: 0,
                            nodeId: sender,
                            topicId: topicId,
                            hash: '',
                            message: parsedMessage.content,
                            sharedAt: Date.now() / 1000 // Convert to Unix timestamp
                        };
                        setChats(prev => [...prev, newChat]);
                    }
                } else if (parsedMessage.type === 'chat_batch') {
                    // Batch of chat messages
                    const newChats: Chat[] = parsedMessage.chats || [];
                    if (newChats.length > 0) {
                        // Sort by timestamp to maintain order
                        newChats.sort((a, b) => a.sharedAt - b.sharedAt);
                        setChats(prev => [...prev, ...newChats]);
                    }
                } else if (parsedMessage.type === 'sync_batch_update') {
                    // Sync batch with both files and chats
                    const newChats: Chat[] = parsedMessage.chats || [];
                    if (newChats.length > 0) {
                        // Sort by timestamp to maintain order
                        newChats.sort((a, b) => a.sharedAt - b.sharedAt);
                        setChats(prev => [...prev, ...newChats]);
                    }
                }
            } catch (error) {
                console.error('Failed to process chat message:', error);
            }
        });

        return () => {
            unlistenGossipMessage.then(fn => fn());
        };
    }, [topicId, userCache]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!messageInput.trim()) {
            return;
        }

        try {
            await invoke('send_message', { message: messageInput });
            setMessageInput('');
            // Reload chats to get the newly sent message
            await loadChats();
        } catch (error) {
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            background: 'var(--background)'
        }}>
            {/* Messages Container */}
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    scrollBehavior: 'smooth'
                }}
                className="custom-scrollbar"
            >
                {loading ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ color: 'var(--textSecondary)', fontSize: '1rem', margin: 0 }}>Loading chats...</p>
                        </div>
                    </div>
                ) : chats.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: '4rem',
                                height: '4rem',
                                margin: '0 auto 1rem',
                                borderRadius: '50%',
                                background: 'var(--surface)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--border)'
                            }}>
                                <svg style={{ width: '2rem', height: '2rem', color: 'var(--textSecondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <p style={{ color: 'var(--textSecondary)', fontSize: '1rem', margin: '0 0 0.5rem 0' }}>No messages yet</p>
                            <p style={{ color: 'var(--textSecondary)', fontSize: '0.875rem', margin: 0 }}>Start the conversation!</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {chats.map((chat, index) => {
                            const isMyMessage = chat.nodeId === currentUser?.nodeId;
                            return (
                                <ChatMessage
                                    key={chat.id || index}
                                    chat={chat}
                                    isMyMessage={isMyMessage}
                                    userCache={userCache}
                                    fetchUserByNodeId={fetchUserByNodeId}
                                />
                            );
                        })}
                        <div ref={messagesEndRef} style={{ height: '0.5rem', flexShrink: 0 }} />
                    </>
                )}
            </div>

            {/* Message Input */}
            <div style={{
                padding: '1.25rem 1.5rem',
                borderTop: '1px solid var(--border)',
                background: 'var(--background)',
                boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.05)'
            }}>
                <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        type="button"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--textSecondary)',
                            cursor: 'pointer',
                            padding: '0.625rem',
                            borderRadius: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                        }}
                        title="Attach file"
                    >
                        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                    </button>
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Type a message..."
                        style={{
                            flex: 1,
                            padding: '0.875rem 1.125rem',
                            border: '1px solid var(--border)',
                            borderRadius: '1.5rem',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            fontSize: '0.875rem',
                            outline: 'none',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!messageInput.trim()}
                        style={{
                            background: messageInput.trim() ? 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)' : 'var(--textSecondary)',
                            border: 'none',
                            color: 'white',
                            cursor: messageInput.trim() ? 'pointer' : 'not-allowed',
                            padding: '0.875rem',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            boxShadow: messageInput.trim() ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
                            transform: messageInput.trim() ? 'scale(1)' : 'scale(0.95)',
                            opacity: messageInput.trim() ? '1' : '0.6'
                        }}
                        title="Send message"
                    >
                        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

// Individual ChatMessage component
interface ChatMessageProps {
    chat: Chat;
    isMyMessage: boolean;
    userCache: Record<string, { firstName: string }>;
    fetchUserByNodeId: (nodeId: string) => Promise<{ firstName: string }>;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ chat, isMyMessage, userCache, fetchUserByNodeId }) => {
    const [userInfo, setUserInfo] = useState<{ firstName: string } | null>(null);

    useEffect(() => {
        const getUserInfo = async () => {
            if (!isMyMessage) {
                const user = await fetchUserByNodeId(chat.nodeId);
                setUserInfo(user);
            }
        };
        getUserInfo();
    }, [chat.nodeId, isMyMessage, fetchUserByNodeId]);

    const displayName = isMyMessage ? 'You' : (userInfo?.firstName || userCache[chat.nodeId]?.firstName || 'Unknown');
    const timestamp = new Date(chat.sharedAt * 1000); // Convert from Unix timestamp

    return (
        <div style={{ marginBottom: '1rem' }}>
            {isMyMessage ? (
                // My message - right aligned with improved styling
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
                        color: 'white',
                        padding: '0.875rem 1.125rem',
                        borderRadius: '1.25rem 1.25rem 0.375rem 1.25rem',
                        maxWidth: '75%',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        position: 'relative',
                        wordWrap: 'break-word',
                        transition: 'transform 0.1s ease'
                    }}>
                        {chat.message}
                    </div>
                </div>
            ) : (
                // Other's message - left aligned with avatar
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <div style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--textSecondary) 0%, #6b7280 100%)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        flexShrink: 0,
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                        {displayName.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            padding: '0.875rem 1.125rem',
                            borderRadius: '1.25rem 1.25rem 1.25rem 0.375rem',
                            maxWidth: '75%',
                            fontSize: '0.875rem',
                            lineHeight: '1.5',
                            border: '1px solid var(--border)',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                            wordWrap: 'break-word'
                        }}>
                            {chat.message}
                        </div>
                    </div>
                </div>
            )}
            {/* Timestamp */}
            <div style={{
                fontSize: '0.75rem',
                color: 'var(--textSecondary)',
                textAlign: isMyMessage ? 'right' : 'left',
                marginLeft: isMyMessage ? '0' : '3.25rem',
                marginTop: '0.25rem'
            }}>
                {isMyMessage ?
                    timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                    `${displayName} • ${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                }
            </div>
        </div>
    );
};

export default ChatPanel;
