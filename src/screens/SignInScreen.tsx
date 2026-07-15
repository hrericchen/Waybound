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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';

WebBrowser.maybeCompleteAuthSession();

const SignInScreen: React.FC = () => {
  const { signIn, signInWithGoogle } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handle = async () => {
    await signIn(email, password);
  };

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: '<YOUR_EXPO_CLIENT_ID>',
    iosClientId: '<YOUR_IOS_CLIENT_ID>',
    androidClientId: '<YOUR_ANDROID_CLIENT_ID>',
    webClientId: '<YOUR_WEB_CLIENT_ID>',
    responseType: 'id_token',
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    const handleResponse = async () => {
      if (response?.type === 'success') {
        const { authentication } = response as any;
        const { accessToken, idToken } = authentication || {};
        let profile: any = { id: undefined, email: undefined, name: undefined };

        try {
          if (accessToken) {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            profile = await res.json();
          } else if (idToken) {
            const base64Url = idToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            try {
              const decodeBase64 = (input: string) => {
                if (typeof atob === 'function') return atob(input);
                if (typeof Buffer !== 'undefined') return Buffer.from(input, 'base64').toString('utf8');
                throw new Error('No base64 decoder available');
              };
              const decoded = JSON.parse(decodeBase64(base64));
              profile = { id: decoded.sub, email: decoded.email, name: decoded.name };
            } catch (innerErr) {
              console.warn('Failed to decode Google idToken payload', innerErr);
            }
          }

          await signInWithGoogle?.({ idToken, profile });
        } catch (e) {
          console.warn('Google sign-in failed', e);
        }
      }
    };
    handleResponse();
  }, [response, navigation, signInWithGoogle]);

  const handleGoogle = async () => {
    await promptAsync();
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
            <LinearGradient colors={[colors.primary, '#7985FF']} style={styles.logoBadge}>
              <Icon name="plane" size={22} color={colors.white} />
            </LinearGradient>
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
                secureTextEntry
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity style={styles.forgot}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handle} activeOpacity={0.9}>
              <LinearGradient
                colors={[colors.primary, '#7985FF']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={styles.google}
              onPress={handleGoogle}
              disabled={!request}
              activeOpacity={0.9}
            >
              <Icon name="google" size={18} color={colors.google} />
              <Text style={styles.googleText}>Google</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.link}
            onPress={() => navigation.navigate('SignUp' as any)}
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
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.fab,
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
});

export default SignInScreen;
