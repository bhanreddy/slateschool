import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, Linking } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from '@/src/utils/haptics';
import StaffHeader from '../../src/components/StaffHeader';
import ViewAsBanner from '../../src/components/ViewAsBanner';
import { useAuth } from '../../src/hooks/useAuth';
import { useEffectiveStaffId } from '../../src/hooks/useEffectiveStaffId';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import { Staff, StaffService } from '../../src/services/staffService';

/** Returns the first human-readable ID (not a UUID) from the user object */
function getHumanId(user: any): string {
  const candidates = [user?.staff_code, user?.admission_no];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim().length > 0) return c;
  }
  return 'N/A';
}

const StaffProfileScreen = () => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    user
  } = useAuth();
  const { staffId, isViewingAsAdmin, viewAsName } = useEffectiveStaffId();
  const [viewedStaff, setViewedStaff] = React.useState<Staff | null>(null);

  React.useEffect(() => {
    if (!isViewingAsAdmin || !staffId) { setViewedStaff(null); return; }
    StaffService.getById(staffId).then(setViewedStaff).catch(() => setViewedStaff(null));
  }, [isViewingAsAdmin, staffId]);

  const displayName = isViewingAsAdmin ? (viewedStaff?.display_name || viewAsName) : user?.name;
  const photoUrl = isViewingAsAdmin ? viewedStaff?.photo_url : user?.photoUrl;
  const roleLabel = isViewingAsAdmin
    ? (viewedStaff?.designation_name || viewedStaff?.designation || 'Staff')
    : (user?.role ? user.role.name.charAt(0).toUpperCase() + user.role.name.slice(1) : 'Staff');
  const humanId = isViewingAsAdmin ? (viewedStaff?.staff_code || 'N/A') : getHumanId(user);
  const email = isViewingAsAdmin ? viewedStaff?.email : user?.email;
  const phone = isViewingAsAdmin ? viewedStaff?.phone : user?.phone;

  const handleCall = (number: string) => {
    Haptics.selectionAsync();
    Linking.openURL(`tel:${number}`);
  };
  const handleEmail = (email: string) => {
    Haptics.selectionAsync();
    Linking.openURL(`mailto:${email}`);
  };
  const InfoRow = ({
    icon,
    label,
    value,
    isLink = false,
    onPress
  }: {
    icon: any;
    label: string;
    value: string;
    isLink?: boolean;
    onPress?: () => void;
  }) => {
    return <TouchableOpacity style={styles.infoRow} activeOpacity={isLink ? 0.7 : 1} onPress={isLink ? onPress : undefined} disabled={!isLink}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={20} color="#6366F1" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, isLink && styles.linkText]}>{value}</Text>
      </View>
      {isLink && <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />}
    </TouchableOpacity>;
  };
  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />

    <StaffHeader title="My Profile" showBackButton={true} />
    {isViewingAsAdmin && <ViewAsBanner name={viewAsName} />}

    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* --- Header Profile Card --- */}
      <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.headerCard}>
        <LinearGradient colors={['#4F46E5', '#4338CA']} start={{
          x: 0,
          y: 0
        }} end={{
          x: 1,
          y: 1
        }} style={styles.headerBackground} />

        <View style={styles.profileContent}>
          <View style={styles.avatarContainer}>
            <Image source={{
              uri: photoUrl || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
            }} style={styles.avatar} />
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>

          <Text style={styles.name}>{displayName || 'Staff Member'}</Text>
          <Text style={styles.designation}>{roleLabel}</Text>
          <Text style={styles.staffId}>Staff ID: {humanId}</Text>

          <View style={styles.quickStatsRow}>
            <View style={styles.quickStat}>
              <Text style={styles.statNumber}>10+ Years</Text>
              <Text style={styles.statLabel}>Experience</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.quickStat}>
              <Text style={styles.statNumber}>M.Sc, B.Ed</Text>
              <Text style={styles.statLabel}>Qualification</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.quickStat}>
              <Text style={styles.statNumber}>Full Time</Text>
              <Text style={styles.statLabel}>Shift</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* --- Personal Information --- */}
      <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="mail-outline" label="Email Address" value={email || 'N/A'} isLink onPress={() => email && handleEmail(email)} />
          <View style={styles.divider} />
          <InfoRow icon="call-outline" label="Phone Number" value={phone || 'N/A'} isLink onPress={() => phone && handleCall(phone)} />
          <View style={styles.divider} />
          <InfoRow icon="calendar-outline" label="Date of Birth" value="-" />
          <View style={styles.divider} />
          <InfoRow icon="water-outline" label="Blood Group" value="-" />
          <View style={styles.divider} />
          <InfoRow icon="location-outline" label="Current Address" value="-" />
        </View>
      </Animated.View>

      {/* --- Academic Details --- */}
      <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Academic Details</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={[styles.iconBox, {
              backgroundColor: '#ECFDF5'
            }]}>
              <Ionicons name="school-outline" size={20} color="#10B981" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Primary Subject</Text>
              <Text style={styles.infoValue}>Mathematics</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={[styles.iconBox, {
              backgroundColor: '#EEF2FF'
            }]}>
              <Ionicons name="book-outline" size={20} color="#4F46E5" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Secondary Subject</Text>
              <Text style={styles.infoValue}>Physics</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={[styles.iconBox, {
              backgroundColor: '#FFFBEB'
            }]}>
              <Ionicons name="people-outline" size={20} color="#F59E0B" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Class Teacher</Text>
              <Text style={styles.infoValue}>Class 10th - Section A</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* --- Emergency Contact --- */}
      <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Emergency Contact</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="person-outline" label="Contact Person" value="Suresh Reddy (Brother)" />
          <View style={styles.divider} />
          <InfoRow icon="call-outline" label="Emergency Number" value="+91 98989 89898" isLink onPress={() => handleCall('+919898989898')} />
        </View>
      </Animated.View>

      <View style={{
        height: 40
      }} />
    </ScrollView>
  </View>;
};
export default StaffProfileScreen;
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  scrollContent: {
    padding: 20
  },
  // Header Card
  headerCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 10
    },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: theme.colors.background
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120
  },
  profileContent: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: theme.colors.background
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.background
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#059669'
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4
  },
  designation: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500'
  },
  staffId: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginBottom: 20,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden'
  },
  quickStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.card
  },
  quickStat: {
    alignItems: 'center',
    paddingHorizontal: 12
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border
  },
  // Sections
  sectionContainer: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    marginLeft: 4
  },
  infoCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 8,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  infoContent: {
    flex: 1
  },
  infoLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 2
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937'
  },
  linkText: {
    color: theme.colors.primary
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.card,
    marginLeft: 60
  }
});