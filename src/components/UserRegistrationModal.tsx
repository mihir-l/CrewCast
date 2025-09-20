import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';

const UserRegistrationModal: React.FC = () => {
    const { registerUser } = useUser();
    const [userInfo, setUserInfo] = useState({
        email: '',
        firstName: '',
        lastName: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        registerUser(userInfo);
    };

    return (
        <div className="modern-modal-overlay">
            <div className="modern-modal-container">
                {/* Welcome Message */}
                <div className="welcome-section">
                    <h2 className="welcome-title">Welcome to CrewCast!</h2>
                    <p className="welcome-description">
                        Get started by creating your profile.
                    </p>
                </div>

                {/* Registration Form */}
                <form onSubmit={handleSubmit} className="modern-registration-form">
                    <div className="modern-form-group">
                        <label htmlFor="email" className="modern-label">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            value={userInfo.email}
                            onChange={(e) => setUserInfo(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="your@email.com"
                            className="modern-input"
                            required
                        />
                    </div>

                    <div className="modern-form-group">
                        <label htmlFor="firstName" className="modern-label">First Name</label>
                        <input
                            id="firstName"
                            type="text"
                            value={userInfo.firstName}
                            onChange={(e) => setUserInfo(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="Your first name"
                            className="modern-input"
                            required
                        />
                    </div>

                    <div className="modern-form-group">
                        <label htmlFor="lastName" className="modern-label">Last Name <span className="optional-text">(optional)</span></label>
                        <input
                            id="lastName"
                            type="text"
                            value={userInfo.lastName}
                            onChange={(e) => setUserInfo(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder="Your last name"
                            className="modern-input"
                        />
                    </div>

                    <button type="submit" className="modern-register-btn">
                        <span>Get Started</span>
                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UserRegistrationModal;
