import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Photo } from '../../types';

const { width, height } = Dimensions.get('window');

interface PhotoGalleryProps {
  photos: Photo[];
  onPhotoPress?: (photo: Photo) => void;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos, onPhotoPress }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  const handlePhotoPress = (photo: Photo) => {
    setSelectedPhoto(photo);
    setLightboxVisible(true);
    onPhotoPress?.(photo);
  };

  const closeLightbox = () => {
    setLightboxVisible(false);
    setSelectedPhoto(null);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!selectedPhoto) return;
    
    const currentIndex = photos.findIndex(p => p.photoId === selectedPhoto.photoId);
    let newIndex;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
    } else {
      newIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
    }
    
    setSelectedPhoto(photos[newIndex]);
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (photos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No photos captured during this activity</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Photos ({photos.length})</Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.galleryContainer}
      >
        {photos.map((photo, index) => (
          <TouchableOpacity
            key={photo.photoId}
            style={styles.thumbnailContainer}
            onPress={() => handlePhotoPress(photo)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: photo.thumbnailUri || photo.localUri }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            <Text style={styles.photoTime}>{formatTime(photo.timestamp)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Photo Lightbox Modal */}
      <Modal
        visible={lightboxVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeLightbox}
      >
        <SafeAreaView style={styles.lightboxContainer}>
          {/* Header */}
          <View style={styles.lightboxHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={closeLightbox}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.photoCounter}>
              {selectedPhoto && `${photos.findIndex(p => p.photoId === selectedPhoto.photoId) + 1} of ${photos.length}`}
            </Text>
            <View style={styles.placeholder} />
          </View>

          {/* Photo viewer */}
          <View style={styles.photoContainer}>
            {selectedPhoto && (
              <Image
                source={{ uri: selectedPhoto.localUri }}
                style={styles.fullPhoto}
                resizeMode="contain"
              />
            )}
            
            {/* Navigation buttons */}
            {photos.length > 1 && (
              <>
                <TouchableOpacity
                  style={[styles.navButton, styles.prevButton]}
                  onPress={() => navigatePhoto('prev')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.navButtonText}>‹</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.navButton, styles.nextButton]}
                  onPress={() => navigatePhoto('next')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.navButtonText}>›</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Photo info */}
          {selectedPhoto && (
            <View style={styles.photoInfo}>
              <Text style={styles.photoInfoText}>
                Captured at {selectedPhoto.timestamp.toLocaleString()}
              </Text>
              <Text style={styles.photoInfoText}>
                Location: {selectedPhoto.latitude.toFixed(6)}, {selectedPhoto.longitude.toFixed(6)}
              </Text>
              {selectedPhoto.caption && (
                <Text style={styles.photoCaption}>{selectedPhoto.caption}</Text>
              )}
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  galleryContainer: {
    paddingRight: 16,
  },
  thumbnailContainer: {
    marginRight: 12,
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 4,
  },
  photoTime: {
    fontSize: 10,
    color: '#666',
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  lightboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  photoCounter: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  placeholder: {
    width: 40,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullPhoto: {
    width: width,
    height: height * 0.7,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -25,
  },
  prevButton: {
    left: 20,
  },
  nextButton: {
    right: 20,
  },
  navButtonText: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
  },
  photoInfo: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  photoInfoText: {
    color: 'white',
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.8,
  },
  photoCaption: {
    color: 'white',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default PhotoGallery;