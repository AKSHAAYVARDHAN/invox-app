import React from 'react';

const ComingSoonPage = ({ pageName, subtitle }: { pageName: string; subtitle?: string }) => {
    return (
        <div className="flex items-center justify-center h-full p-4 text-center">
            <div>
                <h1 className="text-4xl font-bold text-white mb-2">{pageName}</h1>
                <p className="text-xl text-invox-light-gray">This section is coming soon!</p>
                {subtitle && <p className="text-lg text-invox-light-gray mt-4">{subtitle}</p>}
            </div>
        </div>
    );
};

export default ComingSoonPage;
