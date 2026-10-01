import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Easing, Pressable,
} from 'react-native';
import { C } from '../theme/colors';

export type PopupType = 'info' | 'success' | 'error' | 'warning' | 'confirm' | 'danger';
export type PopupButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
export type PopupOptions = {
  type?: PopupType;
  title: string;
  message?: string;
  icon?: string;
  // Large, letter-spaced value shown in a highlighted box (e.g. a share code)
  highlight?: string;
  buttons?: PopupButton[];
  dismissable?: boolean;
};

const THEME: Record<PopupType, { icon: string; color: string; light: string }> = {
  info: { icon: 'ℹ️', color: C.accent, light: C.accentLight },
  success: { icon: '✅', color: C.green, light: C.greenLight },
  error: { icon: '⛔', color: C.primary, light: C.primaryLight },
  warning: { icon: '⚠️', color: C.orange, light: C.orangeLight },
  confirm: { icon: '❓', color: C.accent, light: C.accentLight },
  danger: { icon: '🗑️', color: C.primary, light: C.primaryLight },
};

// ─── Animated card shell, reusable for custom popups (forms etc.) ───────

type CardProps = {
  visible: boolean;
  onRequestClose?: () => void;
  children: React.ReactNode;
};

export function PopupCard({ visible, onRequestClose, children }: CardProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true })
        .start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onRequestClose}>
      <Animated.View style={[s.overlay, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export function PopupIcon({ type = 'info', icon }: { type?: PopupType; icon?: string }) {
  const t = THEME[type];
  return (
    <View style={[s.iconRing, { backgroundColor: t.light, borderColor: t.color + '30' }]}>
      <Text style={s.iconText}>{icon || t.icon}</Text>
    </View>
  );
}

// ─── Global imperative popup (drop-in replacement for Alert.alert) ──────

let hostShow: ((o: PopupOptions) => void) | null = null;
const pending: PopupOptions[] = [];

export const popup = {
  show(o: PopupOptions) {
    if (hostShow) hostShow(o);
    else pending.push(o);
  },
  alert(title: string, message?: string, buttons?: PopupButton[], type?: PopupType) {
    const inferred: PopupType = type
      ?? (buttons?.some(b => b.style === 'destructive') ? 'danger' : buttons && buttons.length > 1 ? 'confirm' : 'info');
    popup.show({ title, message, buttons, type: inferred });
  },
};

export function PopupHost() {
  const [queue, setQueue] = useState<PopupOptions[]>([]);
  const [visible, setVisible] = useState(false);
  const current = queue[0];

  useEffect(() => {
    hostShow = o => setQueue(q => [...q, o]);
    if (pending.length) setQueue(q => [...q, ...pending.splice(0)]);
    return () => { hostShow = null; };
  }, []);

  useEffect(() => {
    if (current && !visible) setVisible(true);
  }, [current, visible]);

  const close = (btn?: PopupButton) => {
    setVisible(false);
    // Let the exit animation finish before running the action / showing the next popup
    setTimeout(() => {
      setQueue(q => q.slice(1));
      btn?.onPress?.();
    }, 170);
  };

  if (!current) return null;

  const type = current.type ?? 'info';
  const t = THEME[type];
  const raw: PopupButton[] = current.buttons?.length ? current.buttons : [{ text: 'OK' }];
  const stacked = raw.length > 2;
  // Stacked layout keeps Cancel at the bottom; side-by-side keeps it on the left
  const buttons = stacked ? [...raw.filter(b => b.style !== 'cancel'), ...raw.filter(b => b.style === 'cancel')] : raw;
  const cancelBtn = buttons.find(b => b.style === 'cancel');

  return (
    <PopupCard
      visible={visible}
      onRequestClose={() => { if (current.dismissable !== false) close(cancelBtn); }}>
      <PopupIcon type={type} icon={current.icon} />
      <Text style={s.title}>{current.title}</Text>
      {!!current.message && <Text style={s.message}>{current.message}</Text>}
      {!!current.highlight && (
        <View style={[s.highlight, { borderColor: t.color + '50', backgroundColor: t.light }]}>
          <Text style={[s.highlightText, { color: t.color }]}>{current.highlight}</Text>
        </View>
      )}
      <View style={[s.btnRow, stacked && s.btnCol]}>
        {buttons.map((b, i) => {
          const isCancel = b.style === 'cancel';
          const color = b.style === 'destructive' ? C.primary : t.color;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.8}
              style={[s.btn, !stacked && s.btnFlex, isCancel ? s.btnCancel : { backgroundColor: color }]}
              onPress={() => close(b)}>
              <Text style={[s.btnText, isCancel && s.btnTextCancel]}>{b.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </PopupCard>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0F172A99', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: C.white, borderRadius: 24,
    paddingHorizontal: 22, paddingTop: 26, paddingBottom: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 16,
  },
  iconRing: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 6,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  iconText: { fontSize: 26 },
  title: { fontSize: 19, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 6 },
  message: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20 },
  highlight: {
    marginTop: 16, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'stretch', alignItems: 'center',
  },
  highlightText: { fontSize: 30, fontWeight: '900', letterSpacing: 8 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' },
  btnCol: { flexDirection: 'column' },
  btn: { paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  btnFlex: { flex: 1 },
  btnCancel: { backgroundColor: C.divider, borderWidth: 1, borderColor: C.cardBorder },
  btnText: { color: C.white, fontSize: 15, fontWeight: '700' },
  btnTextCancel: { color: C.textSub },
});
