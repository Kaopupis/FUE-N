
export enum RecoveryState {
  Depleted = 'Depleted',
  Overloaded = 'Overloaded',
  Flat = 'Flat',
  Stable = 'Stable',
  Recharging = 'Recharging'
}

export enum ActionType {
  Rest = 'Rest',
  Calm = 'Calm',
  Connect = 'Connect',
  Move = 'Move',
  Express = 'Express'
}

export interface CheckIn {
  id: string;
  date: string;
  energy: number;
  sleep: number;
  stress: number;
  social: number;
  clarity: number;
  journal: string;
}

export interface Recommendation {
  state: RecoveryState;
  actionType: ActionType;
  title: string;
  description: string;
  durationMinutes: number;
  explanation: string;
  affirmation: string;
}

export interface UserProfile {
  name: string;
  timezone: string;
  language: string;
}

export interface WeeklyInsight {
  patterns: string;
  triggers: string;
  helpfulActions: string;
}
