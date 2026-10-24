import { type AuthData, type Env, json } from '../../../server/auth';

export const onRequestGet: PagesFunction<Env, string, AuthData> = async ({ data }) => json({ user: data.user });
