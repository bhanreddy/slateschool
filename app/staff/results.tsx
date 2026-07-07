import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import StaffHeader from '../../src/components/StaffHeader';
import ViewAsBanner from '../../src/components/ViewAsBanner';
import { useEffectiveStaffId } from '../../src/hooks/useEffectiveStaffId';
import { StudentService } from '../../src/services/studentService';
import { ResultService, TeacherService, TeacherClassAssignment } from '@/src/services/commonServices';
import { useAuth } from '@/src/hooks/useAuth';
import { StudentWithDetails } from '@/src/types/schema';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface ExamCategory {
  key: string;
  title: string;
  icon: any;
  color: string;
  description: string;
  examPrefix: string;
  subExams?: string[];
}

const EXTRA_SUB_EXAMS_KEY = 'staffExtraSubExams';

const EXAM_CATEGORIES: ExamCategory[] = [
  {
    key: 'slip_test',
    title: 'Slip Tests',
    icon: 'document-text',
    color: '#3B82F6',
    description: 'Weekly slip tests and unit tests',
    examPrefix: 'ST',
    subExams: ['ST-1', 'ST-2', 'ST-3', 'ST-4', 'ST-5']
  },
  {
    key: 'fa_results',
    title: 'Formative Assessment',
    icon: 'analytics',
    color: '#10B981',
    description: 'FA-1 to FA-4 Internal Exams',
    examPrefix: 'FA',
    subExams: ['FA-1', 'FA-2', 'FA-3', 'FA-4']
  },
  {
    key: 'sa_results',
    title: 'Summative Assessment',
    icon: 'school',
    color: '#F59E0B',
    description: 'Half-yearly and Annual Exams',
    examPrefix: 'SA',
    subExams: ['SA-1', 'SA-2']
  },
  {
    key: 'special',
    title: 'Special Exams',
    icon: 'star',
    color: '#8B5CF6',
    description: 'Talent tests and special evaluations',
    examPrefix: 'Special',
    subExams: ['Special-1', 'Special-2']
  },
  {
    key: 'weekend',
    title: 'Weekend Exams',
    icon: 'calendar',
    color: '#EC4899',
    description: 'Weekly practice (IIT/NEET)',
    examPrefix: 'W',
    subExams: ['W-1', 'W-2', 'W-3', 'W-4']
  }];

function parseExamIndex(name: string, prefix: string): number | null {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = name.match(new RegExp(`^${escaped}-(\\d+)$`));
  return match ? parseInt(match[1], 10) : null;
}

function formatExamName(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

function sortSubExams(exams: string[], prefix: string): string[] {
  return [...exams].sort((a, b) => {
    const indexA = parseExamIndex(a, prefix);
    const indexB = parseExamIndex(b, prefix);
    if (indexA != null && indexB != null) return indexA - indexB;
    return a.localeCompare(b);
  });
}

function mergeSubExams(
  category: ExamCategory,
  extra: string[],
  fromDb: string[]
): string[] {
  const base = category.subExams ?? [];
  const merged = new Set([...base, ...extra, ...fromDb]);
  return sortSubExams([...merged], category.examPrefix);
}

function getNextExamName(category: ExamCategory, currentExams: string[]): string {
  let maxIndex = 0;
  for (const name of currentExams) {
    const index = parseExamIndex(name, category.examPrefix);
    if (index != null && index > maxIndex) maxIndex = index;
  }
  return formatExamName(category.examPrefix, maxIndex + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: derive unique class-sections from flat assignment list
// ─────────────────────────────────────────────────────────────────────────────

interface ClassSectionGroup {
  class_section_id: string;
  class_id: string;
  section_id: string;
  label: string; // e.g. "10-A"
}

function getUniqueClassSections(
  assignments: TeacherClassAssignment[])
  : ClassSectionGroup[] {
  const seen = new Set<string>();
  const result: ClassSectionGroup[] = [];
  for (const a of assignments) {
    if (!seen.has(a.class_section_id)) {
      seen.add(a.class_section_id);
      result.push({
        class_section_id: a.class_section_id,
        class_id: a.class_id,
        section_id: a.section_id,
        label: `${a.class_name}-${a.section_name}`
      });
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function UploadMarks() {
  const { theme, isDark } = useTheme();
  const { isViewingAsAdmin, viewAsName } = useEffectiveStaffId();
  const styles = React.useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  // ── view state ──────────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<ExamCategory | null>(null);
  const [selectedSubExam, setSelectedSubExam] = useState('');
  const [maxMarks, setMaxMarks] = useState('100');
  const [extraSubExams, setExtraSubExams] = useState<Record<string, string[]>>({});
  const [dbSubExams, setDbSubExams] = useState<string[]>([]);

  // ── assignment / filter state ────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([]);

  /**
   * TWO-LEVEL FILTER
   * Level 1 – Class-Section (unique, derived from assignments)
   * Level 2 – Subject (filtered by selected class_section_id)
   * Together they resolve a single TeacherClassAssignment → selectedAssignment
   */
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Derived: unique class-sections
  const classSections = useMemo(
    () => getUniqueClassSections(assignments),
    [assignments]
  );

  // Derived: subjects available for the chosen class-section
  const availableSubjects = useMemo(
    () =>
      assignments.filter(
        (a) => a.class_section_id === selectedClassSectionId
      ),
    [assignments, selectedClassSectionId]
  );

  // Derived: resolved assignment (the single row we actually use for API calls)
  const selectedAssignment: TeacherClassAssignment | null = useMemo(
    () =>
      assignments.find(
        (a) =>
          a.class_section_id === selectedClassSectionId &&
          a.subject_id === selectedSubjectId
      ) ?? null,
    [assignments, selectedClassSectionId, selectedSubjectId]
  );

  // ── data state ───────────────────────────────────────────────────────────────
  const [marks, setMarks] = useState<{ [key: string]: string; }>({});
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();

  const activeSubExams = useMemo(() => {
    if (!selectedCategory) return [];
    return mergeSubExams(
      selectedCategory,
      extraSubExams[selectedCategory.key] ?? [],
      dbSubExams
    );
  }, [selectedCategory, extraSubExams, dbSubExams]);

  const getDisplaySubExams = useCallback(
    (cat: ExamCategory) => mergeSubExams(cat, extraSubExams[cat.key] ?? [], []),
    [extraSubExams]
  );

  // ── effects ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(EXTRA_SUB_EXAMS_KEY).then((raw) => {
      if (!raw) return;
      try {
        setExtraSubExams(JSON.parse(raw));
      } catch {
        // ignore corrupt storage
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedCategory) {
      setDbSubExams([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const exams = await ResultService.getExams();
        if (cancelled) return;
        const names = exams
          .filter((exam) => exam.exam_type === selectedCategory.key)
          .map((exam) => exam.name);
        setDbSubExams(names);
      } catch {
        if (!cancelled) setDbSubExams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory?.key]);

  useEffect(() => {
    if (!selectedCategory || activeSubExams.length === 0) return;
    if (!activeSubExams.includes(selectedSubExam)) {
      setSelectedSubExam(activeSubExams[0]);
    }
  }, [activeSubExams, selectedCategory, selectedSubExam]);

  // 1. Load assignments on mount
  useEffect(() => {
    fetchAssignments();
  }, []);

  // 2. Auto-select first class-section when assignments load
  useEffect(() => {
    if (classSections.length > 0 && !selectedClassSectionId) {
      setSelectedClassSectionId(classSections[0].class_section_id);
    }
  }, [classSections]);

  // 3. Auto-select first subject when class-section changes
  useEffect(() => {
    if (availableSubjects.length > 0) {
      setSelectedSubjectId(availableSubjects[0].subject_id);
    } else {
      setSelectedSubjectId(null);
    }
  }, [selectedClassSectionId, availableSubjects]);

  // 4. Fetch students when resolved assignment changes
  useEffect(() => {
    if (selectedCategory && selectedAssignment) {
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [selectedCategory, selectedAssignment]);

  // 5. Fetch existing marks when sub-exam or assignment changes
  useEffect(() => {
    if (selectedCategory && selectedAssignment && selectedSubExam) {
      fetchExistingMarks();
    }
  }, [selectedCategory, selectedAssignment, selectedSubExam]);

  // ── data fetchers ─────────────────────────────────────────────────────────────

  const fetchAssignments = async () => {
    try {
      const data = await TeacherService.getMyClasses();
      setAssignments(data);
    } catch (error) {

      alertCompat('Error', 'Could not load your assigned classes.');
    }
  };

  const fetchExistingMarks = async () => {
    if (!selectedAssignment || !selectedCategory || !selectedSubExam) return;
    try {
      setLoading(true);
      const data = await ResultService.getMarks({
        class_section_id: selectedAssignment.class_section_id,
        exam_category: selectedCategory.key,
        sub_exam: selectedSubExam,
        subject_id: selectedAssignment.subject_id
      });
      setMaxMarks(data.max_marks ? data.max_marks.toString() : '100');
      const newMarks: { [key: string]: string; } = {};
      if (data.marks?.length > 0) {
        data.marks.forEach((m: any) => {
          newMarks[m.student_id] = m.marks_obtained.toString();
        });
      }
      setMarks(newMarks);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!selectedAssignment) return;
    try {
      setLoading(true);
      const response = await StudentService.getAll<StudentWithDetails>({
        class_id: selectedAssignment.class_id,
        section_id: selectedAssignment.section_id,
        limit: 100
      });
      setStudents(response.data);
    } catch (error) {

      alertCompat('Error', 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  // ── handlers ──────────────────────────────────────────────────────────────────

  const handleBackToDashboard = () => {
    setSelectedCategory(null);
    setMarks({});
  };

  const handleMaxMarksChange = (text: string) => {
    if (/^\d*$/.test(text)) setMaxMarks(text);
  };

  const handleMarkChange = (studentId: string, text: string) => {
    if (/^\d*$/.test(text) && (text === '' || Number(text) <= Number(maxMarks))) {
      setMarks((prev) => ({ ...prev, [studentId]: text }));
    }
  };

  const handleAddSubExam = async () => {
    if (!selectedCategory) return;
    const nextExam = getNextExamName(selectedCategory, activeSubExams);
    const categoryKey = selectedCategory.key;
    const updatedExtras = {
      ...extraSubExams,
      [categoryKey]: [...(extraSubExams[categoryKey] ?? []), nextExam]
    };
    setExtraSubExams(updatedExtras);
    setSelectedSubExam(nextExam);
    setMarks({});
    try {
      await AsyncStorage.setItem(EXTRA_SUB_EXAMS_KEY, JSON.stringify(updatedExtras));
    } catch {
      // non-blocking if storage fails
    }
  };

  const handleSubmit = async () => {
    if (isViewingAsAdmin) {
      alertCompat('Read-only', 'Marks can\'t be uploaded while viewing another staff member\'s portal.');
      return;
    }
    if (!selectedCategory || !selectedAssignment) return;
    const filledMarks = Object.keys(marks).map((studentId) => ({
      student_id: studentId,
      marks: Number(marks[studentId])
    }));
    if (filledMarks.length === 0) {
      alertCompat('Warning', 'No marks entered.');
      return;
    }
    alertCompat(
      'Confirm Upload',
      `Upload ${selectedCategory.title} – ${selectedSubExam} marks for ${selectedAssignment.class_name}-${selectedAssignment.section_name} (${selectedAssignment.subject_name})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: async () => {
            try {
              setLoading(true);
              await ResultService.upload({
                class_section_id: selectedAssignment.class_section_id,
                exam_category: selectedCategory.key,
                sub_exam: selectedSubExam,
                subject_id: selectedAssignment.subject_id,
                max_marks: Number(maxMarks),
                results: filledMarks
              });
              alertCompat('Success', 'Marks uploaded successfully!');
              setSelectedCategory(null);
              setMarks({});
            } catch (e) {

              alertCompat('Error', 'Failed to upload marks');
            } finally {
              setLoading(false);
            }
          }
        }]

    );
  };

  // ── renders ───────────────────────────────────────────────────────────────────

  const renderDashboard = () =>
    <ScrollView contentContainerStyle={styles.dashboardContent}>
      <View style={styles.headerSection}>
        <Text style={styles.pageTitle}>Marks Entry</Text>
        <Text style={styles.pageSubtitle}>Select an exam category to begin</Text>
      </View>
      <View style={styles.gridContainer}>
        {EXAM_CATEGORIES.map((cat, index) =>
          <Animated.View
            key={cat.key}
            entering={FadeInDown.delay(index * 80).duration(500)}
            style={styles.cardContainer}>

            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => {
                setSelectedCategory(cat);
                const exams = getDisplaySubExams(cat);
                if (exams.length) setSelectedSubExam(exams[0]);
              }}>

              <View style={[styles.iconBox, { backgroundColor: cat.color + '18' }]}>
                <Ionicons name={cat.icon} size={22} color={cat.color} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>{cat.title}</Text>
                <Text style={styles.cardSubtitle}>{cat.description}</Text>
                {cat.subExams &&
                  <View style={styles.badgeRow}>
                    {getDisplaySubExams(cat).slice(0, 4).map((sub) =>
                      <View key={sub} style={[styles.badge, { borderColor: cat.color + '60' }]}>
                        <Text style={[styles.badgeText, { color: cat.color }]}>{sub}</Text>
                      </View>
                    )}
                    {getDisplaySubExams(cat).length > 4 &&
                      <Text style={[styles.badgeMore, { color: cat.color }]}>
                        +{getDisplaySubExams(cat).length - 4}
                      </Text>
                    }
                  </View>
                }
              </View>
              <View style={[styles.arrowBox, { backgroundColor: cat.color }]}>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </ScrollView>;

  const renderFilterSection = () => {
    if (assignments.length === 0) {
      return (
        <View style={styles.emptyFilterBanner}>
          <Ionicons name="warning-outline" size={16} color="#DC2626" />
          <Text style={styles.emptyFilterText}>No classes are assigned to you in the timetable.</Text>
        </View>);

    }

    return (
      <View style={styles.filterSection}>
        {/* ── Level 1: Class-Section ───────────────────────────────────── */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>
            <Ionicons name="business-outline" size={11} /> CLASS
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>

            {classSections.map((cs) => {
              const active = selectedClassSectionId === cs.class_section_id;
              return (
                <TouchableOpacity
                  key={cs.class_section_id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedClassSectionId(cs.class_section_id)}
                  activeOpacity={0.7}>

                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {cs.label}
                  </Text>
                </TouchableOpacity>);

            })}
          </ScrollView>
        </View>

        {/* ── Level 2: Subject (filtered by class-section) ─────────────── */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>
            <Ionicons name="book-outline" size={11} /> SUBJECT
          </Text>
          {availableSubjects.length === 0 ?
            <Text style={styles.noSubjectText}>No subjects for this class.</Text> :

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>

              {availableSubjects.map((a) => {
                const active = selectedSubjectId === a.subject_id;
                return (
                  <TouchableOpacity
                    key={a.subject_id}
                    style={[styles.chip, styles.chipSubject, active && styles.chipSubjectActive]}
                    onPress={() => setSelectedSubjectId(a.subject_id)}
                    activeOpacity={0.7}>

                    <Text style={[styles.chipText, active && styles.chipSubjectTextActive]}>
                      {a.subject_name}
                    </Text>
                  </TouchableOpacity>);

              })}
            </ScrollView>
          }
        </View>

        {/* ── Level 3: Sub-Exam Tabs ────────────────────────────────────── */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>
            <Ionicons name="layers-outline" size={11} /> EXAM
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>

            {activeSubExams.map((exam) => {
              const active = selectedSubExam === exam;
              return (
                <TouchableOpacity
                  key={exam}
                  style={[styles.examTab, active && styles.examTabActive]}
                  onPress={() => setSelectedSubExam(exam)}
                  activeOpacity={0.7}>

                  <Text style={[styles.examTabText, active && styles.examTabTextActive]}>
                    {exam}
                  </Text>
                </TouchableOpacity>);

            })}
            <TouchableOpacity
              style={styles.examTabAdd}
              onPress={handleAddSubExam}
              activeOpacity={0.7}
              accessibilityLabel="Add exam">

              <Ionicons name="add" size={18} color="#8B5CF6" />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>);

  };

  const renderUploadForm = () =>
    <>
      {renderFilterSection()}

      {/* ── Max Marks Input ─────────────────────────────────────────────── */}
      <View style={styles.maxMarksRow}>
        <View style={styles.maxMarksLeft}>
          <Ionicons name="trophy-outline" size={14} color="#6B7280" style={{ marginRight: 6 }} />
          <Text style={styles.maxMarksLabel}>Total Marks</Text>
        </View>
        <AppTextInput
          style={styles.maxMarksInput}
          value={maxMarks}
          onChangeText={handleMaxMarksChange}
          keyboardType="numeric"
          maxLength={3} />

      </View>

      {/* ── Context Banner ──────────────────────────────────────────────── */}
      {selectedAssignment &&
        <Animated.View entering={FadeInRight.duration(300)} style={styles.contextBanner}>
          <Ionicons name="information-circle-outline" size={14} color="#6366F1" />
          <Text style={styles.contextText} numberOfLines={1}>
            {selectedAssignment.class_name}-{selectedAssignment.section_name}
            {'  ·  '}{selectedAssignment.subject_name}
            {'  ·  '}{selectedSubExam}
          </Text>
        </Animated.View>
      }

      {/* ── Student List ────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>

        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, { flex: 2 }]}>Student</Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>
            Marks / {maxMarks}
          </Text>
        </View>

        {loading ?
          <View style={styles.loadingContainer}>
            <LogoLoader size={60} color="#8B5CF6" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View> :
          students.length > 0 ?
            students.map((student, index) =>
              <Animated.View
                key={student.id}
                entering={FadeInDown.delay(index * 40).duration(350)}
                style={styles.studentRow}>

                <View style={styles.studentAvatar}>
                  <Text style={styles.studentAvatarText}>
                    {(student.person.first_name?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 2, marginLeft: 10 }}>
                  <Text style={styles.studentName}>
                    {student.person.display_name ??
                      `${student.person.first_name} ${student.person.last_name}`}
                  </Text>
                  <Text style={styles.studentRoll}>#{student.admission_no}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <AppTextInput
                    style={[
                      styles.markInput,
                      marks[student.id] ? styles.markInputFilled : null]
                    }
                    placeholder="—"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    maxLength={3}
                    value={marks[student.id] || ''}
                    onChangeText={(text) => handleMarkChange(student.id, text)} />

                </View>
              </Animated.View>
            ) :

            <View style={styles.emptyStudents}>
              <Ionicons name="people-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyStudentsText}>No students found</Text>
              <Text style={styles.emptyStudentsSubtext}>
                {selectedAssignment ?
                  `No students in ${selectedAssignment.class_name}-${selectedAssignment.section_name}` :
                  'Select a class and subject above'}
              </Text>
            </View>
        }
      </ScrollView>

      {/* ── Submit Button ────────────────────────────────────────────────── */}
      <View style={styles.floatingAction}>
        <View style={styles.submitCountBadge}>
          <Text style={styles.submitCountText}>
            {Object.values(marks).filter(Boolean).length} / {students.length} filled
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.submitButton, (loading || !selectedAssignment) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !selectedAssignment}
          activeOpacity={0.85}>

          {loading ?
            <LogoLoader size={30} color="#fff" /> :

            <>
              <Text style={styles.submitText}>Upload Results</Text>
              <Ionicons name="cloud-upload" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </>
          }
        </TouchableOpacity>
      </View>
    </>;

  // ── Main Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <StaffHeader
        title={selectedCategory?.title ?? 'Upload Marks'}
        showBackButton={true} />
      {isViewingAsAdmin && <ViewAsBanner name={viewAsName} limited />}

      {selectedCategory &&
        <TouchableOpacity style={styles.backToDash} onPress={handleBackToDashboard}>
          <Ionicons name="arrow-back" size={15} color="#6B7280" />
          <Text style={styles.backText}>All Exams</Text>
        </TouchableOpacity>
      }

      {selectedCategory ? renderUploadForm() : renderDashboard()}
    </View>);

}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent'
    },

    // ── Dashboard ────────────────────────────────────────────────────────────
    dashboardContent: {
      padding: 20,
      paddingBottom: 40
    },
    headerSection: {
      marginBottom: 22
    },
    pageTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.3
    },
    pageSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 4
    },
    gridContainer: {
      gap: 12
    },
    cardContainer: {
      width: '100%'
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.04,
      shadowRadius: 8,
      elevation: 2
    },
    iconBox: {
      width: 46,
      height: 46,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 13
    },
    textContainer: {
      flex: 1
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 2
    },
    cardSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 6
    },
    badge: {
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 1
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '600'
    },
    badgeMore: {
      fontSize: 10,
      fontWeight: '600',
      alignSelf: 'center'
    },
    arrowBox: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8
    },

    // ── Back nav ─────────────────────────────────────────────────────────────
    backToDash: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 9,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.card
    },
    backText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      marginLeft: 5
    },

    // ── Filter Section ───────────────────────────────────────────────────────
    filterSection: {
      backgroundColor: theme.colors.background,
      paddingTop: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.card,
      gap: 10
    },
    filterGroup: {
      paddingHorizontal: 16
    },
    filterLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: theme.colors.textTertiary,
      marginBottom: 6,
      textTransform: 'uppercase'
    },
    chipRow: {
      flexDirection: 'row',
      gap: 8,
      paddingRight: 16
    },
    chip: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'
    },
    chipActive: {
      backgroundColor: '#EEF2FF',
      borderColor: '#8B5CF6'
    },
    chipSubject: {
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'
    },
    chipSubjectActive: {
      backgroundColor: '#F0FDF4',
      borderColor: '#10B981'
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary
    },
    chipTextActive: {
      color: '#8B5CF6'
    },
    chipSubjectTextActive: {
      color: '#10B981'
    },
    examTab: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'
    },
    examTabActive: {
      backgroundColor: '#FFF7ED',
      borderColor: '#F59E0B'
    },
    examTabText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary
    },
    examTabTextActive: {
      color: '#F59E0B'
    },
    examTabAdd: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.card,
      borderWidth: 1.5,
      borderColor: '#8B5CF6',
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center'
    },
    emptyFilterBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      margin: 16,
      padding: 12,
      backgroundColor: '#FEF2F2',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#FECACA'
    },
    emptyFilterText: {
      color: '#DC2626',
      fontSize: 13,
      fontWeight: '500',
      flex: 1
    },
    noSubjectText: {
      color: theme.colors.textTertiary,
      fontSize: 12,
      fontStyle: 'italic'
    },

    // ── Max Marks ────────────────────────────────────────────────────────────
    maxMarksRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 18,
      paddingRight: 24,
      paddingVertical: 14,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6'
    },
    maxMarksLeft: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    maxMarksLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary
    },
    maxMarksInput: {
      borderWidth: 1.5,
      borderColor: '#8B5CF6',
      borderRadius: 8,
      width: 72,
      height: 44,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '700',
      color: '#8B5CF6',
      backgroundColor: '#F5F3FF',
      marginRight: 2
    },

    // ── Context Banner ───────────────────────────────────────────────────────
    contextBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 18,
      marginTop: 10,
      marginBottom: 2,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: '#EEF2FF',
      borderRadius: 8
    },
    contextText: {
      fontSize: 12,
      color: '#6366F1',
      fontWeight: '600',
      flex: 1
    },

    // ── Student List ─────────────────────────────────────────────────────────
    listContent: {
      padding: 18,
      paddingBottom: 180
    },
    tableHeader: {
      flexDirection: 'row',
      marginBottom: 10,
      paddingHorizontal: 6
    },
    headerCell: {
      fontSize: 11,
      color: theme.colors.textTertiary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5
    },
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 40,
      gap: 10
    },
    loadingText: {
      color: theme.colors.textSecondary,
      fontSize: 13
    },
    studentRow: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 11,
      paddingHorizontal: 13,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.03,
      shadowRadius: 3,
      elevation: 1
    },
    studentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#EEF2FF',
      justifyContent: 'center',
      alignItems: 'center'
    },
    studentAvatarText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#8B5CF6'
    },
    studentName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text
    },
    studentRoll: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 1
    },
    markInput: {
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
      borderRadius: 8,
      width: 56,
      height: 38,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      backgroundColor: theme.colors.card
    },
    markInputFilled: {
      borderColor: '#8B5CF6',
      backgroundColor: '#F5F3FF',
      color: '#8B5CF6'
    },
    emptyStudents: {
      alignItems: 'center',
      paddingVertical: 50,
      gap: 8
    },
    emptyStudentsText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textSecondary
    },
    emptyStudentsSubtext: {
      fontSize: 13,
      color: theme.colors.textTertiary,
      textAlign: 'center'
    },

    // ── Submit ───────────────────────────────────────────────────────────────
    floatingAction: {
      position: 'absolute',
      bottom: 90,
      left: 18,
      right: 18,
      gap: 8
    },
    submitCountBadge: {
      alignSelf: 'center',
      backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'
    },
    submitCountText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary
    },
    submitButton: {
      backgroundColor: '#8B5CF6',
      paddingVertical: 15,
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#8B5CF6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6
    },
    submitButtonDisabled: {
      backgroundColor: '#C4B5FD',
      shadowOpacity: 0,
      elevation: 0
    },
    submitText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2
    }
  });