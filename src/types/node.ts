export interface Node {
    id: number;
    nodeId: string;  // Using snake_case as it matches the Rust backend
    secretKey?: string;
}