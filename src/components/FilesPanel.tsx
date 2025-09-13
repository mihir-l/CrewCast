import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'react-toastify';
import { SharedFile } from '../types/interfaces';
import { useUser } from '../contexts/UserContext';

interface FilesPanelProps {
    topicId: string;
}

const FilesPanel: React.FC<FilesPanelProps> = ({ topicId }) => {
    const [files, setFiles] = useState<SharedFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState<Record<number, boolean>>({});
    const [downloadProgress, setDownloadProgress] = useState<Record<number, number>>({});
    const { currentUser } = useUser();

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
            console.log('Loaded files:', enhancedFiles);
            console.log('Current user nodeId:', currentUser?.nodeId);
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
                // Find file by name and update progress
                const fileId = files.find(f => f.name === parsedMessage.fileName)?.id;
                if (fileId && typeof parsedMessage.percentage === 'number') {
                    setDownloadProgress(prev => ({
                        ...prev,
                        [fileId]: parsedMessage.percentage
                    }));
                    // Remove progress when complete
                    if (parsedMessage.percentage === 100) {
                        setTimeout(() => {
                            setDownloadProgress(prev => {
                                const updated = { ...prev };
                                delete updated[fileId];
                                return updated;
                            });
                            setDownloading(prev => {
                                const updated = { ...prev };
                                delete updated[fileId];
                                return updated;
                            });
                            loadFiles();
                        }, 1000);
                    }
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
                <h1 className="files-title">Shared Files</h1>
                <button onClick={handleShareFile} className="share-file-btn">
                    Share a File
                </button>
            </div>

            {loading ? (
                <div className="files-empty">
                    <div className="files-empty-icon">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </div>
                    <p className="files-empty-text">Loading files...</p>
                </div>
            ) : files.length === 0 ? (
                <div className="files-empty">
                    <div className="files-empty-icon">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p className="files-empty-text">No files have been shared in this topic yet</p>
                    <button onClick={handleShareFile} className="share-file-btn">
                        Share the First File
                    </button>
                </div>
            ) : (
                <div className="files-list scrollable-files-list">
                    {files.map((file) => (
                        <div key={file.id} style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '0.75rem',
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--hover)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--surface)';
                            }}>
                            {/* File Icon */}
                            <div style={{
                                width: '2.5rem',
                                height: '2.5rem',
                                background: 'var(--primary)',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <svg style={{ width: '1.25rem', height: '1.25rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>

                            {/* File Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: 'var(--text)',
                                    margin: '0 0 0.25rem 0',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {file.name}
                                </h3>
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--textSecondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <span>{formatFileSize(file.size)}</span>
                                    <span>•</span>
                                    <span>{file.sender || 'Unknown'}</span>
                                    <span>•</span>
                                    <span>{new Date(file.sharedAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>

                            {/* Status and Progress */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                                {downloading[file.id] && downloadProgress[file.id] !== undefined ? (
                                    <>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            minWidth: '4rem'
                                        }}>
                                            <div style={{
                                                width: '3rem',
                                                height: '0.25rem',
                                                background: 'var(--border)',
                                                borderRadius: '0.125rem',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: `${downloadProgress[file.id]}%`,
                                                    height: '100%',
                                                    background: 'var(--primary)',
                                                    transition: 'width 0.2s ease'
                                                }} />
                                            </div>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--textSecondary)',
                                                fontWeight: '600'
                                            }}>
                                                {downloadProgress[file.id].toFixed(0)}%
                                            </span>
                                        </div>
                                    </>
                                ) : file.status === 'Downloaded' ? (
                                    <div style={{
                                        width: '1.5rem',
                                        height: '1.5rem',
                                        background: 'var(--success)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <svg style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                ) : file.nodeId === currentUser?.nodeId ? (
                                    <div style={{
                                        width: '1.5rem',
                                        height: '1.5rem',
                                        background: 'var(--warning)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <svg style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                ) : (
                                    <div style={{
                                        width: '1.5rem',
                                        height: '1.5rem',
                                        background: 'var(--primary)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <svg style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                )}

                                {/* Download Button */}
                                {file.nodeId !== currentUser?.nodeId &&
                                    file.status !== 'Downloaded' &&
                                    !downloading[file.id] && (
                                        <button
                                            onClick={() => handleDownloadFile(file)}
                                            style={{
                                                background: 'var(--primary)',
                                                border: 'none',
                                                color: 'white',
                                                cursor: 'pointer',
                                                padding: '0.5rem',
                                                borderRadius: '0.375rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'opacity 0.2s ease'
                                            }}
                                            title="Download file"
                                        >
                                            <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </button>
                                    )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FilesPanel;
