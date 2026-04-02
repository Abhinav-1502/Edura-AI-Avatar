import React, { useEffect, useState } from 'react';
import { ApiClient } from '../services/ApiClient';
import type { Topic } from '../services/ApiClient';
import '../styles/TopicSelector.css';

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
        <div className="glass-panel topic-selector-container">
            <h2 className="topic-selector-title">Select a Lesson Topic</h2>
            <div className="topic-list">
                {topics.map(topic => (
                    <button
                        key={topic.id}
                        onClick={() => onSelect(topic)}
                        className="btn-primary topic-btn"
                    >
                        <span>{topic.title}</span>
                        <span className="topic-arrow">→</span>
                    </button>
                ))}
            </div>
            {topics.length === 0 && <p>No topics found. Please check backend configuration.</p>}
        </div>
    );
};
