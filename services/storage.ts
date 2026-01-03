
import { CheckIn, Recommendation } from '../types';

const STORAGE_KEYS = {
  CHECK_INS: 'fuen_checkins',
  RECOMMENDATIONS: 'fuen_recommendations',
  PROFILE: 'fuen_profile'
};

export const storage = {
  getCheckIns: (): CheckIn[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CHECK_INS);
    return data ? JSON.parse(data) : [];
  },
  saveCheckIn: (checkIn: CheckIn) => {
    const checkIns = storage.getCheckIns();
    const updated = [checkIn, ...checkIns].slice(0, 30); // Keep last 30 days
    localStorage.setItem(STORAGE_KEYS.CHECK_INS, JSON.stringify(updated));
  },
  getLatestRecommendation: (): Recommendation | null => {
    const data = localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS);
    const recs = data ? JSON.parse(data) : [];
    return recs.length > 0 ? recs[0] : null;
  },
  saveRecommendation: (rec: Recommendation) => {
    const recs = localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS);
    const existing = recs ? JSON.parse(recs) : [];
    localStorage.setItem(STORAGE_KEYS.RECOMMENDATIONS, JSON.stringify([rec, ...existing].slice(0, 30)));
  },
  clearAll: () => {
    localStorage.clear();
  }
};
