import React, { useContext, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { colors, radius, shadows, spacing } from '../theme/theme';

const SignUpScreen: React.FC = () => {
  const navigation = useNavigation();
  const { signUp } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const insets = useSafeAreaInsets();

  const handle = async () => {
    await signUp(email, password, name);
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
            <Text style={styles.kicker}>JOIN US</Text>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Start building beautiful itineraries in minutes
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Display name</Text>
            <Text style={styles.hint}>This will be shown publicly in the community</Text>
            <View style={styles.inputWrap}>
              <Icon name="user" size={18} color={colors.muted} />
              <TextInput
                placeholder="How you'll appear to others"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

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
                placeholder="Create a password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handle} activeOpacity={0.9}>
              <LinearGradient
                colors={[colors.primary, '#7985FF']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>
              Already have an account?{' '}
              <Text style={styles.linkAccent}>Sign In</Text>
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
  hint: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 8,
    marginTop: -4,
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

export default SignUpScreen;
