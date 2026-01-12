import React from 'react';
import '../styles/ExampleDisplay.css';

interface Props {
    text: string;
}

export const ExampleDisplay: React.FC<Props> = ({ text }) => {
    if (!text) return null;

    return (
        <div className="glass-panel example-display-container">
            <div className="example-text-container">
                <span className="quote-mark quote-mark-start">
                    "
                </span>
                {text}
                <span className="quote-mark quote-mark-end">
                    "
                </span>
            </div>
        </div>
    );
};
