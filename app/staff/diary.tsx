import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import AppTextInput from '@/src/components/AppTextInput';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AppDatePicker, { parseYMD } from '@/src/components/AppDatePicker';
import { format, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import StaffHeader from '../../src/components/StaffHeader';
import ViewAsBanner from '../../src/components/ViewAsBanner';
import { useEffectiveStaffId } from '../../src/hooks/useEffectiveStaffId';
import { DiaryService, DiaryEntry, TeacherService, TeacherClassAssignment } from '../../src/services/commonServices';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { Shadows, Radii, Spacing, Typography, Theme } from '../../src/theme/themes';
import { styles as fieldStyles } from '@/src/theme/styles';
import { api } from '../../src/services/apiClient';
import LogoLoader from '../../src/components/LogoLoader';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import {
  DiaryHistoryTabSwitcher,
  DiaryHistoryDatePickerSheet,
  DiaryHistoryDateSelectorButton,
  priorHistoryYmds,
  toYmd,
  type DiaryHistoryTabId,
} from '../../src/components/diary/DiaryHistoryChrome';

export default function StaffDiary() {
  const {
    user
  } = useAuth();
  const {
    theme,
    isDark
  } = useTheme();
  const { isViewingAsAdmin, viewAsName } = useEffectiveStaffId();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherClassAssignment | null>(null);
  const [existingEntry, setExistingEntry] = useState<DiaryEntry | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const scrollRef = React.useRef<ScrollView>(null);

  const todayAnchor = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => toYmd(todayAnchor), [todayAnchor]);
  const priorDates = useMemo(() => priorHistoryYmds(todayAnchor), [todayAnchor]);

  const [activeTab, setActiveTab] = useState<DiaryHistoryTabId>('today');
  const [historyDate, setHistoryDate] = useState(() => priorDates[0] ?? toYmd(new Date()));
  const [pickerVisible, setPickerVisible] = useState(false);

  const datesWithData = useMemo(
    () => [...new Set(diaryEntries.map((e) => e.entry_date))],
    [diaryEntries]
  );
  const calendarAvailableYmds = useMemo(
    () => [...new Set([...datesWithData, ...priorDates])],
    [datesWithData, priorDates]
  );

  // Load teacher assignments on mount
  useEffect(() => {
    fetchAssignments();
  }, []);
  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const data = await TeacherService.getMyClasses();
      setAssignments(data);
      if (data.length > 0) {
        setSelectedAssignment(data[0]);
      }
    } catch (error: any) {

      try {
        await api.post('/log', {
          msg: 'StaffDiary: fetchAssignments Failed',
          error: error.message
        }, {
          silent: true
        });
      } catch (e) {
        if (__DEV__) { }
      }
      alertCompat('Error', 'Could not load your assigned classes.');
    } finally {
      setLoading(false);
    }
  };

  // Load all homework in the diary retention window (today + prior 14 days).
  // Do not gate on assignments — teachers still need History even if class list fails.
  useEffect(() => {
    fetchDiaryHistory();
  }, [user?.userId, todayYmd, priorDates]);

  useEffect(() => {
    if (selectedAssignment) {
      checkExistingHomework();
    }
  }, [selectedAssignment, assignments]);

  const fetchDiaryHistory = async () => {
    try {
      const oldestYmd = priorDates[priorDates.length - 1];
      const allEntries = await DiaryService.getAll({
        from_date: oldestYmd,
        to_date: todayYmd,
      });
      setDiaryEntries(Array.isArray(allEntries) ? allEntries : []);
    } catch (error: any) {

      try {
        await api.post('/log', {
          msg: 'StaffDiary: fetchDiaryHistory Failed',
          error: error.message
        }, {
          silent: true
        });
      } catch (e) {
        if (__DEV__) { }
      }
    }
  };
  const checkExistingHomework = async () => {
    if (!selectedAssignment) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await DiaryService.getAll({
        class_section_id: selectedAssignment.class_section_id,
        entry_date: today,
        subject_id: selectedAssignment.subject_id
      });

      // Find if there's an entry for the specific subject today
      const match = data.find((e) => e.subject_id === selectedAssignment.subject_id);
      if (match) {
        setExistingEntry(match);
        setTitle(match.title || '');
        setDescription(match.content || '');
        if (match.homework_due_date) {
          try {
            setDueDate(parseISO(match.homework_due_date));
          } catch (e) {
            setDueDate(new Date());
          }
        }
      } else {
        setExistingEntry(null);
        setTitle('');
        setDescription('');
        setDueDate(new Date());
      }
    } catch (error) {

    }
  };
  const handleEdit = (entry: DiaryEntry) => {
    // 1. Find the assignment matching this entry
    const matchingAssignment = assignments.find((a) => a.class_section_id === entry.class_section_id && a.subject_id === entry.subject_id);
    if (matchingAssignment) {
      // 2. Switch context & Lock
      setSelectedAssignment(matchingAssignment);
      setIsEditing(true);

      // 3. Populate form
      setExistingEntry(entry);
      setTitle(entry.title || '');
      setDescription(entry.content || '');
      if (entry.homework_due_date) {
        try {
          setDueDate(parseISO(entry.homework_due_date));
        } catch (e) {
          setDueDate(new Date());
        }
      }

      // 4. Scroll to top
      scrollRef.current?.scrollTo({
        y: 0,
        animated: true
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      alertCompat("Notice", "This assignment is no longer in your active list.");
    }
  };
  const handlePost = async () => {
    if (isViewingAsAdmin) {
      alertCompat('Read-only', 'Diary entries can\'t be posted while viewing another staff member\'s portal.');
      return;
    }
    try {
      await api.post('/log', {
        msg: 'StaffDiary: handlePost initiated',
        isEditing,
        hasExisting: !!existingEntry,
        classId: selectedAssignment?.class_section_id
      }, {
        silent: true
      });
    } catch (e) {
      if (__DEV__) { }
    }
    if (!selectedAssignment) {
      alertCompat('Error', 'Please select a class and subject');
      return;
    }
    if (!description) {
      alertCompat('Error', 'Please enter homework description');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const dueStr = format(dueDate, 'yyyy-MM-dd');

    // Same calendar day + class + subject matches DB unique key — update if we have the row in memory
    const duplicateSameDay =
      !existingEntry &&
      diaryEntries.find(
        (e) =>
          e.class_section_id === selectedAssignment.class_section_id &&
          e.subject_id === selectedAssignment.subject_id &&
          e.entry_date === today
      );
    const entryToUpdate = existingEntry || duplicateSameDay || null;

    try {
      setSubmitting(true);
      const payload = {
        class_section_id: selectedAssignment.class_section_id,
        entry_date: entryToUpdate?.entry_date || today,
        subject_id: selectedAssignment.subject_id,
        title: title || `${selectedAssignment.subject_name} Homework`,
        content: description,
        homework_due_date: dueStr,
        created_by: user?.userId || ''
      };
      if (entryToUpdate) {
        await DiaryService.update(entryToUpdate.id, payload);
        alertCompat('Success', 'Homework updated successfully!');
      } else {
        await DiaryService.create(payload as any);
        alertCompat('Success', 'Homework posted successfully!');
      }
      setIsEditing(false);
      fetchDiaryHistory();
      if (!isEditing) checkExistingHomework();
    } catch (error: any) {

      try {
        await api.post('/log', {
          msg: 'StaffDiary: handlePost Failed',
          error: error.message,
          stack: error.stack
        }, {
          silent: true
        });
      } catch (e) {
        if (__DEV__) { }
      }
      alertCompat('Error', 'Failed to save homework');
    } finally {
      setSubmitting(false);
    }
  };
  if (loading && assignments.length === 0) {
    return <View style={[styles.container, {
      justifyContent: 'center',
      alignItems: 'center'
    }]}>
      <LogoLoader size={60} color={theme.colors.primary} />
    </View>;
  }
  return <View style={[styles.container, {
    backgroundColor: theme.colors.background
  }]}>
    <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
    <StaffHeader title="Diary & Homework" showBackButton={true} />
    {isViewingAsAdmin && <ViewAsBanner name={viewAsName} limited />}
    <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.delay(80).duration(500)} style={styles.tabWrap}>
        <DiaryHistoryTabSwitcher
          active={activeTab}
          onChange={setActiveTab}
          todayLabel="Today"
          historyLabel="History"
        />
      </Animated.View>

      {/* Assignment Selection + form — only on Today tab */}
      {activeTab === 'today' ? <>
        <View style={[styles.selectionSection, isEditing && {
          opacity: 0.6
        }]}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Text style={[styles.sectionTitle, {
              color: theme.colors.textStrong
            }]}>Select Class & Subject</Text>
            {isEditing && <TouchableOpacity onPress={() => {
              setIsEditing(false);
              setExistingEntry(null);
              setTitle('');
              setDescription('');
            }}>
              <Text style={{
                color: theme.colors.primary,
                fontWeight: '600',
                fontSize: 13
              }}>Cancel Edit</Text>
            </TouchableOpacity>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assignmentsScroll} pointerEvents={isEditing ? 'none' : 'auto'}>
            {assignments.map((assign) => {
              return <TouchableOpacity key={assign.assignment_id} disabled={isEditing} style={[styles.assignmentChip, {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card
              }, selectedAssignment?.assignment_id === assign.assignment_id && {
                borderColor: theme.colors.primary,
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF'
              }]} onPress={() => setSelectedAssignment(assign)}>
                <Text style={[styles.assignmentText, {
                  color: theme.colors.textSecondary
                }, selectedAssignment?.assignment_id === assign.assignment_id && {
                  color: theme.colors.primary,
                  fontWeight: '700'
                }]}>
                  {assign.class_name}-{assign.section_name} : {assign.subject_name}
                </Text>
              </TouchableOpacity>;
            })}
          </ScrollView>
        </View>
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={[styles.formCard, {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border
        }]}>
          <View style={styles.formHeader}>
            <Text style={[styles.cardTitle, {
              color: theme.colors.textStrong
            }]}>
              {existingEntry ? 'Modify Homework' : 'Post New Homework'}
            </Text>
            {existingEntry && <View style={styles.existingBadge}>
              <Text style={styles.existingBadgeText}>Existing Entry</Text>
            </View>}
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, {
              color: theme.colors.textSecondary
            }]}>Title (Optional)</Text>
            <AppTextInput style={{
              backgroundColor: isDark ? theme.colors.background : '#F9FAFB',
              borderColor: theme.colors.border,
              color: theme.colors.text
            }} placeholder="e.g. Chapter 5 Summary" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, {
              color: theme.colors.textSecondary
            }]}>Description</Text>
            <AppTextInput style={[styles.textArea, {
              backgroundColor: isDark ? theme.colors.background : '#F9FAFB',
              borderColor: theme.colors.border,
              color: theme.colors.text
            }]} placeholder="Details about the homework..." placeholderTextColor="#94A3B8" multiline numberOfLines={4} value={description} onChangeText={setDescription} textAlignVertical="top" />
          </View>
          <View style={styles.row}>
            <AppDatePicker
              label="Due Date"
              value={format(dueDate, 'yyyy-MM-dd')}
              onChange={(ymd) => setDueDate(parseYMD(ymd))}
              minimumDate={new Date()}
              isDark={isDark}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
          </View>
          <TouchableOpacity style={[styles.postButton, {
            backgroundColor: theme.colors.primary,
            opacity: submitting ? 0.7 : 1
          }]} activeOpacity={0.8} onPress={handlePost} disabled={submitting}>
            {submitting ? <LogoLoader color="#fff" /> : <>
              <Text style={styles.postButtonText}>{existingEntry ? 'Update Homework' : 'Post Homework'}</Text>
              <Ionicons name={existingEntry ? "save-outline" : "send"} size={18} color="#fff" style={{
                marginLeft: 8
              }} />
            </>}
          </TouchableOpacity>
        </Animated.View>
      </> : null}

      {activeTab === 'history' ? (
        <DiaryHistoryDateSelectorButton
          selectedYmd={historyDate}
          onPress={() => setPickerVisible(true)}
          onSelect={setHistoryDate}
        />
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, {
          color: theme.colors.textStrong
        }]}>
          {activeTab === 'today' ? "Today's homework" : 'Homework for selected day'}
        </Text>
      </View>
      <HomeworkDayList
        theme={theme}
        styles={styles}
        diaryEntries={diaryEntries}
        displayYmd={activeTab === 'today' ? todayYmd : historyDate}
        onEdit={handleEdit}
      />
    </ScrollView>

    <DiaryHistoryDatePickerSheet
      visible={pickerVisible}
      selectedYmd={historyDate}
      availableYmds={calendarAvailableYmds}
      onSelect={setHistoryDate}
      onClose={() => setPickerVisible(false)}
      subtitle="Dots mark days with posted homework"
    />
  </View>;
}

function HomeworkDayList({
  theme,
  styles,
  diaryEntries,
  displayYmd,
  onEdit,
}: {
  theme: Theme;
  styles: Record<string, object>;
  diaryEntries: DiaryEntry[];
  displayYmd: string;
  onEdit: (entry: DiaryEntry) => void;
}) {
  const items = diaryEntries.filter((e) => e.entry_date === displayYmd);
  if (items.length === 0) {
    return (
      <View style={styles.listContainer}>
        <View style={styles.emptyState}>
          <Ionicons name="book-outline" size={48} color={theme.colors.border} />
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            No homework for this day
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.listContainer}>
      <View style={styles.dateGroup}>
        <View style={styles.dateHeader}>
          <View style={[styles.dateLine, { backgroundColor: theme.colors.border }]} />
          <Text style={[styles.dateLabel, { color: theme.colors.textSecondary }]}>
            {format(parseISO(displayYmd), 'PPPP')}
          </Text>
          <View style={[styles.dateLine, { backgroundColor: theme.colors.border }]} />
        </View>
        {items.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeInDown.delay(100 + index * 50).duration(600)}
            style={[
              styles.postCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.postHeader}>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 6,
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <View style={[styles.classBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Text style={[styles.postClass, { color: theme.colors.primary, marginBottom: 0 }]}>
                      {item.class_name}-{item.section_name}
                    </Text>
                  </View>
                  <Text style={[styles.postSubject, { color: theme.colors.textSecondary }]}>
                    {item.subject_name}
                  </Text>
                </View>
                <Text style={[styles.postTitle, { color: theme.colors.textStrong }]}>{item.title}</Text>
                <Text style={[styles.postContent, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                  {item.content}
                </Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.postFooter}>
              <View style={styles.footerInfo}>
                <Text style={styles.dueText}>
                  Due: {item.homework_due_date ? format(parseISO(item.homework_due_date), 'MMM d') : 'N/A'}
                </Text>
                <Text style={[styles.createdText, { color: theme.colors.textSecondary }]}>
                  Posted: {format(parseISO(item.created_at), 'p')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onEdit(item)}>
                <View style={styles.editButton}>
                  <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.editText, { color: theme.colors.primary }]}>Edit</Text>
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 50
  },
  tabWrap: {
    marginBottom: Spacing.md,
  },
  selectionSection: {
    marginBottom: Spacing.xl
  },
  sectionTitle: {
    ...Typography.title,
    marginBottom: Spacing.md
  },
  assignmentsScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg
  },
  assignmentChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    borderWidth: 1,
    marginRight: Spacing.sm,
    ...Shadows.sm
  },
  assignmentText: {
    fontSize: 13
  },
  formCard: {
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    ...Shadows.md,
    borderWidth: 1,
    marginBottom: Spacing.xxl
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg
  },
  cardTitle: {
    ...Typography.title
  },
  existingBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill
  },
  existingBadgeText: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  inputGroup: {
    marginBottom: Spacing.md
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8
  },
  textArea: {
    height: 100
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 15,
    marginBottom: Spacing.lg
  },
  postButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: Radii.xl,
    ...Shadows.md,
    height: 56
  },
  postButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: 'bold'
  },
  sectionHeader: {
    marginBottom: Spacing.md
  },
  listContainer: {
    gap: Spacing.md
  },
  postCard: {
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm
  },
  postClass: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  postTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6
  },
  postContent: {
    fontSize: 14,
    lineHeight: 20
  },
  dateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    alignItems: 'center'
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700'
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dueText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600'
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: Radii.md
  },
  editText: {
    fontSize: 13,
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500'
  },
  dateGroup: {
    marginBottom: Spacing.xl
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
    gap: 10
  },
  dateLine: {
    flex: 1,
    height: 1
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  classBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm
  },
  postSubject: {
    fontSize: 14,
    fontWeight: '600'
  },
  footerInfo: {
    flex: 1,
    gap: 2
  },
  createdText: {
    fontSize: 11,
    fontWeight: '500'
  }
});