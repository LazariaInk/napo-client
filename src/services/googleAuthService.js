import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '709245170508-sirjcgldlm09cl3jm4soaap0ts1438kc.apps.googleusercontent.com';

let configured = false;

export function configureGoogleSignIn() {
  if (configured) {
    return;
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ['email', 'profile'],
  });

  configured = true;
}

export async function getGoogleIdToken() {
  configureGoogleSignIn();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();

  if (response?.type === 'cancelled') {
    throw createGoogleAuthError('Autentificarea Google a fost anulata.');
  }

  const responseIdToken = response?.data?.idToken || response?.idToken;

  if (responseIdToken) {
    return responseIdToken;
  }

  const tokens = await GoogleSignin.getTokens().catch(() => null);

  if (tokens?.idToken) {
    return tokens.idToken;
  }

  throw createGoogleAuthError('Google nu a returnat un idToken pentru autentificare.');
}

export function getGoogleAuthErrorMessage(error) {
  if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
    return 'Autentificarea Google a fost anulata.';
  }

  if (error?.code === statusCodes.IN_PROGRESS) {
    return 'Autentificarea Google este deja in curs.';
  }

  if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services nu este disponibil sau trebuie actualizat.';
  }

  return error?.message || 'Autentificarea Google a esuat.';
}

function createGoogleAuthError(message) {
  const error = new Error(message);
  error.isGoogleAuthError = true;
  return error;
}
