import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Modal, Animated, Easing, Pressable } from 'react-native';

export type CelebrationKind = 'four' | 'six';
export type CelebrationEvent = { kind: CelebrationKind; batter: string; id: number };

const DURATION_MS = 3000;
const BURST = ['🎉', '✨', '🎊', '⭐', '🔥', '🏏', '✨', '🎉'];

const THEME: Record<CelebrationKind, { title: string; sub: string; color: string; glow: string }> = {
  four: { title: 'FOUR!', sub: 'Cracking boundary', color: '#2563EB', glow: '#60A5FA' },
  six: { title: 'SIX!', sub: 'Out of the park', color: '#7C3AED', glow: '#C084FC' },
};

// Full-screen celebration shown for 3 seconds after a boundary; tap to dismiss early
export default function Celebration({ event, onDone }: { event: CelebrationEvent | null; onDone: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!event) return;
    pop.setValue(0);
    burst.setValue(0);
    spin.setValue(0);
    const anim = Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })),
    ]);
    anim.start();
    const t = setTimeout(onDone, DURATION_MS);
    return () => { clearTimeout(t); anim.stop(); };
  }, [event?.id]);

  if (!event) return null;
  const th = THEME[event.kind];
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <Pressable style={s.overlay} onPress={onDone}>
        <Animated.View style={[s.rays, { borderColor: th.glow + '55', transform: [{ rotate }] }]} />
        {BURST.map((e, i) => {
          const angle = (i / BURST.length) * Math.PI * 2;
          const dist = burst.interpolate({ inputRange: [0, 1], outputRange: [0, 150] });
          return (
            <Animated.Text
              key={i}
              style={[s.burst, {
                opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0.85] }),
                transform: [
                  { translateX: Animated.multiply(dist, Math.cos(angle)) },
                  { translateY: Animated.multiply(dist, Math.sin(angle)) },
                ],
              }]}>
              {e}
            </Animated.Text>
          );
        })}
        <Animated.View style={[s.badge, { backgroundColor: th.color, shadowColor: th.glow, transform: [{ scale }] }]}>
          <Text style={s.badgeEmoji}>{event.kind === 'six' ? '🚀' : '🏏'}</Text>
          <Text style={s.badgeTitle}>{th.title}</Text>
        </Animated.View>
        <Animated.View style={{ opacity: pop, alignItems: 'center' }}>
          <Text style={s.congrats}>Congratulations {event.batter}! 🎉</Text>
          <Text style={s.sub}>{th.sub}</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#020617D9', justifyContent: 'center', alignItems: 'center' },
  rays: {
    position: 'absolute', width: 280, height: 280, borderRadius: 40,
    borderWidth: 14, borderStyle: 'dashed',
  },
  burst: { position: 'absolute', fontSize: 30 },
  badge: {
    width: 190, height: 190, borderRadius: 95, justifyContent: 'center', alignItems: 'center',
    borderWidth: 6, borderColor: '#FFFFFF40',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 30, elevation: 20,
  },
  badgeEmoji: { fontSize: 40, marginBottom: 2 },
  badgeTitle: { fontSize: 46, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  congrats: { marginTop: 34, fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center', paddingHorizontal: 24 },
  sub: { marginTop: 6, fontSize: 14, color: '#CBD5E1', fontWeight: '600' },
});
