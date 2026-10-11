import { Platform } from 'react-native';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Platform.select({
    android: 'http://10.0.2.2:8080',
    ios: 'http://localhost:8080',
    default: 'http://localhost:8080',
  });

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function register(email, password, displayName) {
  return request('/api/auth/register', {
    method: 'POST',
    body: { email, password, displayName },
  });
}

export function loginWithGoogle(idToken) {
  return request('/api/auth/google', {
    method: 'POST',
    body: { idToken },
  });
}

export function getCurrentUser(accessToken) {
  return request('/api/auth/me', { accessToken });
}

export function getReminders(accessToken) {
  return request('/api/reminders', { accessToken });
}

export function updateReminder(accessToken, reminder) {
  return request(`/api/reminders/${reminder.id}`, {
    method: 'PUT',
    accessToken,
    body: {
      title: reminder.title,
      description: reminder.description,
      remindAt: reminder.remindAt,
      timezone: reminder.timezone || 'Europe/Bucharest',
      status: reminder.status,
      recurrenceType: reminder.recurrenceType,
      recurrenceRule: reminder.recurrenceRule,
      preferredChannel: reminder.preferredChannel,
      messageToSend: reminder.messageToSend,
    },
  });
}

export function deleteReminder(accessToken, reminderId) {
  return request(`/api/reminders/${reminderId}`, {
    method: 'DELETE',
    accessToken,
  });
}

export function sendChatMessage(accessToken, conversationId, message) {
  return request('/api/chat/messages', {
    method: 'POST',
    accessToken,
    body: { conversationId, message },
  });
}
