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
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h2>Welcome to CrewCast</h2>
                    <p>Please provide your information to get started</p>
                </div>

                <form onSubmit={handleSubmit} className="registration-form">
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={userInfo.email}
                            onChange={(e) => setUserInfo(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="firstName">First Name</label>
                        <input
                            id="firstName"
                            type="text"
                            value={userInfo.firstName}
                            onChange={(e) => setUserInfo(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="Enter your first name"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="lastName">Last Name (optional)</label>
                        <input
                            id="lastName"
                            type="text"
                            value={userInfo.lastName}
                            onChange={(e) => setUserInfo(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder="Enter your last name"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary">Register</button>
                </form>
            </div>
        </div>
    );
};

export default UserRegistrationModal;
