import { useState } from 'react';
import { Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { AlertBox } from '../shared/AlertBox';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { DocumentEntityType, DocumentRow, useDocumentsForEntity, useUploadDocument } from '../../lib/query/documents';
import { formatDate } from '../../lib/format';
import { isDocumentImage } from '../../lib/domain/documents';

const PRIMARY = '#2F4A7D';

function fileIcon(doc: DocumentRow): keyof typeof Ionicons.glyphMap {
  if (isDocumentImage(doc)) return 'image-outline';
  if ((doc.file_name ?? '').toLowerCase().endsWith('.pdf')) return 'document-text-outline';
  return 'document-outline';
}

export function EntityDocumentsCard({
  entityType,
  entityId,
  title = 'Files',
  emptyText = 'No files uploaded yet',
  uploadedBy = 'landlord',
}: {
  entityType: DocumentEntityType;
  entityId: string;
  title?: string;
  emptyText?: string;
  uploadedBy?: 'landlord' | 'tenant';
}) {
  const { data: documents } = useDocumentsForEntity(entityType, entityId);
  const uploadDocument = useUploadDocument();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState<DocumentRow | null>(null);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setMessage('');
    setError('');

    try {
      await uploadDocument.mutateAsync({
        entityType,
        entityId,
        docType: 'other',
        uri: asset.uri,
        fileName: asset.name,
        contentType: asset.mimeType,
        uploadedBy,
      });
      setMessage('File uploaded.');
    } catch {
      setError('Could not upload this file right now.');
    }
  }

  async function openFile(doc: DocumentRow) {
    if (isDocumentImage(doc)) {
      setSelectedImage(doc);
      return;
    }
    await WebBrowser.openBrowserAsync(doc.file_url);
  }

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: '#111827' }}>{title}</Text>
          <TouchableOpacity
            onPress={pickFile}
            disabled={uploadDocument.isPending}
            activeOpacity={0.75}
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3FF', opacity: uploadDocument.isPending ? 0.6 : 1 }}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        {message ? <AlertBox type="success" message={message} /> : null}
        {error ? <AlertBox type="error" message={error} /> : null}

        {(documents ?? []).length === 0 ? (
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 14 }}>{emptyText}</Text>
        ) : documents!.map((doc, index) => (
          <TouchableOpacity
            key={doc.id}
            onPress={() => openFile(doc)}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: index < documents!.length - 1 ? 1 : 0, borderBottomColor: '#F1EFEC' }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1EFEC', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name={fileIcon(doc)} size={18} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
                {doc.file_name ?? 'Uploaded file'}
              </Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>
                {formatDate(doc.uploaded_at)}
              </Text>
            </View>
            <Ionicons name={isDocumentImage(doc) ? 'expand-outline' : 'open-outline'} size={16} color="#9CA3AF" />
          </TouchableOpacity>
        ))}

        {(documents ?? []).length > 0 ? (
          <Button
            label="Upload Another File"
            variant="secondary"
            loading={uploadDocument.isPending}
            onPress={pickFile}
            style={{ marginTop: 14 }}
          />
        ) : (
          <Button
            label="Upload File"
            loading={uploadDocument.isPending}
            onPress={pickFile}
          />
        )}
      </Card>

      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.92)', padding: 16, justifyContent: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedImage(null)}
            activeOpacity={0.8}
            style={{ position: 'absolute', top: 54, right: 20, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {selectedImage ? (
            <Image source={{ uri: selectedImage.file_url }} resizeMode="contain" style={{ width: '100%', height: '82%' }} />
          ) : null}
        </View>
      </Modal>
    </>
  );
}
