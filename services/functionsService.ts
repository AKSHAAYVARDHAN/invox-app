import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export const callFunction = async <RequestData, ResponseData>(name: string, data: RequestData) => {
    const callable = httpsCallable<RequestData, ResponseData>(functions, name);
    const result = await callable(data);
    return result.data;
};

export const createNotification = <T extends Record<string, unknown>>(payload: T) =>
    callFunction<T, { id: string }>('createNotification', payload);

export const recalculateReputation = (uid: string) =>
    callFunction<{ uid: string }, { ok: boolean }>('recalculateReputation', { uid });

export const generateTrendSummary = (trendId: string) =>
    callFunction<{ trendId: string }, { summary: string }>('generateTrendSummary', { trendId });
