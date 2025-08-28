import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'react-toastify';
import { SharedFile } from '../types/interfaces';

interface FilesPanelProps {
    topicId: string;
}

const FilesPanel: React.FC<FilesPanelProps> = ({ topicId }) => {
    const [files, setFiles] = useState<SharedFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState<Record<number, boolean>>({});

    const loadFiles = async () => {
        setLoading(true);
        try {
            console.log('Fetching files for topic:', topicId);
            const fetchedFiles = await invoke<SharedFile[]>('list_files', { topicId: topicId });

            // Add sender name if possible
            const enhancedFiles = await Promise.all(
                fetchedFiles.map(async (file) => {
                    try {
                        const user = await invoke<{ firstName: string }>('get_user_by_node_id', {
                            nodeId: file.nodeId
                        });
                        return { ...file, sender: user.firstName };
                    } catch (error) {
                        return file;
                    }
                })
            );

            setFiles(enhancedFiles);
        } catch (error) {
            console.error('Failed to load files for topic ID:', topicId, error);
            toast.error(`Could not load shared files: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (topicId && typeof topicId === 'string' && topicId.trim() !== '') {
            loadFiles();
        } else {
            console.warn('Invalid topicId provided to FilesPanel:', topicId);
            setLoading(false);
        }

        // Listen for new file shares
        const unlistenGossipMessage = listen('gossip-message', async (event) => {
            const message = event.payload as string;

            try {
                const parsedMessage = JSON.parse(message);

                if (parsedMessage.type === 'file' && parsedMessage.file) {
                    // Reload files when new file is shared
                    loadFiles();
                    toast.info(`New file shared: ${parsedMessage.file.file_name || parsedMessage.file.name}`);
                }
            } catch (error) {
                console.error('Failed to process file message:', error);
            }
        });

        // Listen for download progress
        const unlistenDownloadProgress = listen('download-progress', async (event) => {
            const progress = event.payload as string;

            try {
                const parsedMessage = JSON.parse(progress);
                console.log('Download progress received:', parsedMessage);

                // Update UI with progress
                toast.info(`${parsedMessage.fileName}: ${parsedMessage.percentage}%`);

                // If download is complete (100%), refresh the files list
                if (parsedMessage.percentage === 100) {
                    setTimeout(() => {
                        loadFiles();
                        setDownloading(prev => {
                            const updated = { ...prev };
                            // Find file by name and remove from downloading state
                            const fileId = files.find(f => f.name === parsedMessage.fileName)?.id;
                            if (fileId) delete updated[fileId];
                            return updated;
                        });
                    }, 1000);
                }
            } catch (error) {
                console.error('Failed to parse download progress:', error);
            }
        });

        return () => {
            unlistenGossipMessage.then(fn => fn());
            unlistenDownloadProgress.then(fn => fn());
        };
    }, [topicId]);

    const handleShareFile = async () => {
        try {
            const filePath = await open({
                multiple: false,
                filters: [{ name: 'All Files', extensions: ['*'] }]
            });

            if (filePath && typeof filePath === 'string') {
                await invoke('share_file', { filePath });
                toast.success('File shared successfully');
                loadFiles(); // Refresh the files list
            }
        } catch (error) {
            console.error('Failed to share file:', error);
            toast.error('Failed to share file');
        }
    };

    const handleDownloadFile = async (file: SharedFile) => {
        try {
            setDownloading(prev => ({ ...prev, [file.id]: true }));
            await invoke('download_file', { file });
            toast.success(`Started downloading: ${file.name}`);
        } catch (error) {
            console.error('Failed to download file:', error);
            toast.error('Failed to download file');
            setDownloading(prev => {
                const updated = { ...prev };
                delete updated[file.id];
                return updated;
            });
        }
    };

    // Format file size for better display
    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        const mb = kb / 1024;
        if (mb < 1024) return `${mb.toFixed(1)} MB`;
        const gb = mb / 1024;
        return `${gb.toFixed(1)} GB`;
    };

    return (
        <div className="files-panel">
            <div className="files-header">
                <h2>Shared Files</h2>
                <button onClick={handleShareFile} className="btn btn-primary">
                    Share a File
                </button>
            </div>

            {loading ? (
                <div className="loading">Loading files...</div>
            ) : files.length === 0 ? (
                <div className="no-files">
                    <p>No files have been shared in this topic yet</p>
                    <button onClick={handleShareFile} className="btn btn-primary">
                        Share the First File
                    </button>
                </div>
            ) : (
                <div className="files-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Size</th>
                                <th>Shared By</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map((file) => (
                                <tr key={file.id} className="file-item">
                                    <td>{file.name}</td>
                                    <td>{formatFileSize(file.size)}</td>
                                    <td>{file.sender}</td>
                                    <td>{new Date(file.sharedAt * 1000).toLocaleString()}</td>
                                    <td className={`status-${file.status.toLowerCase()}`}>
                                        {file.status}
                                    </td>
                                    <td>
                                        {file.status !== 'Downloaded' && !downloading[file.id] && (
                                            <button
                                                onClick={() => handleDownloadFile(file)}
                                                className="btn btn-sm btn-secondary"
                                            >
                                                Download
                                            </button>
                                        )}
                                        {downloading[file.id] && (
                                            <span className="downloading">Downloading...</span>
                                        )}
                                        {file.status === 'Downloaded' && (
                                            <span className="downloaded">✓ Downloaded</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default FilesPanel;
