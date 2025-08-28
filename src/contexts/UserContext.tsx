import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'react-toastify';
import { Node, UserInfo } from '../types/interfaces';

interface UserContextType {
    currentUser: UserInfo | null;
    currentNode: Node | null;
    isLoading: boolean;
    isRegistered: boolean;
    registerUser: (userInfo: Omit<UserInfo, 'nodeId'>) => Promise<void>;
    checkRegistration: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
    const [currentNode, setCurrentNode] = useState<Node | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegistered, setIsRegistered] = useState(false);

    const checkRegistration = async () => {
        setIsLoading(true);
        try {
            // Get the node first
            const node = await invoke<Node>('get_node_by_id', { id: 1 });
            setCurrentNode(node);

            try {
                // Then check if user exists for this node
                const user = await invoke<UserInfo>('get_user_by_node_id', { nodeId: node.nodeId });
                setCurrentUser({
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    nodeId: node.nodeId
                });
                setIsRegistered(true);
            } catch (error) {
                // User doesn't exist
                setIsRegistered(false);
            }
        } catch (error) {
            console.error('Failed to check registration:', error);
            toast.error('Failed to initialize application');
        } finally {
            setIsLoading(false);
        }
    };

    const registerUser = async (userInfo: Omit<UserInfo, 'nodeId'>) => {
        if (!currentNode) {
            toast.error('No node initialized');
            return;
        }

        try {
            await invoke('create_user', {
                user: {
                    ...userInfo,
                    nodeId: currentNode.nodeId,
                },
            });

            setCurrentUser({
                ...userInfo,
                nodeId: currentNode.nodeId
            });

            setIsRegistered(true);
            toast.success('User registered successfully!');
        } catch (error) {
            console.error('Failed to register user:', error);
            toast.error('Failed to register user');
        }
    };

    useEffect(() => {
        checkRegistration();
    }, []);

    return (
        <UserContext.Provider
            value={{
                currentUser,
                currentNode,
                isLoading,
                isRegistered,
                registerUser,
                checkRegistration,
            }}
        >
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
