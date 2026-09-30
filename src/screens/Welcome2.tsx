import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Dimensions, StatusBar,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const FEATURES = [
  { icon: '📡', label: 'Live Scores', desc: 'Ball-by-ball updates in real time' },
  { icon: '📊', label: 'Deep Stats', desc: 'Player & match analytics' },
  { icon: '🏆', label: 'All Formats', desc: 'T20 · ODI · Test · IPL' },
];

export default function Welcome2({ navigation }: any) {
  const slideX = useRef(new Animated.Value(width)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const cardAnims = FEATURES.map(() => useRef(new Animated.Value(60)).current);
  const cardFades = FEATURES.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideX, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      FEATURES.forEach((_, i) => {
        setTimeout(() => {
          Animated.parallel([
            Animated.spring(cardAnims[i], { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
            Animated.timing(cardFades[i], { toValue: 1, duration: 400, useNativeDriver: true }),
          ]).start();
        }, i * 150);
      });
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d1f" />

      {/* Skip button top right */}
      <TouchableOpacity style={styles.skipTopBtn} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.skipTopText}>Skip</Text>
      </TouchableOpacity>

      {/* Diagonal accent */}
      <View style={styles.diagonalBg} />
      <View style={styles.diagonalBg2} />

      <Animated.View style={[styles.header, { opacity: fadeIn, transform: [{ translateX: slideX }] }]}>
        <Text style={styles.stepLabel}>02 / 03</Text>
        <Text style={styles.heading}>WHY{'\n'}<Text style={styles.headingAccent}>CRICSCORE?</Text></Text>
        <View style={styles.headingLine} />
      </Animated.View>

      <View style={styles.cardsContainer}>
        {FEATURES.map((f, i) => (
          <Animated.View
            key={i}
            style={[styles.card, {
              opacity: cardFades[i],
              transform: [{ translateY: cardAnims[i] }],
            }]}>
            <View style={styles.cardIconBox}>
              <Text style={styles.cardIcon}>{f.icon}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardLabel}>{f.label}</Text>
              <Text style={styles.cardDesc}>{f.desc}</Text>
            </View>
            <View style={styles.cardArrow}>
              <Text style={styles.cardArrowText}>›</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Scoreboard mockup */}
      <Animated.View style={[styles.scoreMock, { opacity: fadeIn }]}>
        <View style={styles.scoreMockHeader}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
          <Text style={styles.matchType}>Local · 10 Overs</Text>
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.teamName}>Team A</Text>
          <Text style={styles.scoreVal}>98/3</Text>
          <Text style={styles.overs}>(8.4)</Text>
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.teamName}>Team B</Text>
          <Text style={styles.scoreValGray}>needs 99</Text>
          <Text style={styles.overs}>(10 ov)</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.btnContainer, { opacity: fadeIn }]}>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Welcome3')}>
          <Text style={styles.btnText}>NEXT  →</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1f' },
  diagonalBg: {
    position: 'absolute', top: 0, right: -60,
    width: width * 0.6, height: height * 0.45,
    backgroundColor: '#1a0a3e', transform: [{ skewX: '-15deg' }],
  },
  diagonalBg2: {
    position: 'absolute', top: 0, right: -100,
    width: width * 0.4, height: height * 0.45,
    backgroundColor: '#6c00ff10', transform: [{ skewX: '-15deg' }],
  },
  header: { paddingTop: 70, paddingHorizontal: 30, marginBottom: 30 },
  stepLabel: { color: '#ff3d3d', fontSize: 12, letterSpacing: 4, marginBottom: 12 },
  heading: { fontSize: 42, fontWeight: '900', color: '#fff', lineHeight: 48 },
  headingAccent: { color: '#00e5ff' },
  headingLine: { width: 50, height: 3, backgroundColor: '#ff3d3d', marginTop: 16, borderRadius: 2 },
  cardsContainer: { paddingHorizontal: 24, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#161630', borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: '#ffffff08',
  },
  cardIconBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#0a0a1a', justifyContent: 'center', alignItems: 'center',
    marginRight: 16, borderWidth: 1, borderColor: '#6c00ff30',
  },
  cardIcon: { fontSize: 24 },
  cardText: { flex: 1 },
  cardLabel: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 3 },
  cardDesc: { color: '#ffffff50', fontSize: 12 },
  cardArrow: { paddingLeft: 8 },
  cardArrowText: { color: '#ff3d3d', fontSize: 24, fontWeight: '300' },
  scoreMock: {
    marginHorizontal: 24, marginTop: 20,
    backgroundColor: '#161630', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#00e5ff20',
  },
  scoreMockHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff3d3d', marginRight: 6 },
  liveText: { color: '#ff3d3d', fontWeight: '800', fontSize: 11, letterSpacing: 2, marginRight: 10 },
  matchType: { color: '#ffffff50', fontSize: 11 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  teamName: { color: '#00e5ff', fontWeight: '800', fontSize: 16, width: 50 },
  scoreVal: { color: '#fff', fontWeight: '900', fontSize: 22, flex: 1 },
  scoreValGray: { color: '#ffffff50', fontWeight: '700', fontSize: 18, flex: 1 },
  overs: { color: '#ffffff40', fontSize: 12 },
  btnContainer: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
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
