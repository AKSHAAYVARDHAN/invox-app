
import React from 'react';

const HomePage = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-teal-500 via-orange-400 to-brown-600 opacity-20 filter blur-3xl"></div>
            <div className="relative z-10">
                <h1 className="text-6xl font-bold text-invox-red mb-4">Invox</h1>
                <p className="text-2xl text-invox-light-gray mb-8">Fuel Curiosity, Expand Consciousness</p>
                <div className="bg-invox-dark-accent p-6 rounded-lg border border-gray-800 max-w-2xl mx-auto text-left">
                    <h2 className="text-2xl font-semibold text-white mb-3">Welcome to Invox</h2>
                    <p className="text-gray-300">
                        This is a dynamic platform that empowers curious minds to connect, engage, and share ideas.
                        It's a robust hub for thought-sharing and networking with like-minded comrades.
                        Use the navigation to explore different sections of the app.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
