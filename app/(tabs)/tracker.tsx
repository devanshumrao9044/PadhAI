import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';

const COLOR_OPTIONS = ['#6B21A8', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
const ICON_OPTIONS = ['book', 'functions', 'biotech', 'shutter-speed', 'psychology', 'computer'];

export default function TrackerScreen() {
  const router = useRouter();
  const { subjects, addSubject } = useApp();

  const [modalVisible, setModalVisible] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  // 🚀 Infinite Loading ko todne wala core function
  const handleCreateSubject = async () => {
    if (!subjectName.trim()) return;
    
    setSaving(true);
    try {
      if (typeof addSubject === 'function') {
        await addSubject(subjectName.trim(), selectedColor, selectedIcon);
      }
      
      setModalVisible(false);
      setSubjectName('');
      setSelectedColor(COLOR_OPTIONS[0]);
      setSelectedIcon(ICON_OPTIONS[0]);
    } catch (error: any) {
      console.error("Error creating subject, trying object format:", error);
      try {
        // @ts-ignore
        await addSubject({ name: subjectName.trim(), colorHex: selectedColor, icon: selectedIcon });
        setModalVisible(false);
        setSubjectName('');
      } catch (innerError) {
        alert("Subject save nahi ho paya. Database policy check karein.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📚 Study Tracker</Text>
        <TouchableOpacity 
          style={styles.addBtn} 
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={20} color={Colors.background} />
        </TouchableOpacity>
      </View>

      {/* Subjects List */}
      {!subjects || subjects.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="library-books" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No subjects found</Text>
          <Text style={styles.emptyText}>Tap + to add your first subject</Text>
        </View>
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.subjectCard}
              onPress={() => router.push(`/tracker/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardInfo}>
                <View style={[styles.subjectDot, { backgroundColor: item.colorHex || Colors.primary }]}>
                  <MaterialIcons name={(item.iconName as any) || 'book'} size={14} color={Colors.background} />
                </View>
                <Text style={styles.subjectName}>{item.name}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Add Subject Bottom Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Naya Subject</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Subject name (e.g. Physics)"
              placeholderTextColor={Colors.textTertiary}
              value={subjectName}
              onChangeText={setSubjectName}
              autoFocus
              maxLength={40}
            />

            {/* Color Selection */}
            <Text style={styles.sectionLabel}>Select Color</Text>
            <View style={styles.optionsRow}>
              {COLOR_OPTIONS.map(c => (
                <TouchableOpacity 
                  key={c} 
                  style={[styles.colorCircle, { backgroundColor: c }, selectedColor === c && styles.circleSelected]} 
                  onPress={() => setSelectedColor(c)}
                />
              ))}
            </View>

            {/* 🚀 Icon Selection Added Here */}
            <Text style={styles.sectionLabel}>Select Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconScrollRow}>
              {ICON_OPTIONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconBox,
                    selectedIcon === icon && { backgroundColor: selectedColor }
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <MaterialIcons 
                    name={icon as any} 
                    size={24} 
                    color={selectedIcon === icon ? Colors.background : Colors.textSecondary} 
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: selectedColor }, (!subjectName.trim() || saving) ? styles.saveBtnDisabled : null]}
              onPress={handleCreateSubject}
              disabled={!subjectName.trim() || saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <Text style={styles.saveBtnText}>Subject Add Karo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  addBtn: { backgroundColor: Colors.primary, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  subjectCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subjectDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  subjectName: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.base, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  input: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 14, color: Colors.textPrimary, fontSize: FontSize.md, marginBottom: Spacing.md },
  sectionLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm, fontWeight: FontWeight.medium },
  optionsRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  colorCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  circleSelected: { borderColor: Colors.textPrimary },
  
  // 🚀 New Styles for Icon Picker
  iconScrollRow: { gap: 12, marginBottom: Spacing.xl },
  iconBox: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  
  saveBtn: { borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
