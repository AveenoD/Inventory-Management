import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, EyeOff } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { colors, radii, spacing } from "@/theme/tokens";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await api.login({ email: email.trim(), password });
      await login(res.token);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.box}>
          <Text style={styles.brand}>SK Mobile Shop</Text>
          <Text style={styles.sub}>Sign in to your dashboard</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="owner@skmobile.local"
            placeholderTextColor={colors.muted}
          />

          <Text style={[styles.label, styles.labelGap]}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
            />
            <Pressable
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff size={20} color={colors.muted} />
              ) : (
                <Eye size={20} color={colors.muted} />
              )}
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading || !email || !password}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Sign in</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1, justifyContent: "center", padding: spacing.xl },
  box: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  brand: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  sub: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.muted,
    fontSize: 15,
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  labelGap: { marginTop: spacing.md },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 44 },
  eyeBtn: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    padding: 4,
  },
  error: {
    marginTop: spacing.md,
    color: colors.red,
    fontSize: 14,
  },
  btn: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radii.input,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
