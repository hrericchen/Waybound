import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
  Alert,
  AppState,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as GoogleAuth from 'expo-auth-session/providers/google';
import { Icon } from '../components/Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';
import { getFirebaseAuth } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import storageService from '../services/storageService';
import { configureGoogleSignIn, GOOGLE_WEB_CLIENT_ID } from '../services/googleSignIn';
import { GOOGLE_OAUTH_REDIRECT_URL } from '../config/api';

// Handles the redirect back from the browser when the web OAuth flow is used.
WebBrowser.maybeCompleteAuthSession();

/**
 * Wraps GoogleSignin.signIn() and detects the "no Google account on the
 * device" case: Play Services opens its account-add flow in the browser and,
 * if that browser can't return to the app (no Chrome / China-ROM default
 * browser), the promise never resolves and the user is stuck.
 *
 * We watch AppState: when the native sign-in UI backgrounds the app and the
 * app comes back to the foreground WITHOUT a result within a short grace
 * period, we reject with a `WEB_FALLBACK` error so handleGoogle switches to
 * the browser-based Google OAuth flow instead of leaving the user stuck.
 */
const runNativeGoogleSignIn = () =>
  new Promise<any>((resolve, reject) => {
    let settled = false;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || settled) return;
      setTimeout(() => {
        if (settled) return;
        settled = true;
        sub.remove();
        const err = new Error('Native Google sign-in did not complete.') as any;
        err.code = 'WEB_FALLBACK';
        reject(err);
      }, 800);
    });
    GoogleSignin.signIn()
      .then((r) => {
        if (settled) return;
        settled = true;
        sub.remove();
        resolve(r);
      })
      .catch((e) => {
        if (settled) return;
        settled = true;
        sub.remove();
        reject(e);
      });
  });

const SignInScreen: React.FC = () => {
  const { signIn, signInWithGoogle } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Browser-based Google OAuth (fallback). Used when the native Google Sign-In
  // SDK can't run — e.g. no Google Play Services, or no Google account added at
  // the OS level. The user signs in in the browser, which needs Chrome (or any
  // Chrome-Custom-Tabs-capable browser) installed to hand back to the app. The
  // redirect goes through the backend's /oauth2redirect bounce because Google
  // only accepts HTTP(S) redirect URIs on the Web OAuth client.
  const [, , googlePromptAsync] = GoogleAuth.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: GOOGLE_OAUTH_REDIRECT_URL,
  });

  const handle = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/invalid-email') || msg.includes('auth/user-not-found')) {
        setError('Incorrect email or password. Please try again.');
      } else if (msg.includes('Invalid email or password')) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(msg || 'Sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address first.');
      return;
    }
    try {
      const firebaseAuth = getFirebaseAuth();
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      Alert.alert('Email Sent', 'If an account exists for ' + email.trim() + ', a password reset link has been sent. Check your inbox!');
    } catch (e: any) {
      console.warn('Password reset error:', e?.code || e);
      if (e?.code === 'auth/user-not-found') {
        Alert.alert('Not Found', 'No account found with that email. Please sign up first.');
      } else if (e?.code === 'auth/too-many-requests') {
        Alert.alert('Too Many Requests', 'Please wait a moment before trying again.');
      } else if (e?.code === 'auth/invalid-email') {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
      } else {
        // Show the real Firebase error code so you can diagnose what's wrong
        Alert.alert('Error', `Failed to send password reset email (${e?.code || 'unknown error'}).\n\n${e?.message || 'Please check your network connection and ensure Email/Password sign-in is enabled in the Firebase Console.'}`);
      }
    }
  };

  // Google Sign-In via the native Google Sign-In SDK (Google Play Services).
  // The native SDK shows the account picker natively and hands back an idToken
  // that we exchange with Firebase in authService.signInWithGoogle. If the
  // native flow can't run (no Play Services / no OS-level Google account), we
  // fall back to the browser-based Google OAuth in handleGoogle below.
  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      let idToken: string | undefined;
      let profile: { id?: string; email?: string; name?: string } | undefined;

      // 1) Prefer the native Google Sign-In SDK (Google Play Services). This is
      // the smoothest flow, but it needs Play Services and works most reliably
      // when the device has a Google account added at the OS level.
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        // Make sure the SDK is configured before touching it (the useEffect
        // also configures, but the user may tap before it finishes).
        await configureGoogleSignIn();
        // If Google's native SDK still remembers a previously used account (an
        // earlier session, or an app sign-out from before the SDK was cleared),
        // drop it so signIn() shows the account chooser instead of silently
        // re-signing into the old account.
        if (GoogleSignin.hasPreviousSignIn()) {
          await GoogleSignin.signOut();
        }
        const userInfo = await runNativeGoogleSignIn();
        if (userInfo.type !== 'success') {
          // User cancelled the account picker — not an error, no fallback.
          return;
        }
        idToken = userInfo.data.idToken || undefined;
        profile = {
          id: userInfo.data.user?.id || undefined,
          email: userInfo.data.user?.email || undefined,
          name: userInfo.data.user?.name || undefined,
        };
      } catch (nativeErr: any) {
        if (nativeErr?.code === statusCodes.SIGN_IN_CANCELLED) {
          // User cancelled — don't bounce them into the browser.
          return;
        }
        // 2) The native flow can't run (no Play Services, no OS-level Google
        // account, certificate mismatch, ...). Fall back to browser-based
        // Google OAuth, which works without any account added at the OS level.
        console.warn(
          'Native Google sign-in unavailable, using web OAuth fallback:',
          nativeErr?.code || nativeErr
        );
        const res = await googlePromptAsync();
        if (res?.type !== 'success') {
          if (res?.type === 'cancel' || res?.type === 'dismiss') {
            // User cancelled the web flow — not an error.
            return;
          }
          throw new Error(
            (res as any)?.error?.message || 'Google sign-in was not completed. Please try again.'
          );
        }
        idToken =
          (res.params?.id_token as string | undefined) ||
          ((res as any)?.authentication?.idToken as string | undefined);
        if (!idToken) {
          throw new Error('No Google ID token was returned. Please try again.');
        }
      }

      if (!idToken) return;

      await signInWithGoogle?.({
        idToken,
        profile,
      });
      // First Google sign-in: queue the intro paywall (shown after the home
      // tour) and let the Home screen offer a display-name picker (the
      // WB_DISPLAY_NAME_SET flag is left unset on purpose for Google users).
      try {
        const stored = await storageService.load(storageService.STORAGE_KEYS.USER);
        if (stored?.id) {
          const chosen = await storageService.load(`WB_DISPLAY_NAME_SET_${stored.id}`);
          if (!chosen) {
            await storageService.save('WB_INTRO_PAYWALL_PENDING', true);
          }
        }
      } catch (e) {
        console.warn('[SignIn] Failed to queue intro paywall:', e);
      }
    } catch (e: any) {
      console.warn('Google sign-in failed', e);
      if (e?.name === 'AccountSuspendedError') {
        // Server-side moderation: surface the suspension message directly.
        setError(e?.message || 'Your account has been suspended.');
      } else if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the account picker — not an error.
      } else if (e?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services are not available on this device.');
      } else if (e?.code === '10' || (e?.message && e.message.includes('DEVELOPER_ERROR'))) {
        setError(
          'Google sign-in is not configured for this build yet.\n\nAdd the app\'s SHA-1 certificate fingerprint to your Firebase project (see the "fingerprint" troubleshooting step), then rebuild.'
        );
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="back" size={22} color={colors.text} />
          </TouchableOpacity>

           <View style={styles.hero}>
             <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.kicker}>WELCOME BACK</Text>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>Continue planning your next great journey</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Icon name="user" size={18} color={colors.muted} />
              <TextInput
                placeholder="you@email.com"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Icon name="check" size={18} color={colors.muted} />
              <TextInput
                placeholder="Your password"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(prev => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgot} onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {error ? (
              <View style={styles.errorBox}>
                <Icon name="warning" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.button} onPress={handle} activeOpacity={0.9} disabled={loading}>
              <LinearGradient
                colors={[colors.primary, '#7985FF']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={styles.google}
              onPress={handleGoogle}
              disabled={loading}
              activeOpacity={0.9}
            >
              <Image source={require('../../assets/googlelogo.png')} style={styles.googleLogo} resizeMode="contain" />
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.link}
            onPress={() => (navigation as any).navigate('SignUp')}
          >
            <Text style={styles.linkText}>
              Don't have an account?{' '}
              <Text style={styles.linkAccent}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.xl,
    flexGrow: 1,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  hero: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  kicker: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    ...shadows.card,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    marginBottom: spacing.lg,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginBottom: spacing.xl,
    marginTop: -8,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    marginTop: 4,
    overflow: 'hidden',
    ...shadows.fab,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
    gap: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 14,
    borderRadius: radius.full,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  googleText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  link: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  linkText: {
    color: colors.muted,
    fontSize: 14,
  },
  linkAccent: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.md,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});

export default SignInScreen;