import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Dimensions, StatusBar,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function Welcome1({ navigation }: any) {
  const ballScale = useRef(new Animated.Value(0)).current;
  const ballY = useRef(new Animated.Value(-200)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(ballScale, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }),
        Animated.spring(ballY, { toValue: 0, tension: 60, friction: 6, useNativeDriver: true }),
      ]),
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(ripple, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ripple, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ]).start();
  }, []);

  const rippleScale = ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const rippleOpacity = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

      {/* Skip button top right */}
      <TouchableOpacity style={styles.skipTopBtn} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.skipTopText}>Skip</Text>
      </TouchableOpacity>

      {/* Background hexagon pattern */}
      <View style={styles.bgPattern}>
        {[...Array(20)].map((_, i) => (
          <View key={i} style={[styles.hexDot, {
            top: Math.random() * height,
            left: Math.random() * width,
            opacity: 0.05 + (i % 5) * 0.02,
          }]} />
        ))}
      </View>

      {/* Glowing arc top */}
      <View style={styles.arcTop} />
      <View style={styles.arcTopInner} />

      <View style={styles.centerContent}>
        {/* Ripple behind ball */}
        <Animated.View style={[styles.ripple, {
          transform: [{ scale: rippleScale }],
          opacity: rippleOpacity,
        }]} />

        {/* Cricket Ball */}
        <Animated.View style={[styles.ballWrapper, {
          transform: [{ scale: ballScale }, { translateY: ballY }],
        }]}>
          <View style={styles.ball}>
            <View style={styles.seamH} />
            <View style={styles.seamV} />
            <View style={styles.ballShine} />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeIn }}>
          <Text style={styles.tagline}>THE GAME BEGINS</Text>
          <Text style={styles.title}>CRIC<Text style={styles.titleAccent}>SCORE</Text></Text>
          <Text style={styles.subtitle}>Live. Fast. Accurate.</Text>
        </Animated.View>
      </View>

      {/* Bottom pitch lines */}
      <View style={styles.pitchContainer}>
        {[...Array(5)].map((_, i) => (
          <View key={i} style={[styles.pitchLine, { opacity: 0.3 - i * 0.05 }]} />
        ))}
      </View>

      <Animated.View style={[styles.btnContainer, { opacity: fadeIn }]}>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Welcome2')}>
          <Text style={styles.btnText}>NEXT  →</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Dots */}
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  bgPattern: { ...StyleSheet.absoluteFillObject },
  hexDot: {
    position: 'absolute', width: 6, height: 6,
    borderRadius: 3, backgroundColor: '#00e5ff',
  },
  arcTop: {
    position: 'absolute', top: -120, alignSelf: 'center',
    width: width * 1.4, height: 300, borderRadius: width * 0.7,
    backgroundColor: '#1a0a2e', borderWidth: 1, borderColor: '#6c00ff22',
  },
  arcTopInner: {
    position: 'absolute', top: -80, alignSelf: 'center',
    width: width * 1.1, height: 220, borderRadius: width * 0.55,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: '#00e5ff15',
  },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ripple: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    borderWidth: 2, borderColor: '#ff3d3d55',
  },
  ballWrapper: { marginBottom: 40 },
  ball: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#c0392b',
    shadowColor: '#ff0000', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 30,
    elevation: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
  },
  seamH: {
    position: 'absolute', width: '100%', height: 3,
    backgroundColor: '#fff', borderRadius: 2, opacity: 0.5,
    top: '48%',
  },
  seamV: {
    position: 'absolute', height: '100%', width: 3,
    backgroundColor: '#fff', borderRadius: 2, opacity: 0.5,
    left: '48%',
  },
  ballShine: {
    position: 'absolute', top: 12, left: 18,
    width: 28, height: 18, borderRadius: 14,
    backgroundColor: '#ffffff30',
    transform: [{ rotate: '-30deg' }],
  },
  tagline: {
    color: '#00e5ff', fontSize: 11, letterSpacing: 6,
    textAlign: 'center', marginBottom: 8, fontWeight: '600',
  },
  title: {
    fontSize: 52, fontWeight: '900', color: '#ffffff',
    textAlign: 'center', letterSpacing: 4,
  },
  titleAccent: { color: '#ff3d3d' },
  subtitle: {
    color: '#ffffff60', fontSize: 14, textAlign: 'center',
    letterSpacing: 3, marginTop: 10,
  },
  pitchContainer: {
    position: 'absolute', bottom: 140, width: '100%', alignItems: 'center',
  },
  pitchLine: {
    width: width * 0.5, height: 1, backgroundColor: '#ffffff',
    marginVertical: 6,
  },
  btnContainer: { alignItems: 'center', paddingBottom: 60 },
  btn: {
    backgroundColor: '#ff3d3d', paddingHorizontal: 50, paddingVertical: 16,
    borderRadius: 50, marginBottom: 16,
    shadowColor: '#ff3d3d', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 3 },
  skipTopBtn: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#ffffff15', borderRadius: 20,
    borderWidth: 1, borderColor: '#ffffff25',
  },
  skipTopText: { color: '#ffffff80', fontSize: 13, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 20, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff30' },
  dotActive: { width: 24, backgroundColor: '#ff3d3d' },
});
