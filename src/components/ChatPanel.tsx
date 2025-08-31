import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'react-toastify';
import { Message } from '../types/interfaces';
import { useUser } from '../contexts/UserContext';

interface ChatPanelProps {
    topicId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ topicId }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [userCache, setUserCache] = useState<Record<string, { firstName: string }>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { currentUser } = useUser();

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
                    const sender = parsedMessage.sender;
                    const user = await fetchUserByNodeId(sender);

                    setMessages(prev => [
                        ...prev,
                        {
                            content: parsedMessage.content,
                            sender: parsedMessage.sender,
                            firstName: user.firstName,
                            timestamp: Date.now()
                        }
                    ]);
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
            background: 'var(--background)'
        }}>
            {/* Messages Container */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
            }}>
                {messages.length === 0 ? (
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
                        {messages.map((msg, index) => {
                            const isMyMessage = msg.sender === currentUser?.nodeId;
                            return (
                                <div key={index}>
                                    {isMyMessage ? (
                                        // My message - right aligned with blue bubble
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                                            <div style={{
                                                background: 'var(--primary)',
                                                color: 'white',
                                                padding: '0.75rem 1rem',
                                                borderRadius: '1rem 1rem 0.25rem 1rem',
                                                maxWidth: '70%',
                                                fontSize: '0.875rem',
                                                lineHeight: '1.4'
                                            }}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ) : (
                                        // Other's message - left aligned with avatar
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                            <div style={{
                                                width: '2.5rem',
                                                height: '2.5rem',
                                                borderRadius: '50%',
                                                background: 'var(--textSecondary)',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                flexShrink: 0
                                            }}>
                                                {(msg.firstName || 'Unknown').substring(0, 2).toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    background: 'var(--surface)',
                                                    color: 'var(--text)',
                                                    padding: '0.75rem 1rem',
                                                    borderRadius: '1rem 1rem 1rem 0.25rem',
                                                    maxWidth: '70%',
                                                    fontSize: '0.875rem',
                                                    lineHeight: '1.4',
                                                    border: '1px solid var(--border)'
                                                }}>
                                                    {msg.content}
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
                                        marginBottom: '1rem'
                                    }}>
                                        {isMyMessage ?
                                            new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                            `${msg.firstName || 'Unknown'} • ${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                        }
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Message Input */}
            <div style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border)',
                background: 'var(--background)'
            }}>
                <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        type="button"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--textSecondary)',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            borderRadius: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
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
                            padding: '0.75rem 1rem',
                            border: '1px solid var(--border)',
                            borderRadius: '1.5rem',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            fontSize: '0.875rem',
                            outline: 'none'
                        }}
                    />
                    <button
                        type="submit"
                        style={{
                            background: 'var(--primary)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '0.75rem',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'opacity 0.2s'
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

export default ChatPanel;
