import React from 'react';
import { Toaster } from 'react-hot-toast';
import './App.css';

const App = () => {
    return (
        <div className="app-container">
            <Toaster
                position="top-right"
                reverseOrder={false}
            />
            <header className="app-header">
                <h1 className="app-title">Welcome to Aura Pharmacy</h1>
            </header>
            <main className="app-content">
                <p className="app-description">Your health is our priority! Explore our services and products.</p>
            </main>
            <footer className="app-footer">
                <p className="footer-text">&copy; 2026 Aura Pharmacy. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default App;