import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'react-toastify';
import { Message } from '../types/interfaces';

interface ChatPanelProps {
    topicId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ topicId }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [userCache, setUserCache] = useState<Record<string, { firstName: string }>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
        <div className="chat-panel">
            <div className="messages-container">
                {messages.length === 0 ? (
                    <div className="no-messages">
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    <div className="messages">
                        {messages.map((msg, index) => (
                            <div key={index} className="message">
                                <div className="message-header">
                                    <span className="sender">{msg.firstName || 'Unknown'}</span>
                                    <span className="time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="message-content">{msg.content}</div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <form onSubmit={handleSendMessage} className="message-input-form">
                <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    className="message-input"
                />
                <button type="submit" className="btn btn-primary">Send</button>
            </form>
        </div>
    );
};

export default ChatPanel;
