
export interface UserInfo {
    email: string;
    firstName: string;
    lastName?: string;
    nodeId: string;
}

export interface Topic {
    id: number;
    topicId: string; // For frontend compatibility
    name: string;
    owner: string;
    members: string[] | null;
}

export interface SharedFile {
    id: number;
    nodeId: string;
    topicId: string;
    hash: string;
    name: string;
    format: string;
    size: number;
    status: string;
    sharedAt: number;
    sender: string;
}

export interface Message {
    content: string;
    sender: string;
    firstName?: string;
    timestamp: number;
}

export interface Member {
    nodeId: string;
    firstName: string;
    lastName?: string;
    lastSeen: number;
    isActive: boolean;
}

export interface Node {
    id: number;
    nodeId: string;
    secretKey?: string;
}