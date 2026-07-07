import React, { useState, useEffect, useCallback } from 'react';
import AppTextInput from '@/src/components/AppTextInput';

import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ComplaintService, Complaint } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
import { StudentService } from '../../src/services/studentService';
import { ClassService, ClassSection } from '../../src/services/classService';
import { Student } from '../../src/types/models';
import { StudentWithDetails } from '../../src/types/schema';
import { useTranslation } from 'react-i18next';
import { t_field } from '../../src/utils/lang';

interface PickStudent {
  id: string;
  display_name: string;
  admission_no: string;
}

const EMPTY_COMPLAINT = {
  title: '',
  description: '',
  category: 'Facility',
  priority: 'medium',
  raised_for_student_id: ''
};
export default function AdminComplaints() {
  useTranslation(); // Subscribe so list rows re-render when language changes (t_field).
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'OPEN' | 'IN PROGRESS' | 'CLOSED'>('ALL');

  const [modalVisible, setModalVisible] = useState(false);
  const [newComplaint, setNewComplaint] = useState({ ...EMPTY_COMPLAINT });
  const [studentMode, setStudentMode] = useState<'single' | 'multiple'>('single');
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<PickStudent[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  useEffect(() => {
    fetchComplaints();
  }, []);

  useEffect(() => {
    if (!modalVisible) return;
    loadAllClasses();
  }, [modalVisible]);

  useEffect(() => {
    if (!modalVisible || studentMode !== 'multiple' || !selectedClassSectionId) return;
    loadClassStudents(selectedClassSectionId);
  }, [modalVisible, studentMode, selectedClassSectionId, classSections]);

  const resetStudentPicker = useCallback(() => {
    setStudentMode('single');
    setStudentSearch('');
    setSearchResults([]);
    setClassSections([]);
    setSelectedClassSectionId(null);
    setClassStudents([]);
    setSelectedStudentIds([]);
    setNewComplaint((prev) => ({ ...prev, raised_for_student_id: '' }));
  }, []);

  const closeModal = () => {
    setModalVisible(false);
    setNewComplaint({ ...EMPTY_COMPLAINT });
    resetStudentPicker();
  };

  const loadAllClasses = async () => {
    setLoadingClasses(true);
    let loadedSections: ClassSection[] = [];
    try {
      const year = await ClassService.getCurrentAcademicYear();
      const sections = await ClassService.getClassSections(year?.id);
      loadedSections = [...sections].sort((a, b) =>
        `${a.class_name}-${a.section_name}`.localeCompare(`${b.class_name}-${b.section_name}`)
      );
      setClassSections(loadedSections);
      setSelectedClassSectionId((prev) =>
        prev && loadedSections.some((section) => section.id === prev)
          ? prev
          : loadedSections[0]?.id ?? null
      );
    } catch {
      loadedSections = [];
      setClassSections([]);
      setSelectedClassSectionId(null);
    } finally {
      if (loadedSections.length === 0) {
        setLoadingClasses(false);
      }
    }
  };

  const loadClassStudents = async (classSectionId: string) => {
    const section = classSections.find((item) => item.id === classSectionId);
    if (!section) return;
    setLoadingStudents(true);
    setSelectedStudentIds([]);
    try {
      const response = await StudentService.getAll<StudentWithDetails>({
        class_id: section.class_id,
        section_id: section.section_id,
        limit: 200,
      });
      setClassStudents(response.data.map((student) => ({
        id: student.id,
        display_name: student.person.display_name || `${student.person.first_name} ${student.person.last_name}`,
        admission_no: student.admission_no,
      })));
    } catch {
      setClassStudents([]);
    } finally {
      setLoadingStudents(false);
      setLoadingClasses(false);
    }
  };

  const switchStudentMode = (mode: 'single' | 'multiple') => {
    setStudentMode(mode);
    setStudentSearch('');
    setSearchResults([]);
    setSelectedStudentIds([]);
    setClassStudents([]);
    setNewComplaint((prev) => ({ ...prev, raised_for_student_id: '' }));
    if (mode === 'multiple' && classSections.length > 0 && !selectedClassSectionId) {
      setSelectedClassSectionId(classSections[0].id);
    }
  };

  const toggleStudentSelection = (student: PickStudent) => {
    setSelectedStudentIds((prev) =>
      prev.includes(student.id) ? prev.filter((id) => id !== student.id) : [...prev, student.id]
    );
  };

  const selectAllClassStudents = () => {
    setSelectedStudentIds(classStudents.map((student) => student.id));
  };

  const clearClassSelection = () => {
    setSelectedStudentIds([]);
  };
  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const data = await ComplaintService.getAll();
      setComplaints(data);
    } catch (error) {

      alertCompat('Error', 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateComplaint = async () => {
    if (!newComplaint.title || !newComplaint.description) {
      alertCompat('Error', 'Please fill in required fields');
      return;
    }
    if (studentMode === 'single' && !newComplaint.raised_for_student_id) {
      alertCompat('Missing Student', 'Please select a student or use multiple mode.');
      return;
    }
    if (studentMode === 'multiple' && selectedStudentIds.length === 0) {
      alertCompat('Missing Students', 'Please select at least one student from the class.');
      return;
    }
    try {
      setIsSubmitting(true);
      if (studentMode === 'multiple') {
        const result = await ComplaintService.createBulk({
          title: newComplaint.title,
          description: newComplaint.description,
          category: newComplaint.category.toLowerCase(),
          priority: newComplaint.priority.toLowerCase(),
          raised_for_student_ids: selectedStudentIds,
        });
        alertCompat('Success', `Complaint filed for ${result.count} student(s).`);
      } else {
        await ComplaintService.create({
          title: newComplaint.title,
          description: newComplaint.description,
          category: newComplaint.category.toLowerCase(),
          priority: newComplaint.priority.toLowerCase(),
          raised_for_student_id: newComplaint.raised_for_student_id,
        });
        alertCompat('Success', 'Complaint created successfully');
      }
      closeModal();
      fetchComplaints();
    } catch (error) {
      alertCompat('Error', 'Failed to create complaint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentSearch = async (text: string) => {
    setStudentSearch(text);
    if (text.length > 2) {
      setIsSearching(true);
      try {
        const results = await StudentService.search(text);
        setSearchResults(results);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setNewComplaint((prev) => ({ ...prev, raised_for_student_id: '' }));
    }
  };
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved':
        return {
          bg: '#D1FAE5',
          text: '#065F46'
        };
      case 'escalated':
        return {
          bg: '#FEE2E2',
          text: '#991B1B'
        };
      case 'closed':
        return {
          bg: '#F3F4F6',
          text: '#374151'
        };
      default:
        return {
          bg: '#FEF3C7',
          text: '#92400E'
        };
      // Pending/Open
    }
  };
  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'disciplinary':
        return '#EF4444';
      case 'facility':
        return '#3B82F6';
      case 'academic':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  const filteredData = complaints.filter((item) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'IN PROGRESS') return item.status?.toLowerCase() === 'in progress';
    return (item.status || 'open').toUpperCase() === filterType;
  });
  const handleResolve = async (id: string) => {
    try {
      setLoading(true);
      await ComplaintService.update(id, { status: 'resolved' });
      alertCompat('Success', 'Complaint resolved successfully');
      fetchComplaints();
    } catch (error) {

      alertCompat('Error', 'Failed to resolve complaint');
      setLoading(false);
    }
  };

  const handleAssign = () => {
    // Placeholder for Assignment Modal/Logic
    alertCompat('Assign', 'Assignment functionality coming soon.');
  };

  const renderItem = ({
    item,
    index

  }: { item: Complaint; index: number; }) => {
    const category = item.category || 'General';
    const statusStyle = getStatusStyle(item.status);
    const color = getCategoryColor(category);
    return <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
      <View style={styles.card}>
        <View style={[styles.accentBar, {
          backgroundColor: color
        }]} />

        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Ionicons name={category.toLowerCase() === 'disciplinary' ? 'person-circle-outline' : 'business-outline'} size={14} color="#6B7280" />
            <Text style={styles.category}>{category.toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: statusStyle.bg
          }]}>
            <Text style={[styles.statusText, {
              color: statusStyle.text
            }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <View style={[styles.iconBox, {
            backgroundColor: `${color}15`
          }]}>
            <Ionicons name="alert-circle" size={20} color={color} />
          </View>
          <View style={{
            flex: 1
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.title}>{t_field(item.title, item.title_te)}</Text>
              {item.priority?.toLowerCase() === 'high' &&
                <View style={[styles.priorityBadge, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: 'bold' }}>HIGH</Text>
                </View>
              }
            </View>
            <Text style={styles.targetText}>Ticket: <Text style={{
              fontWeight: '700'
            }}>#{item.id?.substring(0, 6) || item.ticket_no}</Text></Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.metaInfo}>
            <Ionicons name="person-outline" size={12} color="#6B7280" />
            <Text style={styles.fromText}>Filed by: {item.raised_by_name || item.raised_by || 'Anonymous'}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: '#10B981' }]} onPress={() => handleResolve(item.id)}>
            <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Resolve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: '#3B82F6', marginLeft: 8 }]} onPress={() => handleAssign()}>
            <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Assign</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>;
  };
  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
    <AdminHeader title="Complaints Box" showBackButton={true} />

    <View style={styles.filterSection}>
      <View style={styles.tabContainer}>
        {['ALL', 'OPEN', 'IN PROGRESS', 'CLOSED'].map((type) => {
          return <TouchableOpacity key={type} style={[styles.tab, filterType === type && styles.activeTab]} onPress={() => setFilterType(type as any)}>
            <Text style={[styles.tabText, filterType === type && styles.activeTabText]}>
              {type}
            </Text>
          </TouchableOpacity>;
        })}
      </View>
    </View>

    {loading ? <View style={styles.centerContainer}>
      <LogoLoader size={60} color="#6366F1" />
    </View> : <FlatList data={filteredData} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} ListHeaderComponent={() => {
      return <Text style={styles.listHeader}>Recent Reports ({filteredData.length})</Text>;
    }} ListEmptyComponent={<Text style={styles.emptyText}>No complaints found</Text>} refreshing={loading} onRefresh={fetchComplaints} />}

    <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
      <Ionicons name="add" size={24} color="#fff" />
    </TouchableOpacity>

    <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={closeModal}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Complaint</Text>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Title *</Text>
            <AppTextInput style={styles.input} placeholder="Brief summary" placeholderTextColor="#9CA3AF" value={newComplaint.title} onChangeText={(text) => setNewComplaint((prev) => ({ ...prev, title: text }))} />

            <Text style={styles.inputLabel}>Description *</Text>
            <AppTextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} placeholder="Detailed description" placeholderTextColor="#9CA3AF" multiline value={newComplaint.description} onChangeText={(text) => setNewComplaint((prev) => ({ ...prev, description: text }))} />

            <Text style={styles.inputLabel}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
              {['Facility', 'Disciplinary', 'Academic', 'General'].map(cat => (
                <TouchableOpacity key={cat} style={[styles.pill, newComplaint.category === cat && styles.activePill]} onPress={() => setNewComplaint((prev) => ({ ...prev, category: cat }))}>
                  <Text style={[styles.pillText, newComplaint.category === cat && styles.activePillText]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Priority</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
              {['low', 'medium', 'high'].map(prio => (
                <TouchableOpacity key={prio} style={[styles.pill, newComplaint.priority === prio && styles.activePill]} onPress={() => setNewComplaint((prev) => ({ ...prev, priority: prio }))}>
                  <Text style={[styles.pillText, newComplaint.priority === prio && styles.activePillText]}>{prio.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Students *</Text>
            <View style={styles.modeRow}>
              {([
                { key: 'single' as const, label: 'One Student', icon: 'person-outline' },
                { key: 'multiple' as const, label: 'Multiple from Class', icon: 'people-outline' },
              ]).map((mode) => {
                const active = studentMode === mode.key;
                return (
                  <TouchableOpacity
                    key={mode.key}
                    style={[styles.modeChip, active && styles.modeChipActive]}
                    onPress={() => switchStudentMode(mode.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={mode.icon as any} size={14} color={active ? '#6366F1' : '#94A3B8'} />
                    <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{mode.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {studentMode === 'single' ? (
              <View>
                {newComplaint.raised_for_student_id ? (
                  <View style={styles.selectedStudentChip}>
                    <View style={styles.selectedStudentAvatar}>
                      <Ionicons name="person" size={14} color="#6366F1" />
                    </View>
                    <Text style={styles.selectedStudentName} numberOfLines={1}>{studentSearch}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setNewComplaint((prev) => ({ ...prev, raised_for_student_id: '' }));
                        setStudentSearch('');
                      }}
                      style={styles.clearStudentBtn}
                    >
                      <Ionicons name="close" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <AppTextInput
                      style={styles.input}
                      placeholder="Search student name or admission no..."
                      placeholderTextColor="#9CA3AF"
                      value={studentSearch}
                      onChangeText={handleStudentSearch}
                    />
                    {isSearching && <ActivityIndicator size="small" color="#6366F1" style={{ marginTop: 8 }} />}
                    {searchResults.length > 0 && (
                      <View style={styles.searchResults}>
                        {searchResults.map((student) => (
                          <TouchableOpacity
                            key={student.id}
                            style={styles.searchItem}
                            onPress={() => {
                              setNewComplaint((prev) => ({ ...prev, raised_for_student_id: student.id }));
                              setStudentSearch(`${[student.first_name, student.last_name].filter(Boolean).join(' ')} (${student.admission_no})`);
                              setSearchResults([]);
                            }}
                          >
                            <Text style={styles.searchItemText}>{student.first_name} {student.last_name}</Text>
                            <Text style={styles.searchItemSub}>{student.admission_no}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : (
              <View>
                {loadingClasses ? (
                  <View style={styles.classLoading}>
                    <LogoLoader size={36} color="#6366F1" />
                    <Text style={styles.classLoadingText}>Loading classes…</Text>
                  </View>
                ) : classSections.length === 0 ? (
                  <Text style={styles.classEmptyText}>No classes found for the current academic year.</Text>
                ) : (
                  <>
                    <Text style={styles.classSectionLabel}>Class</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChipRow}>
                      {classSections.map((section) => {
                        const active = selectedClassSectionId === section.id;
                        return (
                          <TouchableOpacity
                            key={section.id}
                            style={[styles.classChip, active && styles.classChipActive]}
                            onPress={() => setSelectedClassSectionId(section.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.classChipText, active && styles.classChipTextActive]}>
                              {section.class_name} {section.section_name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <View style={styles.classHeaderRow}>
                      <Text style={styles.classMetaText}>
                        {classStudents.length} student{classStudents.length === 1 ? '' : 's'}
                      </Text>
                      <View style={styles.classActions}>
                        <TouchableOpacity onPress={selectAllClassStudents}>
                          <Text style={styles.classActionText}>Select all</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={clearClassSelection}>
                          <Text style={styles.classActionMuted}>Clear</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {loadingStudents ? (
                      <View style={styles.classLoading}>
                        <LogoLoader size={36} color="#6366F1" />
                        <Text style={styles.classLoadingText}>Loading students…</Text>
                      </View>
                    ) : classStudents.length === 0 ? (
                      <Text style={styles.classEmptyText}>No students found in this class.</Text>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        nestedScrollEnabled
                        contentContainerStyle={styles.studentCardRow}
                        style={styles.studentCardScroll}
                      >
                        {classStudents.map((student) => {
                          const checked = selectedStudentIds.includes(student.id);
                          const initial = (student.display_name?.[0] ?? '?').toUpperCase();
                          return (
                            <TouchableOpacity
                              key={student.id}
                              style={[styles.studentCard, checked && styles.studentCardSelected]}
                              onPress={() => toggleStudentSelection(student)}
                              activeOpacity={0.82}
                            >
                              {checked ? (
                                <View style={styles.studentCardBadge}>
                                  <Ionicons name="checkmark" size={11} color="#fff" />
                                </View>
                              ) : null}
                              <View style={[styles.studentCardAvatar, checked && styles.studentCardAvatarSelected]}>
                                <Text style={[styles.studentCardInitial, checked && styles.studentCardInitialSelected]}>
                                  {initial}
                                </Text>
                              </View>
                              <Text style={styles.studentCardName} numberOfLines={2}>{student.display_name}</Text>
                              <Text style={styles.studentCardAdm}>#{student.admission_no}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}

                    {selectedStudentIds.length > 0 && (
                      <Text style={styles.selectedCount}>
                        {selectedStudentIds.length} student{selectedStudentIds.length === 1 ? '' : 's'} selected
                      </Text>
                    )}
                  </>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateComplaint} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {studentMode === 'multiple' && selectedStudentIds.length > 1
                    ? `Submit to ${selectedStudentIds.length} Students`
                    : 'Submit Complaint'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterSection: {
    paddingVertical: 15,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 20
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 4
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12
  },
  activeTab: {
    backgroundColor: theme.colors.background,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  activeTabText: {
    color: '#111827',
    fontWeight: '700'
  },
  listContent: {
    padding: 20
  },
  listHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 15,
    letterSpacing: -0.5
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    overflow: 'hidden'
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingLeft: 10
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  category: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  titleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    paddingLeft: 10
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  targetText: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.card,
    paddingLeft: 10
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  fromText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    fontWeight: '500'
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: theme.colors.textTertiary,
    fontSize: 16
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'flex-end'
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary || '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary || '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
    marginTop: 12
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  activePill: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1'
  },
  pillText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  activePillText: {
    color: '#6366F1',
    fontWeight: '700'
  },
  searchResults: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 150
  },
  searchItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  searchItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text
  },
  searchItemSub: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  submitBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  modeChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  modeChipTextActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  selectedStudentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
  },
  selectedStudentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedStudentName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  clearStudentBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  classSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  classChipRow: { gap: 8, paddingRight: 8, paddingBottom: 4 },
  classChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  classChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  classChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  classChipTextActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  classHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 8,
  },
  classMetaText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  classActions: { flexDirection: 'row', gap: 12 },
  classActionText: { fontSize: 12, fontWeight: '700', color: '#6366F1' },
  classActionMuted: { fontSize: 12, fontWeight: '700', color: theme.colors.textTertiary },
  classLoading: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  classLoadingText: { fontSize: 13, color: theme.colors.textSecondary },
  classEmptyText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  studentCardScroll: { marginHorizontal: -2 },
  studentCardRow: { gap: 12, paddingHorizontal: 2, paddingVertical: 8, paddingRight: 8 },
  studentCard: {
    width: 128,
    minHeight: 148,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
      default: { boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)' },
    }),
  },
  studentCardSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
    ...Platform.select({
      ios: { shadowOpacity: 0.14, shadowRadius: 12 },
      android: { elevation: 5 },
      default: { boxShadow: '0 10px 28px rgba(99, 102, 241, 0.18)' },
    }),
  },
  studentCardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  studentCardAvatarSelected: { backgroundColor: '#E0E7FF' },
  studentCardInitial: { fontSize: 18, fontWeight: '800', color: '#6366F1' },
  studentCardInitialSelected: { color: '#4F46E5' },
  studentCardName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
    minHeight: 32,
    color: theme.colors.text,
  },
  studentCardAdm: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    color: theme.colors.textSecondary,
  },
  selectedCount: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
});