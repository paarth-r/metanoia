// Metanoia mobile - thirty-day resets you run in public.
// Same Supabase backend as the web app; same stoic ledger design.
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, FlatList, StyleSheet,
  useColorScheme, ActivityIndicator, Alert, RefreshControl, SafeAreaView,
  StatusBar, Platform, Image, KeyboardAvoidingView,
} from 'react-native';
import { Share, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_500Medium_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  sb, TOTAL, QUOTES, HABIT_SUGGESTIONS, TARGET_SUGGESTIONS, PAARTH_PLAN,
  isoToday, dayNumOf, dateOfDay, fmtDay, weekOf, scoreOf, ago, planRowToObj,
  ledgerStats,
} from './lib';
import {
  isoTodayLocal, parseIsoLocal, resolveTodosForDate, todoCountsForDate,
  monthGrid, monthLabel, planDayOf, endDateForStop, dayHasMark,
  MONTH_NAMES, WEEKDAYS,
} from './todos-core';

/* A render throw in React Native unmounts the whole tree: no white screen of
   death to read, just a dead app that has to be force-quit. This keeps the
   crash on screen with a way out, and never blocks the user's data - the
   ledger lives on the server. */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  render() {
    const c = this.props.c;
    if (!this.state.err) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontFamily: SERIF, fontSize: 34, color: c.ink }}>Something broke</Text>
        <Text style={{ fontFamily: MONO, fontSize: 13, color: c.muted, lineHeight: 20, marginTop: 10 }}>
          This screen hit an error. Your ledger is safe on the server - nothing you ticked is lost.
          Try again, and if it keeps happening, tell Paarth what you were doing.
        </Text>
        <Text selectable style={{ fontFamily: MONO, fontSize: 10, color: c.muted, marginTop: 16 }}>
          {String(this.state.err && this.state.err.message).slice(0, 300)}
        </Text>
        <Pressable onPress={() => this.setState({ err: null })}
          style={{ marginTop: 22, borderWidth: 1.5, borderColor: c.leather, borderRadius: 999,
            paddingVertical: 13, alignItems: 'center' }}>
          <Text style={{ fontFamily: MONO_M, fontSize: 12, letterSpacing: 1.4,
            textTransform: 'uppercase', color: c.ink }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

/* ---------- theme ---------- */

/* Old leather ledger: parchment pages on a leather desk, sepia ink,
   stitched borders, muted gold hairlines. */
const LIGHT = {
  bg: '#EDE3CB', card: '#F8F2E1', ink: '#2B2013', muted: '#8A7657',
  line: '#D6C9A8', lineSoft: '#E5DBBE', danger: '#8E3B2C', paper: '#F8F2E1',
  leather: '#5E3B22', gold: '#A07C3B', stitch: '#C9B488', onLeather: '#F6EFDD',
};
const DARK = {
  bg: '#171008', card: '#211910', ink: '#EDE1C7', muted: '#9C8A6A',
  line: '#3A2E1E', lineSoft: '#2C2315', danger: '#C2604A', paper: '#171008',
  leather: '#7A4E2A', gold: '#B08D4F', stitch: '#57452C',
};
function useTheme() {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

const SERIF = 'CormorantGaramond_600SemiBold';
const SERIF_I = 'CormorantGaramond_500Medium_Italic';
const MONO = 'IBMPlexMono_400Regular';
const MONO_M = 'IBMPlexMono_500Medium';

/* ---------- small primitives ---------- */

function H2({ c, children }) {
  return (
    <Text style={{ fontFamily: MONO_M, fontSize: 11, letterSpacing: 2.4, color: c.muted, textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </Text>
  );
}
function Hint({ c, children, style }) {
  return <Text style={[{ fontFamily: MONO, fontSize: 12, color: c.muted, lineHeight: 19, marginBottom: 14 }, style]}>{children}</Text>;
}
function Card({ c, children, style }) {
  return (
    <View style={[{ backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 8, padding: 4, marginBottom: 20 }, style]}>
      <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: c.stitch, borderRadius: 5, padding: 14 }}>
        {children}
      </View>
    </View>
  );
}
function Btn({ c, label, onPress, ghost, small, disabled, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{
        backgroundColor: ghost ? 'transparent' : c.leather,
        borderWidth: 1.5, borderColor: c.leather, borderRadius: 5,
        paddingVertical: small ? 9 : 14, paddingHorizontal: small ? 14 : 24,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        fontFamily: MONO_M, fontSize: small ? 11 : 12, letterSpacing: 1.6,
        textTransform: 'uppercase', color: ghost ? c.ink : c.onLeather,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
function PageHeader({ c, eyebrow, title, right, sub }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {eyebrow ? (
        <Text style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: c.muted }}>{eyebrow}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{ fontFamily: SERIF, fontSize: 36, color: c.ink }}>{title}</Text>
        {right || null}
      </View>
      {sub ? <Text style={{ fontFamily: SERIF_I, fontSize: 17, color: c.muted, marginTop: 2 }}>{sub}</Text> : null}
      <View style={{ width: 54, height: 2, backgroundColor: c.gold, marginTop: 10 }} />
    </View>
  );
}
function Input({ c, style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={c.muted}
      style={[{
        fontFamily: MONO, fontSize: 14, color: c.ink, backgroundColor: c.card,
        borderWidth: 1, borderColor: c.line, paddingVertical: 10, paddingHorizontal: 12,
      }, style]}
      {...props}
    />
  );
}
function VTag({ c, v }) {
  return (
    <View style={{ borderWidth: 1, borderColor: c.line, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 }}>
      <Text style={{ fontFamily: MONO_M, fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', color: c.muted }}>{v}</Text>
    </View>
  );
}

/* ---------- ledger (shared editable / read-only) ---------- */

function CheckBoxMark({ c, on, size = 24 }) {
  return (
    <View style={{
      width: size, height: size, borderWidth: 2, borderColor: c.leather, borderRadius: 4,
      backgroundColor: on ? c.leather : 'transparent', alignItems: 'center', justifyContent: 'center',
    }}>
      {on ? <Text style={{ color: c.onLeather, fontSize: size * 0.6, fontFamily: MONO_M, lineHeight: size * 0.78 }}>x</Text> : null}
    </View>
  );
}

function Ledger({ c, plan, getDay, getWeek, onToggleDay, onToggleWeek, readOnly, sel, setSel }) {
  const { tn, upto, sum, perfect, streak, nH } = ledgerStats(plan, getDay);
  const day = sel != null ? sel : Math.max(1, Math.min(TOTAL, tn));
  const editable = !readOnly && tn >= 1 && day <= tn;
  const arr = getDay(day) || [];
  const sc = scoreOf(arr, nH);
  const q = QUOTES[(Math.max(1, Math.min(TOTAL, Math.max(tn, 1))) - 1) % QUOTES.length];
  const w = weekOf(Math.max(1, Math.min(TOTAL, day)));
  const wo = getWeek(w) || {};
  const wEditable = !readOnly && tn >= 1 && w <= weekOf(Math.max(1, Math.min(TOTAL, tn)));

  const stats = tn < 1
    ? [[String(1 - tn), 'days to start'], ['-', 'streak'], ['-', 'perfect']]
    : tn > TOTAL
      ? [['Done', 'thirty days'], [String(perfect), 'perfect days'], [(sum / TOTAL).toFixed(1), 'avg score']]
      : [[`Day ${tn}`, 'of 30'], [String(streak), 'streak'], [upto ? (sum / upto).toFixed(1) : '-', `avg /${nH}`]];

  return (
    <View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line, marginTop: 16 }}>
        {stats.map((p, i) => (
          <View key={i} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderColor: c.line }}>
            <Text style={{ fontFamily: SERIF, fontSize: 27, color: c.ink }}>{p[0]}</Text>
            <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', color: c.muted }}>{p[1]}</Text>
          </View>
        ))}
      </View>

      <Text style={{ fontFamily: SERIF_I, fontSize: 19, color: c.ink, lineHeight: 27, marginTop: 20 }}>"{q[0]}"</Text>
      <Text style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: c.muted, marginTop: 4, marginBottom: 22 }}>{q[1]}</Text>

      <Card c={c}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <Text style={{ fontFamily: SERIF, fontSize: 23, color: c.ink }}>Day {day}</Text>
          <Text style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: c.muted }}>
            {fmtDay(plan.startISO, day)}{day === tn ? ' - today' : ''}
          </Text>
        </View>
        {plan.habits.map((h, i) => (
          <Pressable
            key={i}
            disabled={!editable}
            onPress={() => onToggleDay(day, i)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 14,
              paddingVertical: 14, borderTopWidth: 1, borderColor: c.lineSoft,
              opacity: !editable && !readOnly ? 0.45 : pressed ? 0.7 : 1,
            })}
          >
            <CheckBoxMark c={c} on={!!arr[i]} />
            <Text style={{ fontFamily: MONO, fontSize: 14, color: arr[i] ? c.muted : c.ink, flex: 1 }}>{h}</Text>
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderColor: c.lineSoft, paddingTop: 12 }}>
          <Text style={{ fontFamily: SERIF, fontSize: 21, color: c.ink }}>{sc} / {nH}</Text>
          {day < tn && sc < nH ? (
            <Text style={{ fontFamily: MONO, fontSize: 11, color: c.danger }}>{nH - sc} missed</Text>
          ) : null}
          {dateOfDay(plan.startISO, day).getDay() === 0 ? (
            <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: c.muted }}>Sunday: review</Text>
          ) : null}
        </View>
      </Card>

      {plan.targets && plan.targets.length ? (
        <Card c={c}>
          <H2 c={c}>Week {w} targets</H2>
          {plan.weekMeta && plan.weekMeta[w] ? (
            <Hint c={c}>
              Social: <Text style={{ fontFamily: SERIF_I, fontSize: 14, color: c.ink }}>{plan.weekMeta[w].social}</Text>
              {'  -  '}Reading: <Text style={{ fontFamily: SERIF_I, fontSize: 14, color: c.ink }}>{plan.weekMeta[w].reading}</Text>
            </Hint>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {plan.targets.map((t, ti) => (
              <View key={ti} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: c.line, paddingVertical: 7, paddingHorizontal: 10 }}>
                <Text style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: c.ink }}>{t[0]}</Text>
                {Array.from({ length: t[1] }).map((_, pi) => (
                  <Pressable
                    key={pi}
                    disabled={!wEditable}
                    onPress={() => onToggleWeek(w, ti, pi)}
                    hitSlop={6}
                    style={{
                      width: 18, height: 18, borderWidth: 2, borderColor: c.leather, borderRadius: 3,
                      backgroundColor: wo[ti] && wo[ti][pi] ? c.leather : 'transparent',
                      opacity: wEditable || readOnly ? 1 : 0.4,
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card c={c}>
        <H2 c={c}>The thirty days</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: TOTAL }).map((_, i) => {
            const d = i + 1;
            const s = scoreOf(getDay(d), nH);
            const isPerfect = s === nH && nH > 0;
            const zeroPast = d < tn && s === 0;
            const future = d > tn;
            return (
              <Pressable
                key={d}
                disabled={future || !setSel}
                onPress={() => setSel && setSel(d)}
                style={{
                  width: '15%', minWidth: 46, borderWidth: 1, borderRadius: 5,
                  borderColor: isPerfect ? c.leather : d === day ? c.gold : c.line,
                  backgroundColor: isPerfect ? c.leather : c.card,
                  padding: 6, opacity: future ? 0.35 : 1,
                  ...(d === day && !isPerfect ? { borderWidth: 2 } : {}),
                }}
              >
                <Text style={{ fontFamily: SERIF, fontSize: 17, color: isPerfect ? c.onLeather : zeroPast ? c.danger : c.ink }}>{d}</Text>
                <View style={{ height: 3, backgroundColor: isPerfect ? c.onLeather : c.lineSoft, marginTop: 5, opacity: isPerfect ? 0.35 : 1 }}>
                  <View style={{ height: 3, width: `${nH ? Math.round((s / nH) * 100) : 0}%`, backgroundColor: isPerfect ? 'transparent' : c.leather }} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

/* ---------- auth ---------- */

function AuthScreen({ c }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [uname, setUname] = useState('');
  const [dname, setDname] = useState('');
  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const SITE = 'https://paarth-r.github.io/metanoia/';

  const go = async () => {
    const v = email.trim();
    if (!v) return;
    setBusy(true);
    if (mode === 'signin') {
      setMsg('Signing in...');
      const r = await sb.auth.signInWithPassword({ email: v, password });
      if (r.error) setMsg(/confirm/i.test(r.error.message)
        ? 'Email not confirmed yet. Click the link in your confirmation email first.'
        : `Could not sign in: ${r.error.message}`);
    } else if (mode === 'signup') {
      if (password.length < 8) { setMsg('Password needs 8+ characters.'); setBusy(false); return; }
      const u = uname.trim().toLowerCase();
      const d = dname.trim();
      if (!/^[a-z0-9_]{3,20}$/.test(u)) {
        setMsg('Username: 3-20 characters, a-z, 0-9, underscore.'); setBusy(false); return;
      }
      if (!d) { setMsg('Pick a display name. It is what friends see.'); setBusy(false); return; }
      setMsg('Checking that name...');
      const taken = await sb.from('profiles').select('id').eq('username', u).maybeSingle();
      if (taken.data) { setMsg(`"${u}" is taken. Pick another.`); setBusy(false); return; }
      setMsg('Creating...');
      const r = await sb.auth.signUp({
        email: v, password,
        options: { emailRedirectTo: SITE, data: { username: u, display_name: d } },
      });
      setMsg(r.error ? `Could not create: ${r.error.message}`
        : `Account created as @${u}. Tap the link in your confirmation email, then sign in here.`);
    } else {
      setMsg('Sending...');
      const r = await sb.auth.resetPasswordForEmail(v, { redirectTo: SITE });
      setMsg(r.error ? `Could not send: ${r.error.message}`
        : 'Sent. The reset link opens the website to set a new password; then sign in here.');
    }
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 30 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase', color: c.muted }}>Thirty-day resets, run in public</Text>
      <Text style={{ fontFamily: SERIF, fontSize: 46, color: c.ink, marginTop: 4 }}>Metanoia</Text>
      <Text style={{ fontFamily: SERIF_I, fontSize: 18, color: c.muted, lineHeight: 26, marginTop: 6, marginBottom: 24 }}>
        noun. A transformative change of heart and mind; the moment you turn your life around.
      </Text>
      <Card c={c}>
        <H2 c={c}>{mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in'}</H2>
        <Hint c={c}>
          {mode === 'signup'
            ? 'Pick the name people will see. One confirmation email, then you sign in with your password.'
            : mode === 'forgot'
              ? 'We email a reset link; it opens the website to set a new password.'
              : 'Email and password.'}
        </Hint>
        <Input c={c} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address"
          autoComplete="email" value={email} onChangeText={setEmail} />
        {mode !== 'forgot' ? (
          <Input c={c} placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'}
            secureTextEntry autoCapitalize="none"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password} onChangeText={setPassword} style={{ marginTop: 8 }} />
        ) : null}
        {mode === 'signup' ? (
          <>
            <Input c={c} placeholder="username (a-z, 0-9, underscore)" autoCapitalize="none"
              autoCorrect={false} autoComplete="username" maxLength={20}
              value={uname} onChangeText={setUname} style={{ marginTop: 8 }} />
            <Input c={c} placeholder="Display name" autoComplete="name" maxLength={40}
              value={dname} onChangeText={setDname} style={{ marginTop: 8 }} />
          </>
        ) : null}
        <Btn c={c}
          label={busy ? '...' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
          onPress={go} disabled={busy} style={{ marginTop: 10 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {mode !== 'signin' ? <Btn c={c} label="Sign in instead" ghost small onPress={() => { setMode('signin'); setMsg(''); }} /> : null}
          {mode !== 'signup' ? <Btn c={c} label="Create account" ghost small onPress={() => { setMode('signup'); setMsg(''); }} /> : null}
          {mode === 'signin' ? <Btn c={c} label="Forgot password" ghost small onPress={() => { setMode('forgot'); setMsg(''); }} /> : null}
        </View>
        {msg ? <Hint c={c} style={{ marginTop: 10, marginBottom: 0 }}>{msg}</Hint> : null}
      </Card>
      {[['Choose your non-negotiables.', 'Three to seven things you will do every single day. Not goals. Actions.'],
        ['Tick them for thirty days.', 'The ledger fills in black when you are perfect and red when you were not there at all.'],
        ['Let people watch.', 'Friends and groups see your ledger. Accountability is a feed they scroll.'],
        ['Never miss twice.', 'One slip is a data point. Two in a row is a new habit forming in the wrong direction.'],
      ].map((r, i) => (
        <View key={i} style={{ paddingVertical: 13, borderBottomWidth: 1, borderTopWidth: i === 0 ? 1 : 0, borderColor: c.line }}>
          <Text style={{ fontFamily: SERIF, fontSize: 18, color: c.ink }}>{r[0]}</Text>
          <Text style={{ fontFamily: MONO, fontSize: 12, color: c.muted, lineHeight: 18, marginTop: 2 }}>{r[1]}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/* Signed in with no username: every fallback reads 'unnamed' or '?' and their
   profile link goes nowhere, so nothing else opens until they pick one. New
   signups set it on the form; this catches accounts made before that existed,
   and the rare case where the name was taken mid-signup. */
function ClaimScreen({ c, profile, me, onClaimed }) {
  const [uname, setUname] = useState('');
  const [dname, setDname] = useState(profile?.display_name || '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const claim = async () => {
    const u = uname.trim().toLowerCase();
    const d = dname.trim();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) { setMsg('Username: 3-20 characters, a-z, 0-9, underscore.'); return; }
    if (!d) { setMsg('Pick a display name. It is what friends see.'); return; }
    setBusy(true);
    setMsg('Claiming...');
    const r = await sb.from('profiles').update({ username: u, display_name: d }).eq('id', me);
    setBusy(false);
    if (r.error) {
      setMsg(r.error.code === '23505' ? `"${u}" is taken. Pick another.` : `Failed: ${r.error.message}`);
      return;
    }
    onClaimed();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 30 }} keyboardShouldPersistTaps="handled">
      <PageHeader c={c} eyebrow="One thing first" title="Claim your name" />
      <Card c={c}>
        <Hint c={c}>
          Your username is your public address: it is how friends find you and where your ledger
          lives. Your display name is what people read in the feed. Nothing else opens until both are set.
        </Hint>
        <Input c={c} placeholder="username (a-z, 0-9, underscore)" autoCapitalize="none"
          autoCorrect={false} maxLength={20} value={uname} onChangeText={setUname} />
        <Input c={c} placeholder="Display name" maxLength={40} value={dname}
          onChangeText={setDname} style={{ marginTop: 8 }} />
        <Btn c={c} label={busy ? '...' : 'Claim it'} onPress={claim} disabled={busy} style={{ marginTop: 10 }} />
        {msg ? <Hint c={c} style={{ marginTop: 10, marginBottom: 0 }}>{msg}</Hint> : null}
      </Card>
      <Card c={c}>
        <Btn c={c} label="Sign out" ghost onPress={() => sb.auth.signOut()} />
      </Card>
    </ScrollView>
  );
}

/* ---------- wizard ---------- */

function WizardScreen({ c, onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [intent, setIntent] = useState('');
  const [startISO, setStartISO] = useState(isoToday());
  const [habits, setHabits] = useState([]);
  const [custom, setCustom] = useState('');
  const [targets, setTargets] = useState([]);
  const [tName, setTName] = useState('');
  const [tCount, setTCount] = useState('2');
  const [visibility, setVisibility] = useState('friends');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleHabit = (h) => {
    setErr('');
    setHabits((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : prev.length < 7 ? [...prev, h] : prev);
  };
  const next = async () => {
    if (step === 3 && habits.length < 3) { setErr('Pick at least three. Fewer than that is not a reset.'); return; }
    if (step < 5) { setStep(step + 1); setErr(''); return; }
    setBusy(true);
    const ok = await onDone({
      name: name.trim() || 'My Reset', intent: intent.trim(), startISO,
      habits: [...habits], targets: [...targets], weekMeta: null, visibility,
    });
    setBusy(false);
    if (!ok) setErr('Could not create the plan. Try again.');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase', color: c.muted, marginBottom: 14 }}>Step {step} of 5</Text>
      <Card c={c}>
        {err ? <Text style={{ fontFamily: MONO, fontSize: 12, color: c.danger, marginBottom: 10 }}>{err}</Text> : null}
        {step === 1 ? (
          <>
            <Text style={{ fontFamily: SERIF, fontSize: 26, color: c.ink, marginBottom: 6 }}>What is this reset called, and why now?</Text>
            <Hint c={c}>Name it like it matters. You will read it every day for a month.</Hint>
            <Input c={c} placeholder="My Reset" value={name} onChangeText={setName} maxLength={40} />
            <Input c={c} placeholder="Why now. What changes." value={intent} onChangeText={setIntent} maxLength={140} multiline style={{ marginTop: 10, minHeight: 70 }} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Text style={{ fontFamily: SERIF, fontSize: 26, color: c.ink, marginBottom: 6 }}>When does day one begin?</Text>
            <Hint c={c}>Today is the honest answer. A start date in the future is usually procrastination wearing a calendar. (YYYY-MM-DD)</Hint>
            <Input c={c} placeholder={isoToday()} value={startISO} onChangeText={setStartISO} autoCapitalize="none" />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <Text style={{ fontFamily: SERIF, fontSize: 26, color: c.ink, marginBottom: 6 }}>Your daily non-negotiables.</Text>
            <Hint c={c}>Pick 3 to 7. Concrete actions you can tick before midnight on your worst day.</Hint>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {HABIT_SUGGESTIONS.map((h) => (
                <Pressable key={h} onPress={() => toggleHabit(h)} style={{
                  borderWidth: 1.5, borderColor: habits.includes(h) ? c.ink : c.line,
                  backgroundColor: habits.includes(h) ? c.ink : c.card,
                  paddingVertical: 8, paddingHorizontal: 12,
                }}>
                  <Text style={{ fontFamily: MONO, fontSize: 12, color: habits.includes(h) ? c.paper : c.ink }}>{h}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input c={c} placeholder="Add your own" value={custom} onChangeText={setCustom} maxLength={40} style={{ flex: 1 }} />
              <Btn c={c} label="Add" ghost onPress={() => {
                const v = custom.trim();
                if (v && habits.length < 7 && !habits.includes(v)) setHabits([...habits, v]);
                setCustom('');
              }} />
            </View>
            <Hint c={c} style={{ marginTop: 10, marginBottom: 0 }}>{habits.length} of 7 chosen (minimum 3)</Hint>
          </>
        ) : null}
        {step === 4 ? (
          <>
            <Text style={{ fontFamily: SERIF, fontSize: 26, color: c.ink, marginBottom: 6 }}>Weekly targets.</Text>
            <Hint c={c}>A few times a week, not daily. Optional but recommended.</Hint>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {TARGET_SUGGESTIONS.map((s) => {
                const have = targets.some((t) => t[0] === s[0]);
                return (
                  <Pressable key={s[0]} onPress={() => {
                    setTargets((prev) => have ? prev.filter((t) => t[0] !== s[0]) : prev.length < 8 ? [...prev, [s[0], s[1]]] : prev);
                  }} style={{
                    borderWidth: 1.5, borderColor: have ? c.ink : c.line,
                    backgroundColor: have ? c.ink : c.card, paddingVertical: 8, paddingHorizontal: 12,
                  }}>
                    <Text style={{ fontFamily: MONO, fontSize: 12, color: have ? c.paper : c.ink }}>{s[0]} x{s[1]}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input c={c} placeholder="Custom target" value={tName} onChangeText={setTName} maxLength={30} style={{ flex: 1 }} />
              <Input c={c} placeholder="2" value={tCount} onChangeText={setTCount} keyboardType="number-pad" maxLength={1} style={{ width: 54 }} />
              <Btn c={c} label="Add" ghost onPress={() => {
                const v = tName.trim();
                const n = Math.max(1, Math.min(7, parseInt(tCount, 10) || 1));
                if (v && targets.length < 8) setTargets([...targets, [v, n]]);
                setTName('');
              }} />
            </View>
            {targets.map((t, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: c.lineSoft }}>
                <Text style={{ fontFamily: MONO, fontSize: 13, color: c.ink, flex: 1 }}>{t[0]}  x{t[1]} per week</Text>
                <Pressable onPress={() => setTargets(targets.filter((_, k) => k !== i))}>
                  <Text style={{ fontFamily: MONO, fontSize: 12, color: c.danger }}>remove</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : null}
        {step === 5 ? (
          <>
            <Text style={{ fontFamily: SERIF, fontSize: 26, color: c.ink, marginBottom: 6 }}>Who watches?</Text>
            <Hint c={c}>Accountability is the point, but it is your call. Changeable later in Account.</Hint>
            {[['public', 'Public', 'Anyone can watch the ledger fill in. Maximum stakes.'],
              ['friends', 'Friends and groups', 'Accepted friends and group-mates see it in their feed.'],
              ['private', 'Private', 'Yours alone. Not in any feed, invisible on your profile.'],
            ].map((o) => (
              <Pressable key={o[0]} onPress={() => setVisibility(o[0])} style={{
                borderWidth: 1.5, borderColor: visibility === o[0] ? c.ink : c.line,
                padding: 13, marginBottom: 9,
              }}>
                <Text style={{ fontFamily: SERIF, fontSize: 17, color: c.ink }}>{o[1]}</Text>
                <Text style={{ fontFamily: MONO, fontSize: 11, color: c.muted, marginTop: 2 }}>{o[2]}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Btn c={c} label={step === 1 ? 'Cancel' : 'Back'} ghost onPress={() => step === 1 ? onCancel() : setStep(step - 1)} />
        <Btn c={c} label={busy ? 'Creating...' : step === 5 ? 'Begin the thirty days' : 'Continue'} onPress={next} disabled={busy} />
      </View>
    </ScrollView>
  );
}

/* ---------- root app ---------- */

export default function App() {
  const c = useTheme();
  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold, CormorantGaramond_500Medium_Italic,
    IBMPlexMono_400Regular, IBMPlexMono_500Medium,
  });
  const [session, setSession] = useState(null);
  const [booted, setBooted] = useState(false);
  const [profile, setProfile] = useState(null);
  const [SP, setSP] = useState(null); // {plan, days, weeks}
  const [loadErr, setLoadErr] = useState(false);
  const [tab, setTab] = useState('ledger');
  const [viewUser, setViewUser] = useState(null); // username being viewed
  const [wizard, setWizard] = useState(false);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState('');
  const [feedUnseen, setFeedUnseen] = useState(0);
  const dirtyRef = useRef({ days: {}, weeks: {} });
  const flushTimerRef = useRef(null);
  const SPRef = useRef(null);
  SPRef.current = SP;
  const sessionRef = useRef(null);
  sessionRef.current = session;

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const loadProfile = useCallback(async (s) => {
    if (!s) { setProfile(null); return; }
    const r = await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    /* Keep whatever we last knew rather than blanking the identity on a blip. */
    if (r.error) return;
    setProfile(r.data || null);
  }, []);

  /* A failed request is NOT the same as having no plan, and never the same as
     having no ticks. Treating them alike showed "No reset yet" to someone with
     a 27-day streak on a subway, invited them to build a second plan over the
     first, and - because the ledger writes whole checks arrays - let one tap
     against a blank base overwrite a real day on the server. On any error we
     keep the last good data and raise a retry instead. */
  const loadPlan = useCallback(async (s) => {
    if (!s) { setSP(null); setLoadErr(false); return; }
    const p = await sb.from('plans').select('*').eq('owner', s.user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (p.error) { setLoadErr(true); return; }
    if (!p.data) { setSP(null); setLoadErr(false); return; }
    const [dr, wr] = await Promise.all([
      sb.from('plan_days').select('*').eq('plan_id', p.data.id),
      sb.from('plan_weeks').select('*').eq('plan_id', p.data.id),
    ]);
    if (dr.error || wr.error) { setLoadErr(true); return; }
    const days = {}, weeks = {};
    (dr.data || []).forEach((r) => { days[r.day] = r.checks; });
    (wr.data || []).forEach((r) => { weeks[r.week] = r.checks; });
    setSP({ plan: p.data, days, weeks });
    setLoadErr(false);
  }, []);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      Promise.all([loadProfile(data.session), loadPlan(data.session)]).then(() => setBooted(true));
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      const wasSignedOut = !sessionRef.current;
      setSession(s);
      loadProfile(s); loadPlan(s);
      if (s && wasSignedOut) { setTab('ledger'); setViewUser(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile, loadPlan]);

  /* realtime feed badge */
  useEffect(() => {
    if (!session) return;
    const ch = sb.channel('feed-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_events' }, (msg) => {
        if (msg.new && msg.new.user_id !== session.user.id) setFeedUnseen((n) => n + 1);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [session]);

  /* debounced remote save */
  const queueFlush = () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flush, 1800);
  };
  const flush = async () => {
    const sp = SPRef.current;
    const s = sessionRef.current;
    if (!sp || !s) return;
    const days = Object.keys(dirtyRef.current.days);
    const weeks = Object.keys(dirtyRef.current.weeks);
    const nH = sp.plan.habits.length;
    let failed = false;
    /* supabase-js RESOLVES with {error}, it does not throw, so the old
       try/catch never fired and an unchecked upsert still said "Saved to your
       ledger". Each dirty flag now survives until its own write lands, so a
       failed save is retried instead of silently dropped. */
    try {
      for (const dStr of days) {
        const d = +dStr;
        const r = await sb.from('plan_days').upsert({
          plan_id: sp.plan.id, day: d, checks: sp.days[d] || [], updated_at: new Date().toISOString(),
        });
        if (r.error) { failed = true; continue; }
        delete dirtyRef.current.days[dStr];
        if (sp.plan.visibility !== 'private') {
          const sc = scoreOf(sp.days[d], nH);
          await sb.from('feed_events').insert({
            user_id: s.user.id, plan_id: sp.plan.id,
            kind: sc === nH ? 'perfect' : 'tick', day: d,
            payload: { score: sc, total: nH, plan_name: sp.plan.name },
          });
        }
      }
      for (const wStr of weeks) {
        const w = +wStr;
        const r = await sb.from('plan_weeks').upsert({
          plan_id: sp.plan.id, week: w, checks: sp.weeks[w] || {}, updated_at: new Date().toISOString(),
        });
        if (r.error) { failed = true; continue; }
        delete dirtyRef.current.weeks[wStr];
      }
    } catch (e) { failed = true; }
    if (failed) {
      say('Could not save. Retrying...');
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flush, 10000);
    } else if (days.length || weeks.length) {
      say('Saved to your ledger');
    }
  };

  const toggleDay = (d, i) => {
    setSP((prev) => {
      const nH = prev.plan.habits.length;
      const days = { ...prev.days };
      const arr = [...(days[d] || Array(nH).fill(false))];
      while (arr.length < nH) arr.push(false);
      arr[i] = !arr[i];
      days[d] = arr;
      return { ...prev, days };
    });
    dirtyRef.current.days[d] = true;
    queueFlush();
  };
  const toggleWeek = (w, t, p) => {
    setSP((prev) => {
      const weeks = { ...prev.weeks };
      const wo = { ...(weeks[w] || {}) };
      const arr = [...(wo[t] || Array(prev.plan.targets[t][1]).fill(false))];
      arr[p] = !arr[p];
      wo[t] = arr;
      weeks[w] = wo;
      return { ...prev, weeks };
    });
    dirtyRef.current.weeks[w] = true;
    queueFlush();
  };

  const addHabit = async (label) => {
    if (!SP) return false;
    if (SP.plan.habits.length >= 7) { say('Seven is the cap. Discipline is subtraction.'); return false; }
    const habits = [...SP.plan.habits, label];
    const r = await sb.from('plans').update({ habits }).eq('id', SP.plan.id);
    if (r.error) { say('Could not commit.'); return false; }
    setSP((prev) => ({ ...prev, plan: { ...prev.plan, habits } }));
    say('Committed. Thirty days.');
    return true;
  };
  const addTarget = async (label, count) => {
    if (!SP) return false;
    if ((SP.plan.targets || []).length >= 8) { say('Eight targets is the cap.'); return false; }
    const targets = [...(SP.plan.targets || []), [label, count]];
    const r = await sb.from('plans').update({ targets }).eq('id', SP.plan.id);
    if (r.error) { say('Could not commit.'); return false; }
    setSP((prev) => ({ ...prev, plan: { ...prev.plan, targets } }));
    say('Committed. Thirty days.');
    return true;
  };

  const createPlan = async (planObj) => {
    const r = await sb.from('plans').insert({
      owner: session.user.id, name: planObj.name, intent: planObj.intent,
      start_date: planObj.startISO, habits: planObj.habits, targets: planObj.targets,
      week_meta: planObj.weekMeta, visibility: planObj.visibility,
    }).select().single();
    if (r.error) return false;
    if (planObj.visibility !== 'private') {
      await sb.from('feed_events').insert({
        user_id: session.user.id, plan_id: r.data.id, kind: 'started',
        payload: { plan_name: r.data.name },
      });
    }
    setSP({ plan: r.data, days: {}, weeks: {} });
    setWizard(false);
    setTab('ledger');
    return true;
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const shell = (content) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar barStyle={c === DARK ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
      <View style={{ flex: 1 }}><ErrorBoundary c={c}>{content}</ErrorBoundary></View>
      {toast ? (
        <View style={{ position: 'absolute', bottom: 90, alignSelf: 'center', backgroundColor: c.ink, paddingVertical: 7, paddingHorizontal: 14 }}>
          <Text style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: c.paper }}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );

  if (!booted) return shell(<ActivityIndicator style={{ marginTop: 80 }} color={c.ink} />);
  if (!session) return shell(<AuthScreen c={c} />);
  if (profile && !profile.username) {
    return shell(
      <ClaimScreen c={c} profile={profile} me={session.user.id}
        onClaimed={async () => { await loadProfile(session); setTab('ledger'); say('Welcome.'); }} />
    );
  }
  if (wizard) return shell(<WizardScreen c={c} onDone={createPlan} onCancel={() => setWizard(false)} />);
  if (viewUser) {
    return shell(
      <ProfileScreen c={c} username={viewUser} me={session.user.id} onBack={() => setViewUser(null)} say={say} />
    );
  }

  const tabs = [
    ['ledger', 'Ledger'], ['days', 'Days'], ['feed', 'Feed'], ['social', 'Social'], ['account', 'Account'],
  ];

  return shell(
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'ledger' ? (
          <LedgerScreen c={c} SP={SP} toggleDay={toggleDay} toggleWeek={toggleWeek}
            sel={sel} setSel={setSel} onCreate={() => setWizard(true)} onAdopt={createPlan} profile={profile}
            onAddHabit={addHabit} onAddTarget={addTarget}
            loadErr={loadErr} onRetry={() => { setLoadErr(false); loadPlan(session); }} />
        ) : null}
        {tab === 'days' ? (
          <DaysScreen c={c} SP={SP} toggleDay={toggleDay} me={session.user.id} say={say} />
        ) : null}
        {tab === 'feed' ? (
          <FeedScreen c={c} me={session.user.id} onOpenUser={setViewUser}
            onSeen={() => setFeedUnseen(0)} />
        ) : null}
        {tab === 'social' ? (
          <SocialScreen c={c} me={session.user.id} onOpenUser={setViewUser} say={say} />
        ) : null}
        {tab === 'account' ? (
          <AccountScreen c={c} profile={profile} SP={SP} setSP={setSP}
            onProfileSaved={() => loadProfile(session)} say={say} />
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 6, backgroundColor: 'transparent' }}>
        <View style={{
          flexDirection: 'row', gap: 4, padding: 5, borderRadius: 30,
          backgroundColor: c.card, borderWidth: 1, borderColor: c.line,
        }}>
          {tabs.map(([key, label]) => {
            const active = tab === key;
            return (
              <Pressable key={key} onPress={() => { setTab(key); if (key === 'feed') setFeedUnseen(0); }}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 12, paddingHorizontal: 2, alignItems: 'center', borderRadius: 24,
                  backgroundColor: active ? c.leather : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text numberOfLines={1} style={{
                    fontFamily: MONO_M, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase',
                    color: active ? c.onLeather : c.muted,
                  }}>{label}</Text>
                  {key === 'feed' && feedUnseen > 0 ? (
                    <View style={{ backgroundColor: c.danger, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontFamily: MONO_M, fontSize: 9, color: '#F6EFDD' }}>{feedUnseen > 9 ? '9+' : feedUnseen}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* ---------- ledger screen ---------- */

function LedgerScreen({ c, SP, toggleDay, toggleWeek, sel, setSel, onCreate, onAdopt, profile, onAddHabit, onAddTarget, loadErr, onRetry }) {
  const [commitKind, setCommitKind] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [newCount, setNewCount] = useState('2');
  const WARNING = 'Be careful: once you commit to something, you will see it for the next 30 days and cannot remove it.';
  const confirmCommit = () => {
    const label = newLabel.trim();
    if (!label) return;
    const isHabit = commitKind === 'habit';
    const n = Math.max(1, Math.min(7, parseInt(newCount, 10) || 1));
    Alert.alert(
      'Commit for thirty days?',
      WARNING + '\n\n' + (isHabit ? '"' + label + '" joins your daily non-negotiables.' : '"' + label + ' x' + n + '" joins your weekly targets.'),
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Commit', style: 'destructive', onPress: async () => {
          const done = isHabit ? await onAddHabit(label) : await onAddTarget(label, n);
          if (done) { setCommitKind(null); setNewLabel(''); setNewCount('2'); }
        } },
      ]
    );
  };
  /* Never claim the reset does not exist when we simply could not reach it. */
  if (loadErr && !SP) {
    return (
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 30 }}>
        <PageHeader c={c} eyebrow="Your ledger" title="Cannot reach it" />
        <Card c={c} style={{ marginTop: 18 }}>
          <Hint c={c}>
            Your ledger is on the server and it is fine - this device just could not load it.
            Check your connection and try again.
          </Hint>
          <Btn c={c} label="Try again" onPress={onRetry} />
        </Card>
      </ScrollView>
    );
  }
  if (!SP) {
    return (
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 30 }}>
        <PageHeader c={c} eyebrow="Your ledger" title="No reset yet" />
        <Card c={c} style={{ marginTop: 18 }}>
          <Hint c={c}>Build your thirty days, or adopt the original plan.</Hint>
          <Btn c={c} label="Build my plan" onPress={onCreate} />
          <Btn c={c} label="Adopt the original" ghost style={{ marginTop: 8 }} onPress={() => {
            const p = JSON.parse(JSON.stringify(PAARTH_PLAN));
            const isPaarth = profile && profile.username === 'paarthr';
            if (!isPaarth) p.startISO = isoToday();
            p.visibility = 'friends';
            onAdopt(p);
          }} />
        </Card>
      </ScrollView>
    );
  }
  const plan = planRowToObj(SP.plan);
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 24, paddingBottom: 40 }}>
      <PageHeader c={c}
        eyebrow={`${fmtDay(plan.startISO, 1)} - ${fmtDay(plan.startISO, TOTAL)}`}
        title={plan.name}
        right={<VTag c={c} v={plan.visibility} />}
        sub={plan.intent || null} />
      <Ledger c={c} plan={plan}
        getDay={(d) => SP.days[d]} getWeek={(w) => SP.weeks[w]}
        onToggleDay={toggleDay} onToggleWeek={toggleWeek}
        readOnly={false} sel={sel} setSel={setSel} />
      <Card c={c}>
        <H2 c={c}>Commit more</H2>
        <Hint c={c}>{WARNING}</Hint>
        {commitKind === null ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn c={c} small ghost label="New non-negotiable" onPress={() => setCommitKind('habit')} />
            <Btn c={c} small ghost label="New weekly target" onPress={() => setCommitKind('target')} />
          </View>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input c={c} placeholder={commitKind === 'habit' ? 'The daily action' : 'The weekly target'}
                value={newLabel} onChangeText={setNewLabel} maxLength={40} style={{ flex: 1 }} />
              {commitKind === 'target' ? (
                <Input c={c} placeholder="2" value={newCount} onChangeText={setNewCount}
                  keyboardType="number-pad" maxLength={1} style={{ width: 54 }} />
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Btn c={c} small label="Commit" onPress={confirmCommit} />
              <Btn c={c} small ghost label="Cancel" onPress={() => { setCommitKind(null); setNewLabel(''); }} />
            </View>
          </View>
        )}
      </Card>
      <Text style={{ fontFamily: MONO, fontSize: 11, color: c.muted, lineHeight: 19, marginTop: 6 }}>
        Never miss twice. Done before dopamine. The scorecard is the verdict on the day, not your feelings.
      </Text>
    </ScrollView>
  );
}

/* ---------- days: a real calendar of non-negotiables and todos ---------- */

/* Todos run on real dates, outside any 30-day plan. A repeating todo is one
   row plus one tick per day done, so a new day is fresh by having no tick yet
   and history is never rewritten. Private: never shared, never in the feed,
   never counted in the streak. */
function DaysScreen({ c, SP, toggleDay, me, say }) {
  const [todos, setTodos] = useState(null);
  const [ticks, setTicks] = useState([]);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const today = isoTodayLocal();
  const [sel, setSel] = useState(today);
  const [month, setMonth] = useState(() => {
    const d = parseIsoLocal(today);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [draft, setDraft] = useState('');
  const [repeat, setRepeat] = useState(false);

  const load = useCallback(async () => {
    const [t, k] = await Promise.all([
      sb.from('todos').select('*').order('created_at'),
      sb.from('todo_ticks').select('*'),
    ]);
    if (t.error) { setMissing(true); setReady(true); return; }
    setTodos(t.data || []);
    setTicks(k.error ? [] : (k.data || []));
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const body = draft.trim();
    if (!body) return;
    const row = repeat
      ? { owner: me, body, repeats: true, starts_on: sel, on_date: null, ends_on: null }
      : { owner: me, body, repeats: false, on_date: sel, starts_on: null, ends_on: null };
    const r = await sb.from('todos').insert(row).select().single();
    if (r.error) { say('Could not add that.'); return; }
    setTodos((p) => [...p, r.data]);
    setDraft(''); setRepeat(false);
  };

  const tick = async (id, done) => {
    if (done) {
      const r = await sb.from('todo_ticks').upsert(
        { todo_id: id, on_date: sel, updated_at: new Date().toISOString() },
        { onConflict: 'todo_id,on_date' });
      if (r.error) { say('Could not save that tick.'); return; }
      setTicks((p) => [...p, { todo_id: id, on_date: sel }]);
    } else {
      const r = await sb.from('todo_ticks').delete().eq('todo_id', id).eq('on_date', sel);
      if (r.error) { say('Could not clear that tick.'); return; }
      setTicks((p) => p.filter((t) => !(t.todo_id === id && t.on_date === sel)));
    }
  };

  /* A repeat with history is ended, not erased, so the days already ticked
     keep it. A repeat nobody ever ticked, and any one-off, go for good. */
  const remove = (id) => {
    const full = todos.find((t) => t.id === id);
    if (!full) return;
    const hasHistory = full.repeats && ticks.some((t) => t.todo_id === id);
    const doIt = async () => {
      if (hasHistory) {
        const ends = endDateForStop(id, ticks, sel);
        const r = await sb.from('todos').update({ ends_on: ends }).eq('id', id);
        if (r.error) { say('Could not stop that.'); return; }
        setTodos((p) => p.map((t) => (t.id === id ? { ...t, ends_on: ends } : t)));
        say('Stopped. The days you ticked keep it.');
        return;
      }
      const r = await sb.from('todos').delete().eq('id', id);
      if (r.error) { say('Could not delete that.'); return; }
      setTodos((p) => p.filter((t) => t.id !== id));
      setTicks((p) => p.filter((t) => t.todo_id !== id));
    };
    Alert.alert(
      hasHistory ? 'Stop this daily todo?' : 'Delete this todo?',
      hasHistory
        ? `"${full.body}" stops from here on. The days you already ticked keep it.`
        : `"${full.body}" goes for good.`,
      [{ text: 'Cancel', style: 'cancel' },
       { text: hasHistory ? 'Stop' : 'Delete', style: 'destructive', onPress: doIt }]);
  };

  if (!ready) {
    return <ActivityIndicator color={c.ink} style={{ marginTop: 60 }} />;
  }
  if (missing) {
    return (
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 30 }}>
        <PageHeader c={c} eyebrow="Every day, on the record" title="Days" />
        <Card c={c}>
          <Hint c={c} style={{ marginBottom: 0 }}>
            Todos are not set up on the backend yet. Run
            supabase/migration-2026-08-29-todos.sql in the Supabase SQL editor, then reopen this tab.
          </Hint>
        </Card>
      </ScrollView>
    );
  }

  const plan = SP && SP.plan ? planRowToObj(SP.plan) : null;
  const planDay = plan ? planDayOf(plan.startISO, sel) : null;
  const future = sel > today;
  const list = resolveTodosForDate(todos, ticks, sel);
  const counts = todoCountsForDate(todos, ticks, sel);
  const selDate = parseIsoLocal(sel);
  const D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const step = (n) => setMonth((p) => {
    const m = p.m + n;
    if (m < 0) return { y: p.y - 1, m: 11 };
    if (m > 11) return { y: p.y + 1, m: 0 };
    return { y: p.y, m };
  });

  const navBtn = (label, onPress) => (
    <Pressable onPress={onPress} hitSlop={10}
      style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: c.line,
        alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: MONO_M, fontSize: 13, color: c.muted }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 24, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled">
      <PageHeader c={c} eyebrow="Every day, on the record" title="Days" />

      <Card c={c}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {navBtn('<', () => step(-1))}
          <Text style={{ fontFamily: SERIF, fontSize: 24, color: c.ink }}>{monthLabel(month.y, month.m)}</Text>
          {navBtn('>', () => step(1))}
        </View>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 10,
              letterSpacing: 1.2, color: c.muted }}>{w}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {monthGrid(month.y, month.m).map((cell) => {
            const pd = plan ? planDayOf(plan.startISO, cell.iso) : null;
            let full = false, zero = false;
            if (pd) {
              const nH = plan.habits.length;
              const sc = scoreOf(SP.days[pd], nH);
              full = sc === nH;
              zero = sc === 0 && cell.iso < today;
            }
            const isSel = cell.iso === sel;
            return (
              <Pressable key={cell.iso} onPress={() => setSel(cell.iso)}
                style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                <View style={{
                  flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 4,
                  borderWidth: isSel ? 2 : 1,
                  borderColor: isSel ? c.ink : zero ? c.danger : cell.iso === today ? c.gold : c.lineSoft,
                  backgroundColor: full ? c.leather : 'transparent',
                  opacity: cell.inMonth ? 1 : 0.28,
                }}>
                  <Text style={{ fontFamily: SERIF, fontSize: 16,
                    color: full ? c.onLeather : zero ? c.danger : c.ink }}>{cell.day}</Text>
                  {dayHasMark(todos, ticks, cell.iso, today) ? (
                    <View style={{ position: 'absolute', bottom: 4, width: 4, height: 4,
                      borderRadius: 2, backgroundColor: full ? c.onLeather : c.gold }} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card c={c}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <Text style={{ fontFamily: SERIF, fontSize: 24, color: c.ink }}>
            {`${D[selDate.getDay()]} ${MONTH_NAMES[selDate.getMonth()].slice(0, 3)} ${selDate.getDate()}`}
          </Text>
          <Text style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: c.muted }}>
            {sel === today ? 'today' : future ? 'ahead' : 'past'}
          </Text>
        </View>

        {planDay ? (
          <View>
            <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
              color: c.muted, marginBottom: 4 }}>{`Non-negotiables - day ${planDay} of 30`}</Text>
            {plan.habits.map((h, i) => {
              const on = !!(SP.days[planDay] || [])[i];
              return (
                <Pressable key={i} disabled={future} onPress={() => toggleDay(planDay, i)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11,
                    borderTopWidth: 1, borderColor: c.lineSoft, opacity: future ? 0.45 : 1 }}>
                  <CheckBoxMark c={c} on={on} />
                  <Text style={{ fontFamily: MONO, fontSize: 13, color: c.ink, flex: 1 }}>{h}</Text>
                </Pressable>
              );
            })}
            <Text style={{ fontFamily: SERIF, fontSize: 18, color: c.muted, marginTop: 8 }}>
              {`${scoreOf(SP.days[planDay], plan.habits.length)} / ${plan.habits.length}`}
            </Text>
          </View>
        ) : null}

        <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
          color: c.muted, marginTop: 18, marginBottom: 4 }}>
          {counts.total ? `Todos  ${counts.done} / ${counts.total}` : 'Todos'}
        </Text>
        {!list.length ? <Hint c={c}>Nothing on the books for this day.</Hint> : null}
        {list.map((t) => (
          <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
            borderTopWidth: 1, borderColor: c.lineSoft }}>
            <Pressable disabled={future} onPress={() => tick(t.id, !t.done)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11,
                flex: 1, opacity: future ? 0.45 : 1 }}>
              <CheckBoxMark c={c} on={t.done} />
              <Text style={{ fontFamily: MONO, fontSize: 13, color: c.ink, flex: 1 }}>
                {t.body}
                {t.repeats ? (
                  <Text style={{ fontSize: 9, letterSpacing: 1.2, color: c.muted }}>{'   DAILY'}</Text>
                ) : null}
              </Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => remove(t.id)}>
              <Text style={{ fontFamily: MONO, fontSize: 11, color: c.muted }}>delete</Text>
            </Pressable>
          </View>
        ))}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Input c={c} placeholder="Add a todo for this day" value={draft} onChangeText={setDraft}
            maxLength={120} style={{ flex: 1 }} onSubmitEditing={add} returnKeyType="done" />
          <Btn c={c} label="Add" onPress={add} />
        </View>
        <Pressable onPress={() => setRepeat((r) => !r)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 }}>
          <CheckBoxMark c={c} on={repeat} size={18} />
          <Text style={{ fontFamily: MONO, fontSize: 12, color: c.muted }}>Repeat every day from here</Text>
        </Pressable>
      </Card>

      <Text style={{ fontFamily: MONO, fontSize: 11, color: c.muted, lineHeight: 19 }}>
        Todos are yours alone: never shared, never in the feed, never counted in your streak.
        The non-negotiables are the verdict.
      </Text>
    </ScrollView>
  );
}

/* ---------- feed ---------- */

const REACTION_KINDS = [['respect', 'Respect'], ['locked_in', 'Locked in'], ['soft', 'Soft']];
const MUTED_KEY = 'metanoia_muted_groups_v1';

async function getMutedGroups() {
  try { return JSON.parse(await AsyncStorage.getItem(MUTED_KEY)) || []; } catch (e) { return []; }
}
async function setMutedGroups(ids) {
  try { await AsyncStorage.setItem(MUTED_KEY, JSON.stringify(ids)); } catch (e) {}
}

/* Reusable feed: fetches visible events, applies an optional user filter,
   renders items with reactions. Used by the main Feed and by group feeds. */
function FeedList({ c, me, onOpenUser, userFilter, hideUsers, header, emptyText }) {
  const [events, setEvents] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reactions, setReactions] = useState({});
  const [reactionsOn, setReactionsOn] = useState(true);

  const loadReactions = useCallback(async (evs) => {
    const ids = evs.map((e) => e.id);
    if (!ids.length) { setReactions({}); return; }
    const rr = await sb.from('feed_reactions').select('*').in('event_id', ids);
    if (rr.error) { setReactionsOn(false); return; }
    const map = {};
    (rr.data || []).forEach((r) => {
      if (!map[r.event_id]) map[r.event_id] = { counts: {}, mine: null };
      map[r.event_id].counts[r.kind] = (map[r.event_id].counts[r.kind] || 0) + 1;
      if (r.user_id === me) map[r.event_id].mine = r.kind;
    });
    setReactions(map);
  }, [me]);

  const react = async (ev, kind) => {
    const cur = reactions[ev.id];
    if (cur && cur.mine === kind) {
      await sb.from('feed_reactions').delete().eq('event_id', ev.id).eq('user_id', me);
    } else {
      await sb.from('feed_reactions').upsert(
        { event_id: ev.id, user_id: me, kind }, { onConflict: 'event_id,user_id' });
    }
    loadReactions(events || []);
  };

  const load = useCallback(async () => {
    const r = await sb.from('feed_events')
      .select('*, profiles(username, display_name), plans(name)')
      .order('created_at', { ascending: false }).limit(150);
    const seen = {}, out = [];
    (r.data || []).forEach((ev) => {
      const key = (ev.kind === 'tick' || ev.kind === 'perfect')
        ? `${ev.user_id}|${ev.plan_id}|${ev.day}` : `id${ev.id}`;
      if (seen[key]) return;
      seen[key] = true;
      out.push(ev);
    });
    setEvents(out);
    loadReactions(out);
  }, [loadReactions]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = sb.channel('feed-list-' + Math.floor(Math.random() * 1e9))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_events' }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [load]);

  const line = (ev) => {
    const pname = (ev.plans && ev.plans.name) || (ev.payload && ev.payload.plan_name) || 'a reset';
    if (ev.kind === 'started') return `started "${pname}". Watch them.`;
    if (ev.kind === 'perfect') return `went perfect on day ${ev.day} of "${pname}".`;
    if (ev.kind === 'finished') return `finished the thirty days of "${pname}".`;
    return `ticked ${ev.payload?.score}/${ev.payload?.total} on day ${ev.day} of "${pname}".`;
  };

  const data = (events || [])
    .filter((ev) => (userFilter ? userFilter.includes(ev.user_id) : true))
    .filter((ev) => (hideUsers ? !hideUsers.has(ev.user_id) : true));

  return (
    <FlatList
      data={data}
      keyExtractor={(ev) => String(ev.id)}
      contentContainerStyle={{ padding: 18, paddingTop: 24, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.muted}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={header || null}
      ListEmptyComponent={events === null
        ? <ActivityIndicator color={c.ink} style={{ marginTop: 30 }} />
        : <Hint c={c}>{emptyText || 'Quiet in here. Add friends or join a group under Social, and their ticks show up as they happen.'}</Hint>}
      renderItem={({ item: ev }) => {
        const uname = ev.profiles?.username || 'someone';
        const isPerfect = ev.kind === 'perfect';
        return (
          <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderColor: c.lineSoft }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: c.leather,
              backgroundColor: isPerfect ? c.leather : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontFamily: SERIF, fontSize: 17, color: isPerfect ? c.onLeather : c.ink, textTransform: 'uppercase' }}>{uname[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: MONO, fontSize: 13, color: c.ink, lineHeight: 19 }}>
                <Text onPress={() => onOpenUser(uname)} style={{ fontFamily: MONO_M, textDecorationLine: 'underline' }}>
                  {ev.profiles?.display_name || uname}
                </Text>
                {' '}{line(ev)}
              </Text>
              <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: c.muted, marginTop: 3 }}>{ago(ev.created_at)}</Text>
              {(ev.kind === 'tick' || ev.kind === 'perfect') && ev.payload?.total ? (
                <View style={{ height: 3, backgroundColor: c.lineSoft, marginTop: 8, maxWidth: 180 }}>
                  <View style={{ height: 3, width: `${Math.round((ev.payload.score / ev.payload.total) * 100)}%`, backgroundColor: c.leather }} />
                </View>
              ) : null}
              {reactionsOn ? (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 9 }}>
                  {REACTION_KINDS.map(([kind, label]) => {
                    const rx = reactions[ev.id];
                    const count = rx ? (rx.counts[kind] || 0) : 0;
                    const mine = rx && rx.mine === kind;
                    return (
                      <Pressable key={kind} onPress={() => react(ev, kind)} hitSlop={4}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 5,
                          borderWidth: 1.5, borderColor: mine ? c.leather : c.line, borderRadius: 14,
                          backgroundColor: mine ? c.leather : 'transparent',
                          paddingVertical: 4, paddingHorizontal: 10,
                        }}>
                        <Text style={{
                          fontFamily: MONO_M, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
                          color: mine ? c.onLeather : kind === 'soft' ? c.danger : c.muted,
                        }}>{label}</Text>
                        {count > 0 ? (
                          <Text style={{ fontFamily: MONO_M, fontSize: 10, color: mine ? c.onLeather : c.ink }}>{count}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        );
      }}
    />
  );
}

function FeedScreen({ c, me, onOpenUser, onSeen }) {
  const [filter, setFilter] = useState({ kind: 'all' });
  const [groups, setGroups] = useState([]);
  const [friendIds, setFriendIds] = useState([]);
  const [muted, setMuted] = useState([]);

  useEffect(() => {
    (async () => {
      const g = await sb.from('groups').select('id, name, group_members(user_id)');
      setGroups(g.data || []);
      const f = await sb.from('friendships').select('*').eq('status', 'accepted');
      setFriendIds((f.data || []).map((r) => (r.user_a === me ? r.user_b : r.user_a)));
      setMuted(await getMutedGroups());
      onSeen();
    })();
  }, [me, onSeen]);

  let userFilter = null;
  let hideUsers = null;
  if (filter.kind === 'friends') {
    userFilter = [...friendIds, me];
  } else if (filter.kind === 'group') {
    const g = groups.find((x) => x.id === filter.id);
    userFilter = g ? (g.group_members || []).map((m) => m.user_id) : [];
  } else {
    const mutedSet = new Set();
    groups.filter((g) => muted.includes(g.id))
      .forEach((g) => (g.group_members || []).forEach((m) => mutedSet.add(m.user_id)));
    groups.filter((g) => !muted.includes(g.id))
      .forEach((g) => (g.group_members || []).forEach((m) => mutedSet.delete(m.user_id)));
    friendIds.forEach((id) => mutedSet.delete(id));
    mutedSet.delete(me);
    hideUsers = mutedSet;
  }

  const chips = [
    { key: 'all', label: 'All', active: filter.kind === 'all', onPress: () => setFilter({ kind: 'all' }) },
    { key: 'friends', label: 'Friends', active: filter.kind === 'friends', onPress: () => setFilter({ kind: 'friends' }) },
    ...groups.map((g) => ({
      key: g.id,
      label: muted.includes(g.id) ? g.name + ' (silenced)' : g.name,
      active: filter.kind === 'group' && filter.id === g.id,
      onPress: () => setFilter({ kind: 'group', id: g.id }),
    })),
  ];

  const header = (
    <View>
      <PageHeader c={c} eyebrow="The accountability wire" title="Feed" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
        {chips.map((ch) => (
          <Pressable key={ch.key} onPress={ch.onPress}
            style={{
              borderWidth: 1.5, borderColor: ch.active ? c.leather : c.line, borderRadius: 16,
              backgroundColor: ch.active ? c.leather : 'transparent',
              paddingVertical: 6, paddingHorizontal: 13,
            }}>
            <Text style={{
              fontFamily: MONO_M, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
              color: ch.active ? c.onLeather : c.muted,
            }}>{ch.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <FeedList c={c} me={me} onOpenUser={onOpenUser}
      userFilter={userFilter} hideUsers={hideUsers} header={header}
      emptyText={filter.kind === 'group' ? 'Nothing from this group yet.' : undefined} />
  );
}

/* ---------- social: groups first, friends behind a door ---------- */

function GroupAvatar({ c, group, size = 44 }) {
  if (group.image_url) {
    return (
      <Image source={{ uri: group.image_url }}
        style={{ width: size, height: size, borderRadius: 8, borderWidth: 1, borderColor: c.line }} />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: c.leather, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: SERIF, fontSize: size * 0.5, color: c.onLeather, textTransform: 'uppercase' }}>{(group.name || '?')[0]}</Text>
    </View>
  );
}

function SocialScreen({ c, me, onOpenUser, say }) {
  const [view, setView] = useState({ kind: 'home' });
  const [groups, setGroups] = useState(null);
  const [gName, setGName] = useState('');
  const [gCode, setGCode] = useState('');

  const loadGroups = useCallback(async () => {
    const g = await sb.from('groups').select('*, group_members(user_id, profiles(username, display_name))');
    setGroups(g.data || []);
  }, []);
  useEffect(() => { loadGroups(); }, [loadGroups]);

  if (view.kind === 'friends') {
    return <FriendsScreen c={c} me={me} onOpenUser={onOpenUser} say={say} onBack={() => setView({ kind: 'home' })} />;
  }
  if (view.kind === 'group') {
    return <GroupScreen c={c} me={me} group={view.group} onOpenUser={onOpenUser} say={say}
      onBack={() => { setView({ kind: 'home' }); loadGroups(); }} />;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <PageHeader c={c} eyebrow="Groups and friends" title="Social" />
      <Card c={c}>
        <H2 c={c}>Your groups</H2>
        {groups === null ? <ActivityIndicator color={c.ink} /> : null}
        {groups && !groups.length ? (
          <Hint c={c} style={{ marginBottom: 0 }}>
            No groups yet. Create one and share the invite code: the group sees each other's ledgers and feed, and gets a private chat.
          </Hint>
        ) : null}
        {(groups || []).map((g) => (
          <Pressable key={g.id} onPress={() => setView({ kind: 'group', group: g })}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
              borderBottomWidth: 1, borderColor: c.lineSoft, opacity: pressed ? 0.7 : 1,
            })}>
            <GroupAvatar c={c} group={g} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: SERIF, fontSize: 20, color: c.ink }}>{g.name}</Text>
              <Text style={{ fontFamily: MONO, fontSize: 11, color: c.muted }}>
                {(g.group_members || []).length} member{(g.group_members || []).length === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={{ fontFamily: SERIF, fontSize: 22, color: c.gold }}>{'>'}</Text>
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Input c={c} placeholder="New group name" value={gName} onChangeText={setGName} maxLength={40} style={{ flex: 1 }} />
          <Btn c={c} label="Create" onPress={async () => {
            const v = gName.trim(); if (!v) return;
            const r = await sb.rpc('create_group', { gname: v });
            if (r.error) say('Could not create.');
            setGName(''); loadGroups();
          }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Input c={c} placeholder="Invite code" autoCapitalize="none" value={gCode} onChangeText={setGCode} style={{ flex: 1 }} />
          <Btn c={c} label="Join" ghost onPress={async () => {
            const v = gCode.trim(); if (!v) return;
            const r = await sb.rpc('join_group', { code: v });
            say(r.error ? 'Could not join.' : 'Joined.');
            setGCode(''); loadGroups();
          }} />
        </View>
      </Card>
      <Btn c={c} label="Friends" onPress={() => setView({ kind: 'friends' })} />
      <Hint c={c} style={{ marginTop: 10 }}>Requests, your friends list, and adding people by username.</Hint>
    </ScrollView>
  );
}

function BackRow({ c, onBack, label }) {
  return (
    <Pressable onPress={onBack} hitSlop={8} style={{ marginBottom: 12, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: MONO_M, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: c.muted }}>
        {'< '}{label || 'Social'}
      </Text>
    </Pressable>
  );
}

function GroupScreen({ c, me, group, onOpenUser, say, onBack }) {
  const [g, setG] = useState(group);
  const [section, setSection] = useState('feed');
  const [msgs, setMsgs] = useState(null);
  const [draft, setDraft] = useState('');
  const [chatReady, setChatReady] = useState(true);

  const loadMsgs = useCallback(async () => {
    const r = await sb.from('group_messages')
      .select('*, profiles(username, display_name)')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false }).limit(100);
    if (r.error) { setChatReady(false); setMsgs([]); return; }
    setChatReady(true);
    setMsgs(r.data || []);
  }, [group.id]);
  useEffect(() => { loadMsgs(); }, [loadMsgs]);
  useEffect(() => {
    const ch = sb.channel('chat-' + group.id)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: 'group_id=eq.' + group.id },
        () => loadMsgs())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [group.id, loadMsgs]);

  const send = async () => {
    const v = draft.trim(); if (!v) return;
    setDraft('');
    const r = await sb.from('group_messages').insert({ group_id: group.id, user_id: me, body: v });
    if (r.error) {
      /* The guard_message trigger refuses banned terms and suspended accounts;
         say which it was rather than a generic failure. */
      const m = String(r.error.message || '');
      say(/community rules/i.test(m) ? 'That message breaks the community rules.'
        : /suspended/i.test(m) ? 'Your account is suspended.'
        : 'Could not send.');
      setDraft(v);
    } else loadMsgs();
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { say('Photo access was denied.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true,
    });
    if (res.canceled || !res.assets || !res.assets[0].base64) return;
    say('Uploading...');
    try {
      const bin = atob(res.assets[0].base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const path = group.id + '.jpg';
      const up = await sb.storage.from('group-images').upload(path, bytes.buffer, {
        contentType: 'image/jpeg', upsert: true,
      });
      if (up.error) { say('Upload failed.'); return; }
      const { data } = sb.storage.from('group-images').getPublicUrl(path);
      const url = data.publicUrl + '?t=' + Date.now();
      const r2 = await sb.from('groups').update({ image_url: url }).eq('id', group.id);
      if (r2.error) { say('Could not save the image.'); return; }
      setG({ ...g, image_url: url });
      say('Group image updated.');
    } catch (e) { say('Upload failed.'); }
  };

  const members = g.group_members || [];
  const sections = [['feed', 'Feed'], ['chat', 'Chat'], ['members', 'Members'], ['settings', 'Settings']];
  const [gMuted, setGMuted] = useState(false);
  useEffect(() => { getMutedGroups().then((ids) => setGMuted(ids.includes(g.id))); }, [g.id]);
  const toggleMute = async () => {
    const ids = await getMutedGroups();
    const next = gMuted ? ids.filter((i) => i !== g.id) : [...ids, g.id];
    await setMutedGroups(next);
    setGMuted(!gMuted);
    say(gMuted ? 'This group speaks in your main feed again.' : 'Group silenced in your main feed.');
  };
  const [inviteOpen, setInviteOpen] = useState(false);
  const [friendOpts, setFriendOpts] = useState(null);

  const refreshGroup = async () => {
    const r = await sb.from('groups').select('*, group_members(user_id, profiles(username, display_name))').eq('id', g.id).maybeSingle();
    if (r.data) setG(r.data);
  };
  const loadFriendOpts = async () => {
    const r = await sb.from('friendships').select(
      '*, a:profiles!friendships_user_a_fkey(id, username, display_name), b:profiles!friendships_user_b_fkey(id, username, display_name)')
      .eq('status', 'accepted');
    const list = (r.data || [])
      .map((row) => (row.a && row.a.id === me ? row.b : row.a))
      .filter(Boolean)
      .filter((p) => !members.some((m) => m.user_id === p.id));
    setFriendOpts(list);
  };
  const shareCode = () => {
    Share.share({
      message: 'Join "' + g.name + '" on Metanoia. Invite code: ' + g.invite_code +
        '  https://paarth-r.github.io/metanoia/#/join/' + g.invite_code,
    });
  };
  const addFriendToGroup = async (fid) => {
    const r = await sb.rpc('add_friend_to_group', { gid: g.id, fid });
    if (r.error) say('Could not add them.');
    else { say('Added to the group.'); await refreshGroup(); loadFriendOpts(); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={60}>
      <View style={{ flex: 1, padding: 18, paddingTop: 24 }}>
        <BackRow c={c} onBack={onBack} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <GroupAvatar c={c} group={g} size={52} />
          <View style={{ flex: 1 }}>
            <Pressable onPress={async () => { await Clipboard.setStringAsync(g.name); say('Group name copied.'); }}>
              <Text style={{ fontFamily: SERIF, fontSize: 28, color: c.ink }}>{g.name}</Text>
            </Pressable>
            <Text style={{ fontFamily: MONO, fontSize: 11, color: c.muted }}>{members.length} member{members.length === 1 ? '' : 's'} - tap name to copy</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 24, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, marginBottom: 14 }}>
          {sections.map(([key, label]) => (
            <Pressable key={key} onPress={() => setSection(key)}
              style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 20, backgroundColor: section === key ? c.leather : 'transparent' }}>
              <Text style={{ fontFamily: MONO_M, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: section === key ? c.onLeather : c.muted }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {section === 'feed' ? (
          <View style={{ flex: 1, marginHorizontal: -18 }}>
            <FeedList c={c} me={me} onOpenUser={onOpenUser}
              userFilter={members.map((m) => m.user_id)}
              emptyText="Nothing from this group yet. Ticks, perfect days, and new resets from members land here." />
          </View>
        ) : null}

        {section === 'chat' ? (
          <View style={{ flex: 1 }}>
            {!chatReady ? (
              <Card c={c}><Hint c={c} style={{ marginBottom: 0 }}>Chat is being set up on the backend. Check back shortly.</Hint></Card>
            ) : (
              <FlatList
                inverted
                data={msgs || []}
                keyExtractor={(m) => String(m.id)}
                ListEmptyComponent={msgs === null
                  ? <ActivityIndicator color={c.ink} style={{ marginTop: 20, transform: [{ scaleY: -1 }] }} />
                  : <Text style={{ fontFamily: MONO, fontSize: 12, color: c.muted, transform: [{ scaleY: -1 }], textAlign: 'center', marginTop: 20 }}>Quiet in here. Say something.</Text>}
                renderItem={({ item: m }) => {
                  const mine = m.user_id === me;
                  return (
                    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                      {!mine ? (
                        <Text style={{ fontFamily: MONO_M, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: c.muted, marginBottom: 2 }}>
                          {m.profiles?.display_name || m.profiles?.username || '?'}
                        </Text>
                      ) : null}
                      {/* Every piece of user content needs a reachable report
                          path (App Store 1.2). Long-press is the platform
                          convention for a message; the hint below says so, so
                          it is discoverable to a reviewer and to users. */}
                      <Pressable disabled={mine} onLongPress={() => Alert.alert(
                        'This message',
                        m.profiles?.username ? 'From @' + m.profiles.username : 'From this user',
                        [{ text: 'Report message', style: 'destructive',
                           onPress: () => promptReport({
                             targetUser: m.user_id, kind: 'message', messageId: m.id, say }) },
                         { text: 'Block this person', style: 'destructive',
                           onPress: () => blockUser(m.user_id, say, loadMsgs) },
                         { text: 'Cancel', style: 'cancel' }])}
                        style={{
                          maxWidth: '82%', paddingVertical: 9, paddingHorizontal: 13, borderRadius: 14,
                          backgroundColor: mine ? c.leather : c.card,
                          borderWidth: mine ? 0 : 1, borderColor: c.line,
                        }}>
                        <Text style={{ fontFamily: MONO, fontSize: 13, lineHeight: 19, color: mine ? c.onLeather : c.ink }}>{m.body}</Text>
                      </Pressable>
                      <Text style={{ fontFamily: MONO, fontSize: 9, color: c.muted, marginTop: 2 }}>{ago(m.created_at)}</Text>
                    </View>
                  );
                }}
              />
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Input c={c} placeholder="Write to the group" value={draft} onChangeText={setDraft}
                style={{ flex: 1, borderRadius: 22, paddingHorizontal: 16 }} maxLength={2000}
                onSubmitEditing={send} returnKeyType="send" />
              <Btn c={c} label="Send" onPress={send} style={{ borderRadius: 22 }} />
            </View>
            <Text style={{ fontFamily: MONO, fontSize: 10, color: c.muted, marginTop: 6 }}>
              Hold a message to report it or block whoever sent it.
            </Text>
          </View>
        ) : null}

        {section === 'members' ? (
          <ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Btn c={c} small label={inviteOpen ? 'Close invite' : 'Invite'} onPress={() => {
                const next = !inviteOpen;
                setInviteOpen(next);
                if (next) loadFriendOpts();
              }} />
              <Btn c={c} small ghost label="Share code" onPress={shareCode} />
            </View>
            {inviteOpen ? (
              <Card c={c}>
                <H2 c={c}>Add a friend</H2>
                {friendOpts === null ? <ActivityIndicator color={c.ink} /> : null}
                {friendOpts && !friendOpts.length ? (
                  <Hint c={c} style={{ marginBottom: 0 }}>All of your friends are already here, or you have none yet. Share the code instead.</Hint>
                ) : null}
                {(friendOpts || []).map((p, pi) => (
                  <View key={pi} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderColor: c.lineSoft, gap: 10 }}>
                    <Text style={{ fontFamily: MONO_M, fontSize: 14, color: c.ink, flex: 1 }}>{p.display_name || p.username}</Text>
                    <Btn c={c} small label="Add" onPress={() => addFriendToGroup(p.id)} />
                  </View>
                ))}
              </Card>
            ) : null}
            <Card c={c}>
              {members.map((m, mi) => (
                <Pressable key={mi} onPress={() => m.profiles?.username && onOpenUser(m.profiles.username)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
                    borderBottomWidth: mi === members.length - 1 ? 0 : 1, borderColor: c.lineSoft,
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: c.leather, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: SERIF, fontSize: 17, color: c.ink, textTransform: 'uppercase' }}>
                      {(m.profiles?.username || '?')[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: MONO_M, fontSize: 14, color: c.ink }}>{m.profiles?.display_name || m.profiles?.username || 'unnamed'}</Text>
                    {m.profiles?.username ? <Text style={{ fontFamily: MONO, fontSize: 11, color: c.muted }}>@{m.profiles.username}</Text> : null}
                  </View>
                  <Text style={{ fontFamily: SERIF, fontSize: 20, color: c.gold }}>{'>'}</Text>
                </Pressable>
              ))}
            </Card>
            <Hint c={c}>Tap a member to see their ledger. Group-mates see each other's friends-tier plans; private stays private.</Hint>
          </ScrollView>
        ) : null}

        {section === 'settings' ? (
          <ScrollView>
            <Card c={c}>
              <H2 c={c}>Group image</H2>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <GroupAvatar c={c} group={g} size={64} />
                <Btn c={c} label="Change image" ghost small onPress={pickImage} />
              </View>
            </Card>
            <Card c={c}>
              <H2 c={c}>Invite code</H2>
              <Pressable onPress={async () => { await Clipboard.setStringAsync(g.invite_code); say('Invite code copied.'); }}>
                <Text style={{ fontFamily: SERIF, fontSize: 30, letterSpacing: 3, color: c.ink }}>{g.invite_code}</Text>
              </Pressable>
              <Hint c={c} style={{ marginTop: 6 }}>Tap to copy. Anyone with this code can join from the Social page.</Hint>
              <Btn c={c} small ghost label="Share code" onPress={shareCode} />
            </Card>
            <Card c={c}>
              <H2 c={c}>This group in your main feed</H2>
              <Hint c={c}>Silencing removes these members from your main feed unless they are your friends or share another group with you. The group's own Feed tab stays.</Hint>
              <Btn c={c} small ghost label={gMuted ? 'Allow in main feed' : 'Silence in main feed'} onPress={toggleMute} />
            </Card>
            <Card c={c}>
              <Btn c={c} label="Leave group" ghost onPress={() => {
                Alert.alert('Leave group', 'Leave ' + g.name + '?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: async () => {
                    await sb.from('group_members').delete().eq('group_id', g.id).eq('user_id', me);
                    onBack();
                  } },
                ]);
              }} />
            </Card>
          </ScrollView>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function FriendsScreen({ c, me, onOpenUser, say, onBack }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    const r = await sb.from('friendships').select(
      '*, a:profiles!friendships_user_a_fkey(id, username, display_name), b:profiles!friendships_user_b_fkey(id, username, display_name)');
    setRows(r.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const request = async () => {
    const v = query.trim().toLowerCase();
    if (!v) return;
    const p = await sb.from('profiles').select('id, username').eq('username', v).maybeSingle();
    if (!p.data) { say('No one has claimed "' + v + '".'); return; }
    if (p.data.id === me) { say('That is you.'); return; }
    const a = me < p.data.id ? me : p.data.id;
    const b = me < p.data.id ? p.data.id : me;
    const r = await sb.from('friendships').insert({ user_a: a, user_b: b, requested_by: me, status: 'pending' });
    say(r.error ? (r.error.code === '23505' ? 'Request already exists.' : 'Failed.') : 'Requested.');
    setQuery('');
    load();
  };

  const friends = [], incoming = [], outgoing = [];
  rows.forEach((row) => {
    const other = row.a && row.a.id === me ? row.b : row.a;
    if (!other) return;
    if (row.status === 'accepted') friends.push({ row, other });
    else if (row.requested_by === me) outgoing.push({ row, other });
    else incoming.push({ row, other });
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <BackRow c={c} onBack={onBack} />
      <PageHeader c={c} eyebrow="Witnesses to the thirty days" title="Friends" />

      <Card c={c}>
        <H2 c={c}>Add a friend</H2>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input c={c} placeholder="Their username" autoCapitalize="none" value={query} onChangeText={setQuery} style={{ flex: 1 }} />
          <Btn c={c} label="Request" onPress={request} />
        </View>
      </Card>

      {incoming.length ? (
        <Card c={c}>
          <H2 c={c}>Requests for you</H2>
          {incoming.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: c.lineSoft, gap: 10 }}>
              <Pressable onPress={() => onOpenUser(f.other.username)} style={{ flex: 1 }}>
                <Text style={{ fontFamily: MONO_M, fontSize: 14, color: c.ink }}>{f.other.display_name || f.other.username}</Text>
              </Pressable>
              <Btn c={c} small label="Accept" onPress={async () => {
                await sb.from('friendships').update({ status: 'accepted' }).eq('user_a', f.row.user_a).eq('user_b', f.row.user_b);
                load();
              }} />
              <Pressable hitSlop={8} onPress={async () => {
                await sb.from('friendships').delete().eq('user_a', f.row.user_a).eq('user_b', f.row.user_b);
                load();
              }}>
                <Text style={{ fontFamily: MONO, fontSize: 12, color: c.danger }}>decline</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}

      <Card c={c}>
        <H2 c={c}>Friends</H2>
        {!friends.length ? <Hint c={c} style={{ marginBottom: 0 }}>No friends yet. Accountability needs witnesses.</Hint> : null}
        {friends.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: c.lineSoft }}>
            <Pressable onPress={() => onOpenUser(f.other.username)} style={{ flex: 1 }}>
              <Text style={{ fontFamily: MONO_M, fontSize: 14, color: c.ink }}>{f.other.display_name || f.other.username}</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => {
              Alert.alert('Remove friend', 'Remove ' + f.other.username + '?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: async () => {
                  await sb.from('friendships').delete().eq('user_a', f.row.user_a).eq('user_b', f.row.user_b);
                  load();
                } },
              ]);
            }}>
              <Text style={{ fontFamily: MONO, fontSize: 12, color: c.danger }}>remove</Text>
            </Pressable>
          </View>
        ))}
        {outgoing.map((f, i) => (
          <View key={i} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: c.lineSoft }}>
            <Text style={{ fontFamily: MONO, fontSize: 13, color: c.muted }}>{f.other.username}  (pending)</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

/* ---------- public profile ---------- */

function ProfileScreen({ c, username, me, onBack, say }) {
  const [prof, setProf] = useState(undefined);
  const [plans, setPlans] = useState([]);
  const [friendState, setFriendState] = useState(null);

  useEffect(() => {
    (async () => {
      const p = await sb.from('profiles').select('*').eq('username', username.toLowerCase()).maybeSingle();
      setProf(p.data || null);
      if (!p.data) return;
      const pl = await sb.from('plans').select('*').eq('owner', p.data.id).order('created_at', { ascending: false });
      const out = await Promise.all((pl.data || []).map(async (row) => {
        const days = {}, weeks = {};
        const [dr, wr] = await Promise.all([
          sb.from('plan_days').select('*').eq('plan_id', row.id),
          sb.from('plan_weeks').select('*').eq('plan_id', row.id),
        ]);
        (dr.data || []).forEach((r) => { days[r.day] = r.checks; });
        (wr.data || []).forEach((r) => { weeks[r.week] = r.checks; });
        return { row, days, weeks };
      }));
      setPlans(out);
      if (p.data.id !== me) {
        const a = me < p.data.id ? me : p.data.id;
        const b = me < p.data.id ? p.data.id : me;
        const fr = await sb.from('friendships').select('*').eq('user_a', a).eq('user_b', b).maybeSingle();
        setFriendState(fr.data ? fr.data.status : 'none');
      }
    })();
  }, [username, me]);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 24, paddingBottom: 40 }}>
      <Pressable onPress={onBack} style={{ marginBottom: 10 }}>
        <Text style={{ fontFamily: MONO_M, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: c.muted }}>{'<'} Back</Text>
      </Pressable>
      {prof === undefined ? <ActivityIndicator color={c.ink} /> : null}
      {prof === null ? (
        <>
          <Text style={{ fontFamily: SERIF, fontSize: 34, color: c.ink }}>No such account</Text>
          <Hint c={c}>Nobody has claimed "{username}".</Hint>
        </>
      ) : null}
      {prof ? (
        <>
          <PageHeader c={c} eyebrow="The ledger of" title={prof.display_name || prof.username} />
          {prof.id !== me && friendState === 'none' ? (
            <Btn c={c} label="Add friend" ghost style={{ alignSelf: 'flex-start', marginTop: 10 }} onPress={async () => {
              const a = me < prof.id ? me : prof.id;
              const b = me < prof.id ? prof.id : me;
              const r = await sb.from('friendships').insert({ user_a: a, user_b: b, requested_by: me, status: 'pending' });
              if (!r.error) { setFriendState('pending'); say('Requested.'); }
            }} />
          ) : null}
          {friendState === 'pending' ? <Hint c={c} style={{ marginTop: 8 }}>Friend request pending.</Hint> : null}
          {friendState === 'accepted' ? <Hint c={c} style={{ marginTop: 8 }}>Friends.</Hint> : null}
          {prof.id !== me ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Btn c={c} small ghost label="Report" onPress={() => promptReport({
                targetUser: prof.id, kind: 'profile', say })} />
              <Btn c={c} small ghost label="Block" onPress={() => Alert.alert(
                'Block @' + prof.username + '?',
                'Neither of you will see the other\'s ledger, feed activity or group messages. You can undo this in Account.',
                [{ text: 'Cancel', style: 'cancel' },
                 { text: 'Block', style: 'destructive',
                   onPress: () => blockUser(prof.id, say, onBack) }])} />
            </View>
          ) : null}
          {!plans.length ? (
            <Card c={c} style={{ marginTop: 16 }}>
              <Hint c={c} style={{ marginBottom: 0 }}>Nothing visible here. Their plans are private, or friends-only and you are not friends yet.</Hint>
            </Card>
          ) : null}
          {plans.map(({ row, days, weeks }) => {
            const plan = planRowToObj(row);
            return (
              <View key={row.id} style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontFamily: SERIF, fontSize: 27, color: c.ink }}>{plan.name}</Text>
                  <VTag c={c} v={plan.visibility} />
                </View>
                {plan.intent ? <Text style={{ fontFamily: SERIF_I, fontSize: 16, color: c.muted, marginTop: 2 }}>{plan.intent}</Text> : null}
                <Ledger c={c} plan={plan}
                  getDay={(d) => days[d]} getWeek={(w) => weeks[w]}
                  onToggleDay={() => {}} onToggleWeek={() => {}}
                  readOnly sel={null} setSel={null} />
              </View>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

/* ---------- account ---------- */

function AccountScreen({ c, profile, SP, setSP, onProfileSaved, say }) {
  const [username, setUsername] = useState(profile?.username || '');
  const [display, setDisplay] = useState(profile?.display_name || '');
  const [token, setToken] = useState('');
  const [newPw, setNewPw] = useState('');
  const [blocked, setBlocked] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await sb.from('blocks').select('blocked, profiles!blocks_blocked_fkey(username, display_name)');
      setBlocked(r.error ? [] : (r.data || []));
    })();
  }, []);
  // profile loads async after sign-in; useState initializers only run on first
  // mount, so re-seed the fields whenever the profile actually arrives.
  useEffect(() => {
    setUsername(profile?.username || '');
    setDisplay(profile?.display_name || '');
  }, [profile]);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <PageHeader c={c} eyebrow="Account" title={profile?.username ? `@${profile.username}` : 'Unnamed'} />

      <Card c={c}>
        <H2 c={c}>Identity</H2>
        <Hint c={c}>Your username is your public address. Lowercase letters, digits, underscores.</Hint>
        <Input c={c} placeholder="username" autoCapitalize="none" value={username} onChangeText={setUsername} />
        <Input c={c} placeholder="Display name" value={display} onChangeText={setDisplay} style={{ marginTop: 8 }} />
        <Btn c={c} label="Save" style={{ marginTop: 10 }} onPress={async () => {
          const u = username.trim().toLowerCase();
          if (u && !/^[a-z0-9_]{3,20}$/.test(u)) { say('3-20 chars: a-z, 0-9, underscore.'); return; }
          const { data } = await sb.auth.getSession();
          const r = await sb.from('profiles').update({ username: u || null, display_name: display.trim() })
            .eq('id', data.session.user.id);
          if (r.error) say(r.error.code === '23505' ? 'That username is taken.' : 'Failed.');
          else { say('Saved.'); onProfileSaved(); }
        }} />
      </Card>

      {SP && SP.plan ? (
        <Card c={c}>
          <H2 c={c}>Plan visibility</H2>
          <Hint c={c}>"{SP.plan.name}" is currently {SP.plan.visibility}.</Hint>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['private', 'friends', 'public'].map((v) => (
              <Pressable key={v} onPress={async () => {
                const r = await sb.from('plans').update({ visibility: v }).eq('id', SP.plan.id);
                if (!r.error) { setSP({ ...SP, plan: { ...SP.plan, visibility: v } }); say(`Visibility: ${v}`); }
              }} style={{
                borderWidth: 1.5, borderColor: SP.plan.visibility === v ? c.ink : c.line,
                backgroundColor: SP.plan.visibility === v ? c.ink : 'transparent',
                paddingVertical: 8, paddingHorizontal: 12,
              }}>
                <Text style={{ fontFamily: MONO, fontSize: 12, color: SP.plan.visibility === v ? c.paper : c.ink }}>{v}</Text>
              </Pressable>
            ))}
          </View>
          <Btn c={c} label="Delete this plan" ghost small style={{ marginTop: 14, alignSelf: 'flex-start' }} onPress={() => {
            Alert.alert('Delete plan', `Delete "${SP.plan.name}" and all thirty days? This cannot be undone.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => {
                await sb.from('plans').delete().eq('id', SP.plan.id);
                setSP(null);
              } },
            ]);
          }} />
        </Card>
      ) : null}

      <Card c={c}>
        <H2 c={c}>Password</H2>
        <Hint c={c}>Set or change the password you sign in with, here and on the website.</Hint>
        <Input c={c} placeholder="New password (8+ characters)" secureTextEntry autoCapitalize="none"
          autoComplete="new-password" value={newPw} onChangeText={setNewPw} />
        <Btn c={c} label="Save password" ghost style={{ marginTop: 10 }} onPress={async () => {
          if (newPw.length < 8) { say('Password needs 8+ characters.'); return; }
          const r = await sb.auth.updateUser({ password: newPw });
          say(r.error ? 'Failed to save password.' : 'Password saved.');
          if (!r.error) setNewPw('');
        }} />
      </Card>

      <Card c={c}>
        <H2 c={c}>API access</H2>
        <Hint c={c}>Hand this token to your own tools or your Claude to manage your ledger over the REST API. Treat it like a password.</Hint>
        <Btn c={c} label="Reveal token" ghost onPress={async () => {
          const { data } = await sb.auth.getSession();
          setToken(data.session?.access_token || 'no session');
        }} />
        {token ? (
          <Text selectable style={{ fontFamily: MONO, fontSize: 10, color: c.muted, marginTop: 10 }}>{token}</Text>
        ) : null}
      </Card>

      {/* The block confirmation promises this exists, so it has to. */}
      <Card c={c}>
        <H2 c={c}>Blocked accounts</H2>
        {blocked === null ? <ActivityIndicator color={c.ink} /> : null}
        {blocked && !blocked.length ? (
          <Hint c={c} style={{ marginBottom: 0 }}>You have not blocked anyone.</Hint>
        ) : null}
        {(blocked || []).map((b) => (
          <View key={b.blocked} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
            borderBottomWidth: 1, borderColor: c.lineSoft }}>
            <Text style={{ fontFamily: MONO_M, fontSize: 14, color: c.ink, flex: 1 }}>
              {b.profiles?.display_name || b.profiles?.username || 'unknown'}
            </Text>
            <Btn c={c} small ghost label="Unblock" onPress={async () => {
              const r = await sb.from('blocks').delete()
                .eq('blocker', profile.id).eq('blocked', b.blocked);
              if (r.error) { say('Could not unblock.'); return; }
              setBlocked((p) => p.filter((x) => x.blocked !== b.blocked));
              say('Unblocked.');
            }} />
          </View>
        ))}
      </Card>

      <Card c={c}>
        <H2 c={c}>Legal</H2>
        <Hint c={c}>The rules for what can be posted, and exactly what this app stores about you.</Hint>
        <Btn c={c} label="Terms of use" ghost small onPress={() => Linking.openURL(SITE_URL + 'terms.html')} />
        <Btn c={c} label="Privacy policy" ghost small style={{ marginTop: 8 }}
          onPress={() => Linking.openURL(SITE_URL + 'privacy.html')} />
        <Btn c={c} label="Contact support" ghost small style={{ marginTop: 8 }}
          onPress={() => Linking.openURL('mailto:' + CONTACT_EMAIL + '?subject=Metanoia')} />
      </Card>

      <Card c={c}>
        <Btn c={c} label="Sign out" ghost onPress={() => sb.auth.signOut()} />
      </Card>

      {/* App Store 5.1.1(v): deletion must be reachable in the app and must
          actually delete, not deactivate. delete_me() removes the auth user
          and every table cascades from it. */}
      <Card c={c}>
        <H2 c={c}>Delete account</H2>
        <Hint c={c}>
          This erases your account for good: your login, profile, plans, every day you ticked,
          your todos, your group memberships and your messages. Immediate, permanent, no recovery.
        </Hint>
        <Btn c={c} label="Delete my account" ghost onPress={() => {
          Alert.alert('Delete your account?',
            'Everything goes: your ledger, your streak, your todos, your messages. This cannot be undone.',
            [{ text: 'Cancel', style: 'cancel' },
             { text: 'Continue', style: 'destructive', onPress: () => {
               Alert.alert('Last chance',
                 'There is no recovery and no grace period. Delete ' +
                 (profile?.username ? '@' + profile.username : 'this account') + ' permanently?',
                 [{ text: 'Keep my account', style: 'cancel' },
                  { text: 'Delete permanently', style: 'destructive', onPress: async () => {
                    const r = await sb.rpc('delete_me');
                    if (r.error) { say('Could not delete the account. Email support.'); return; }
                    await sb.auth.signOut();
                  } }]);
             } }]);
        }} />
      </Card>
    </ScrollView>
  );
}
