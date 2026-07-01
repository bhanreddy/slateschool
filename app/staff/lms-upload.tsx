import React, { useState, useEffect } from 'react';
import AppTextInput from '@/src/components/AppTextInput';

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import StaffHeader from '../../src/components/StaffHeader';
import ViewAsBanner from '../../src/components/ViewAsBanner';
import { useEffectiveStaffId } from '../../src/hooks/useEffectiveStaffId';
import { api } from '../../src/services/apiClient';
import { TeacherService, TeacherClassAssignment } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
interface CreateCourseResponse {
  course: {
    id: string;
  };
}
export default function StaffLMSUpload() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const { isViewingAsAdmin, viewAsName } = useEffectiveStaffId();
  const [topic, setTopic] = useState(''); // Serves as Course Title (Subject/Topic)
  const [subTopic, setSubTopic] = useState(''); // Serves as Material Title

  // Dynamic Class/Subject Selection
  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherClassAssignment | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    fetchMetadata();
  }, []);
  const fetchMetadata = async () => {
    try {
      // Fetch teacher's assigned classes
      const data = await TeacherService.getMyClasses();
      setAssignments(data);
      if (data.length > 0) {
        // Auto-select first assignment
        setSelectedAssignment(data[0]);
        // Auto-populate topic with subject name as a default
        setTopic(data[0].subject_name);
      }
    } catch (error) {

      alertCompat('Error', 'Could not load your assigned classes');
    }
  };

  // Update topic when assignment changes
  useEffect(() => {
    if (selectedAssignment) {
      setTopic(selectedAssignment.subject_name);
    }
  }, [selectedAssignment]);
  const handleUpload = async () => {
    if (isViewingAsAdmin) {
      alertCompat('Read-only', 'Content can\'t be uploaded while viewing another staff member\'s portal.');
      return;
    }
    if (!selectedAssignment || !topic || !subTopic || !videoUrl) {
      alertCompat('Error', 'Please fill in all required fields');
      return;
    }
    try {
      setLoading(true);

      // 1. Create or Find Course (Topic)
      // We use the selected assignment to get class_id and subject_id

      const newCourse = await api.post<CreateCourseResponse>('/lms/courses', {
        title: topic,
        description: description || `Course for ${selectedAssignment.class_name}-${selectedAssignment.section_name}`,
        class_id: selectedAssignment.class_id,
        subject_id: selectedAssignment.subject_id,
        is_published: true
      });
      if (!newCourse || !newCourse.course) {
        throw new Error('Failed to create course context');
      }

      // 2. Create Material
      await api.post(`/lms/courses/${newCourse.course.id}/materials`, {
        title: subTopic,
        description: description,
        material_type: 'video',
        // defaulting to video for now
        content_url: videoUrl,
        sort_order: 1,
        is_published: true
      });
      alertCompat('Success', 'Content uploaded successfully!', [{
        text: 'OK',
        onPress: () => router.back()
      }]);
    } catch (error) {

      const msg = error instanceof Error ? error.message : 'Unknown error';
      alertCompat('Error', 'Failed to upload content. ' + msg);
    } finally {
      setLoading(false);
    }
  };
  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <StaffHeader title="Upload LMS Content" showBackButton={true} />
    {isViewingAsAdmin && <ViewAsBanner name={viewAsName} limited />}

    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{
      flex: 1
    }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.formCard}>
          <Text style={styles.cardTitle}>Add New Content</Text>

          {/* Class Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Class & Subject <Text style={styles.required}>*</Text></Text>
            {assignments.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {assignments.map((assign) => {
                return <TouchableOpacity key={assign.assignment_id} style={[styles.chip, selectedAssignment?.assignment_id === assign.assignment_id && styles.chipActive]} onPress={() => setSelectedAssignment(assign)}>
                  <Text style={[styles.chipText, selectedAssignment?.assignment_id === assign.assignment_id && styles.chipTextActive]}>
                    {assign.class_name}-{assign.section_name} : {assign.subject_name}
                  </Text>
                </TouchableOpacity>;
              })}
            </ScrollView> : <Text style={styles.errorText}>No classes assigned to you.</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Course Title (Subject) <Text style={styles.required}>*</Text></Text>
            <AppTextInput style={styles.input} placeholder="e.g. Mathematics" value={topic} onChangeText={setTopic} placeholderTextColor="#9CA3AF" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Material Title (Topic) <Text style={styles.required}>*</Text></Text>
            <AppTextInput style={styles.input} placeholder="e.g. Algebra - Quadratic Equations" value={subTopic} onChangeText={setSubTopic} placeholderTextColor="#9CA3AF" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>YouTube Video Link <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputIconWrapper}>
              <Ionicons name="logo-youtube" size={20} color="#EF4444" style={styles.inputIcon} />
              <AppTextInput style={[styles.input, {
                paddingLeft: 45
              }]} placeholder="https://youtube.com/..." value={videoUrl} onChangeText={setVideoUrl} autoCapitalize="none" placeholderTextColor="#9CA3AF" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <AppTextInput style={[styles.input, {
              height: 100,
              textAlignVertical: 'top'
            }]} placeholder="Enter a brief description of the content..." value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholderTextColor="#9CA3AF" />
          </View>

          <TouchableOpacity style={styles.uploadButton} onPress={handleUpload} activeOpacity={0.8} disabled={loading}>
            <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.gradientButton} start={{
              x: 0,
              y: 0
            }} end={{
              x: 1,
              y: 0
            }}>
              {loading ? <LogoLoader color="#FFF" /> : <>
                <MaterialIcons name="cloud-upload" size={24} color="#FFF" />
                <Text style={styles.uploadButtonText}>Upload Content</Text>
              </>}
            </LinearGradient>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  content: {
    padding: 20
  },
  formCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 20,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20
  },
  inputGroup: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8
  },
  required: {
    color: '#EF4444'
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937'
  },
  inputIconWrapper: {
    position: 'relative',
    justifyContent: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: 15,
    zIndex: 1
  },
  uploadButton: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10
  },
  uploadButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: 'bold'
  },
  horizontalScroll: {
    flexDirection: 'row'
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 10,
    backgroundColor: theme.colors.card
  },
  chipActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF'
  },
  chipText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  chipTextActive: {
    color: '#3B82F6',
    fontWeight: '600'
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14
  }
});