import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserEmail, updateUserPassword } from '../services/authService';
import { COLLECTIONS, updateDocument } from '../services/firestoreService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

const SettingsPage = () => {
    const { currentUser, userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('Profile');
    
    // Account form
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [accountLoading, setAccountLoading] = useState(false);
    const [accountMessage, setAccountMessage] = useState({ type: '', text: '' });

    // Profile form
    const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
    const [username, setUsername] = useState(userProfile?.username || '');
    const [headline, setHeadline] = useState(userProfile?.headline || '');
    const [bio, setBio] = useState(userProfile?.bio || '');
    const [skillsInput, setSkillsInput] = useState(userProfile?.skills?.join(', ') || '');
    const [interestsInput, setInterestsInput] = useState(userProfile?.interests?.join(', ') || '');
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

    const handleAccountSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setAccountLoading(true);
        setAccountMessage({ type: '', text: '' });
        
        try {
            if (newEmail) {
                await updateUserEmail(currentUser, newEmail);
            }
            if (newPassword) {
                // Client-side password strength validation
                const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
                if (!passwordRegex.test(newPassword)) {
                    throw new Error("Password must be at least 8 characters long and include a number and a special character.");
                }
                await updateUserPassword(currentUser, newPassword);
            }
            setAccountMessage({ type: 'success', text: 'Account updated successfully.' });
            setNewEmail('');
            setNewPassword('');
        } catch (err: any) {
            setAccountMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
            // If they need to re-authenticate
            if (err.code === 'auth/requires-recent-login') {
                 setAccountMessage({ type: 'error', text: 'This operation is sensitive and requires recent authentication. Please log out and log in again before trying this request.' });
            }
        }
        setAccountLoading(false);
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setProfileLoading(true);
        setProfileMessage({ type: '', text: '' });

        try {
            const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
            const interests = interestsInput.split(',').map(s => s.trim()).filter(Boolean);

            await updateDocument(COLLECTIONS.users, currentUser.uid, {
                displayName,
                username,
                headline,
                bio,
                skills,
                interests,
            });
            setProfileMessage({ type: 'success', text: 'Profile updated successfully.' });
        } catch (err: any) {
             setProfileMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
        }
        setProfileLoading(false);
    };

    return (
        <div className="text-white">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>
            
            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Tabs */}
                <div className="md:w-1/4">
                    <nav className="flex flex-col space-y-2">
                        {['Profile', 'Account', 'Privacy'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`text-left py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                                    activeTab === tab
                                        ? 'bg-invox-dark-accent border border-gray-700 text-white'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="md:w-3/4 bg-invox-dark-accent p-6 md:p-8 rounded-lg border border-gray-800">
                    {activeTab === 'Profile' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Edit Profile</h2>
                            {profileMessage.text && (
                                <p className={`mb-4 p-3 rounded-md ${profileMessage.type === 'success' ? 'bg-green-900 text-white' : 'bg-red-900 text-white'}`}>
                                    {profileMessage.text}
                                </p>
                            )}
                            <form onSubmit={handleProfileSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-invox-light-gray mb-2">Display Name</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-invox-light-gray mb-2">Username</label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-invox-light-gray mb-2">Headline</label>
                                    <input
                                        type="text"
                                        value={headline}
                                        onChange={(e) => setHeadline(e.target.value)}
                                        placeholder="Software Engineer at Tech Corp"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-invox-light-gray mb-2">Bio</label>
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        rows={4}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-invox-light-gray mb-2">Skills (comma separated)</label>
                                    <input
                                        type="text"
                                        value={skillsInput}
                                        onChange={(e) => setSkillsInput(e.target.value)}
                                        placeholder="React, Node.js, Design"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-invox-light-gray mb-2">Interests (comma separated)</label>
                                    <input
                                        type="text"
                                        value={interestsInput}
                                        onChange={(e) => setInterestsInput(e.target.value)}
                                        placeholder="AI, Startups, Open Source"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                    />
                                </div>
                                <button type="submit" disabled={profileLoading} className="bg-invox-red text-white px-6 py-3 rounded-md font-bold hover:bg-invox-red-hover disabled:bg-gray-500 transition-all">
                                    {profileLoading ? 'Saving...' : 'Save Profile'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'Account' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Account Settings</h2>
                            <p className="text-gray-400 mb-6">Current Email: <span className="text-white font-semibold">{currentUser?.email}</span></p>
                            
                            {accountMessage.text && (
                                <p className={`mb-4 p-3 rounded-md ${accountMessage.type === 'success' ? 'bg-green-900 text-white' : 'bg-red-900 text-white'}`}>
                                    {accountMessage.text}
                                </p>
                            )}

                            <form onSubmit={handleAccountSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-invox-light-gray mb-2">New Email</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        placeholder="Leave blank to keep current email"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-invox-light-gray mb-2">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Leave blank to keep current password"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                    />
                                </div>
                                <button type="submit" disabled={accountLoading || (!newEmail && !newPassword)} className="bg-invox-red text-white px-6 py-3 rounded-md font-bold hover:bg-invox-red-hover disabled:bg-gray-500 transition-all">
                                    {accountLoading ? 'Updating...' : 'Update Account'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'Privacy' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Privacy & Security</h2>
                            <p className="text-gray-400 mb-4">Manage how your data is shared and who can see your activity.</p>
                            <div className="bg-gray-800 p-4 rounded-md border border-gray-700 text-center text-gray-500">
                                <p>Privacy settings are coming soon.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
