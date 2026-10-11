import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function AuthCard() {
  const { colors } = useTheme();
  const { loading, loginWithEmail, loginWithGoogle, registerWithEmail } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('test@napo.local');
  const [password, setPassword] = useState('password123');
  const [displayName, setDisplayName] = useState('Test User');
  const [error, setError] = useState(null);

  async function submit() {
    setError(null);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, displayName);
      }
    } catch (exception) {
      setError(exception.message);
    }
  }

  async function submitGoogle() {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (exception) {
      setError(exception.message);
    }
  }

  return (
    <View style={styles.shell}>
      <View style={[styles.logo, { backgroundColor: colors.text }]}>
        <Text style={[styles.logoText, { color: colors.background }]}>N</Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>NAPO</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>Chatul tau pentru remindere si recurente.</Text>

      <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}> 
        <Pressable
          onPress={() => setMode('login')}
          style={[styles.segmentButton, mode === 'login' && { backgroundColor: colors.surface }]}
        >
          <Text style={[styles.segmentText, { color: mode === 'login' ? colors.text : colors.muted }]}>Login</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('register')}
          style={[styles.segmentButton, mode === 'register' && { backgroundColor: colors.surface }]}
        >
          <Text style={[styles.segmentText, { color: mode === 'register' ? colors.text : colors.muted }]}>Create</Text>
        </Pressable>
      </View>

      {mode === 'register' ? (
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          placeholderTextColor={colors.muted}
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        />
      ) : null}

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.muted}
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor={colors.muted}
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
      />

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <Pressable onPress={submit} disabled={loading} style={[styles.primaryButton, { backgroundColor: colors.text }, loading && styles.disabled]}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={[styles.primaryButtonText, { color: colors.background }]}>
            {mode === 'login' ? 'Continua' : 'Creeaza cont'}
          </Text>
        )}
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.muted }]}>sau</Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      </View>

      <Pressable
        onPress={submitGoogle}
        disabled={loading}
        style={[styles.googleButton, { borderColor: colors.border, backgroundColor: colors.surface }, loading && styles.disabled]}
      >
        <Text style={[styles.googleMark, { color: colors.text }]}>G</Text>
        <Text style={[styles.googleButtonText, { color: colors.text }]}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 8,
    padding: 20,
    gap: 12,
  },
  logo: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  segment: {
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    paddingVertical: 9,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  googleButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  googleMark: {
    fontSize: 18,
    fontWeight: '900',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  error: {
    fontSize: 14,
    lineHeight: 19,
  },
  disabled: {
    opacity: 0.72,
  },
});
