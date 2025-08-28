import React, { createContext, useContext, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'react-toastify';
import { Topic } from '../types/interfaces';

interface TopicContextType {
    currentTopic: Topic | null;
    joinTopic: (topic: Topic) => void;
    leaveTopic: () => void;
    createTopic: (name: string) => Promise<string>;
    joinTopicWithTicket: (ticket: string) => Promise<boolean>;
    joinTopicWithId: (id: number) => Promise<boolean>;
    fetchTopics: () => Promise<Topic[]>;
    getTicketForTopic: (topicId: string) => Promise<string>;
}

const TopicContext = createContext<TopicContextType | null>(null);

export const TopicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);

    const joinTopic = (topic: Topic) => {
        setCurrentTopic(topic);
    };

    const leaveTopic = async (): Promise<void> => {
        try {
            const msg = await invoke<String>('leave_topic');
            console.log(msg);
            setCurrentTopic(null);
        } catch (error) {
            console.error('Failed to leave topic:', error);
            toast.error('Failed to leave topic');
        }
    };

    const createTopic = async (name: string): Promise<string> => {
        try {
            const ticket = await invoke<string>('start_new_topic', { name });
            toast.success(`New topic "${name}" created successfully!`);
            return ticket;
        } catch (error) {
            console.error('Failed to create topic:', error);
            toast.error('Failed to create topic');
            return '';
        }
    };

    const joinTopicWithTicket = async (ticket: string): Promise<boolean> => {
        try {
            const topic = await invoke<Topic>('join_topic_with_ticket', { key: ticket });
            toast.success(`Joined topic "${topic.name}" successfully!`);
            setCurrentTopic({
                ...topic,
                topicId: topic.topicId // Ensure compatibility with frontend
            });
            return true;
        } catch (error) {
            console.error('Failed to join topic with ticket:', error);
            toast.error('Failed to join topic with the provided ticket');
            return false;
        }
    };

    const joinTopicWithId = async (id: number): Promise<boolean> => {
        try {
            const topic = await invoke<Topic>('join_topic_with_id', { id });
            toast.success(`Joined topic "${topic.name}" successfully!`);
            setCurrentTopic({
                ...topic,
                topicId: topic.topicId // Ensure compatibility with frontend
            });
            return true;
        } catch (error) {
            console.error('Failed to join topic with ID:', error);
            toast.error('Failed to join topic with the provided ID');
            return false;
        }
    };

    const fetchTopics = async (): Promise<Topic[]> => {
        try {
            const topics = await invoke<Topic[]>('list_topics');
            return topics.map(topic => ({
                ...topic,
            }));
        } catch (error) {
            console.error('Failed to fetch topics:', error);
            toast.error('Failed to fetch topics');
            return [];
        }
    };

    const getTicketForTopic = async (topicId: string): Promise<string> => {
        console.log(topicId);
        try {
            const ticket = await invoke<string>('get_ticket_for_topic', { topicId });
            toast.success('Topic invitation ticket generated');
            return ticket;
        } catch (error) {
            console.error('Failed to get ticket for topic:', error);
            toast.error('Failed to generate invitation ticket');
            return '';
        }
    };

    return (
        <TopicContext.Provider
            value={{
                currentTopic,
                joinTopic,
                leaveTopic,
                createTopic,
                joinTopicWithTicket,
                joinTopicWithId,
                fetchTopics,
                getTicketForTopic,
            }}
        >
            {children}
        </TopicContext.Provider>
    );
};

export const useTopic = () => {
    const context = useContext(TopicContext);
    if (!context) {
        throw new Error('useTopic must be used within a TopicProvider');
    }
    return context;
};
