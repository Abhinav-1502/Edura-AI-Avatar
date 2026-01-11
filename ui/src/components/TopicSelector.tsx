import React, { useEffect, useState } from 'react';
import { ApiClient } from '../services/ApiClient';
import type { Topic } from '../services/ApiClient';

interface Props {
    onSelect: (topic: Topic) => void;
}

export const TopicSelector: React.FC<Props> = ({ onSelect }) => {
    const [topics, setTopics] = useState<Topic[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTopics = async () => {
             try {
                 const data = await ApiClient.getTopics();
                 setTopics(data);
             } catch (e) {
                 console.error("Failed to fetch topics", e);
             } finally {
                 setIsLoading(false);
             }
        };
        fetchTopics();
    }, []);

    if (isLoading) return <div className="text-center p-4">Loading topics...</div>;

    return (
        <div className="glass-panel" style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '20px', fontWeight: 300 }}>Select a Lesson Topic</h2>
            <div style={{ display: 'grid', gap: '15px' }}>
                {topics.map(topic => (
                    <button
                        key={topic.id}
                        onClick={() => onSelect(topic)}
                        className="btn-primary"
                        style={{ 
                            background: 'rgba(255,255,255,0.05)', 
                            border: '1px solid rgba(255,255,255,0.1)',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <span>{topic.title}</span>
                        <span style={{ opacity: 0.5 }}>→</span>
                    </button>
                ))}
            </div>
            {topics.length === 0 && <p>No topics found. Please check backend configuration.</p>}
        </div>
    );
};
