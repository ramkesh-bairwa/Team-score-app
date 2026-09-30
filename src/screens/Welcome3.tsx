import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Dimensions, StatusBar,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function Welcome3({ navigation }: any) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const slideUp = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

      {/* Stadium arc */}
      <View style={styles.stadiumOuter} />
      <View style={styles.stadiumInner} />
      <View style={styles.stadiumCore} />

      {/* Pitch lines */}
      <View style={styles.pitchLines}>
        {[...Array(7)].map((_, i) => (
          <View key={i} style={[styles.pitchLine, {
            width: 40 + i * 30,
            opacity: 0.06 + i * 0.015,
          }]} />
        ))}
      </View>

      <Animated.View style={[styles.centerContent, {
        opacity: fade, transform: [{ scale }],
      }]}>
        {/* Trophy */}
        <Animated.View style={[styles.trophyContainer, { transform: [{ scale: pulse }] }]}>
          <Text style={styles.trophyEmoji}>🏏</Text>
          <View style={styles.trophyGlow} />
        </Animated.View>

        <Text style={styles.stepLabel}>03 / 03</Text>
        <Text style={styles.heading}>YOU'RE ALL{'\n'}<Text style={styles.headingAccent}>SET!</Text></Text>
        <Text style={styles.subText}>
          Join millions of cricket fans{'\n'}following every ball, every match.
        </Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { val: '50M+', label: 'Fans' },
            { val: '200+', label: 'Matches' },
            { val: '24/7', label: 'Live' },
          ].map((s, i) => (
            <View key={i} style={styles.statItem}>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={[styles.btnContainer, {
        opacity: fade, transform: [{ translateY: slideUp }],
      }]}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('Home')}>
          <Text style={styles.btnPrimaryText}>🏏  ENTER THE ARENA</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a', alignItems: 'center' },
  stadiumOuter: {
    position: 'absolute', bottom: -height * 0.3,
    width: width * 2, height: height * 0.7,
    borderRadius: width, backgroundColor: '#1a0a2e',
  },
  stadiumInner: {
    position: 'absolute', bottom: -height * 0.35,
    width: width * 1.6, height: height * 0.6,
    borderRadius: width * 0.8, backgroundColor: '#0f0f22',
  },
  stadiumCore: {
    position: 'absolute', bottom: -height * 0.4,
    width: width * 1.2, height: height * 0.5,
    borderRadius: width * 0.6, backgroundColor: '#0a0a1a',
    borderWidth: 1, borderColor: '#6c00ff20',
  },
  pitchLines: {
    position: 'absolute', bottom: height * 0.22,
    alignItems: 'center', gap: 10,
  },
  pitchLine: { height: 2, backgroundColor: '#ffffff', borderRadius: 1 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  trophyContainer: { marginBottom: 24, position: 'relative' },
  trophyEmoji: { fontSize: 80 },
  trophyGlow: {
    position: 'absolute', top: '20%', left: '10%',
    width: '80%', height: '60%',
    backgroundColor: '#ffcc0030', borderRadius: 40,
  },
  stepLabel: { color: '#ff3d3d', fontSize: 12, letterSpacing: 4, marginBottom: 12 },
  heading: {
    fontSize: 44, fontWeight: '900', color: '#fff',
    textAlign: 'center', lineHeight: 50, marginBottom: 16,
  },
  headingAccent: { color: '#00e5ff' },
  subText: {
    color: '#ffffff60', fontSize: 15, textAlign: 'center',
    lineHeight: 24, marginBottom: 32,
  },
  statsRow: {
    flexDirection: 'row', gap: 0,
    backgroundColor: '#161630', borderRadius: 20,
    overflow: 'hidden', borderWidth: 1, borderColor: '#ffffff08',
  },
  statItem: {
    paddingVertical: 16, paddingHorizontal: 28,
    alignItems: 'center', borderRightWidth: 1, borderRightColor: '#ffffff08',
  },
  statVal: { color: '#ff3d3d', fontWeight: '900', fontSize: 20 },
  statLabel: { color: '#ffffff50', fontSize: 11, marginTop: 2 },
  btnContainer: { width: '100%', paddingHorizontal: 30, paddingBottom: 60 },
  btnPrimary: {
    backgroundColor: '#ff3d3d', paddingVertical: 18,
    borderRadius: 50, alignItems: 'center',
    shadowColor: '#ff3d3d', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6, shadowRadius: 25, elevation: 15,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 20, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff30' },
  dotActive: { width: 24, backgroundColor: '#ff3d3d' },
});
