import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { Photo } from '../../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PhotoLightboxProps {
  photos: Photo[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  initialIndex,
  visible,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / screenWidth);
    setCurrentIndex(index);
  };

  const navigateToPhoto = (index: number) => {
    if (index >= 0 && index < photos.length) {
      setCurrentIndex(index);
      scrollViewRef.current?.scrollTo({
        x: index * screenWidth,
        animated: true,
      });
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCoordinates = (latitude: number, longitude: number) => {
    return `${latitude.toFixed(6)}°, ${longitude.toFixed(6)}°`;
  };

  if (!visible || photos.length === 0) {
    return null;
  }

  const currentPhoto = photos[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <Text style={styles.photoCounter}>
              {currentIndex + 1} of {photos.length}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(currentPhoto.timestamp)}
            </Text>
          </View>
        </View>

        {/* Photo carousel */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          contentOffset={{ x: initialIndex * screenWidth, y: 0 }}
          style={styles.photoCarousel}
        >
          {photos.map((photo, index) => (
            <View key={photo.photoId} style={styles.photoContainer}>
              <Image
                source={{ uri: photo.localUri }}
                style={styles.photo}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>

        {/* Navigation arrows */}
        {photos.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={[styles.navButton, styles.prevButton]}
                onPress={() => navigateToPhoto(currentIndex - 1)}
                activeOpacity={0.8}
              >
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
            )}
            
            {currentIndex < photos.length - 1 && (
              <TouchableOpacity
                style={[styles.navButton, styles.nextButton]}
                onPress={() => navigateToPhoto(currentIndex + 1)}
                activeOpacity={0.8}
              >
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Footer with photo info */}
        <View style={styles.footer}>
          <Text style={styles.coordinates}>
            📍 {formatCoordinates(currentPhoto.latitude, currentPhoto.longitude)}
          </Text>
          {currentPhoto.caption && (
            <Text style={styles.caption}>{currentPhoto.caption}</Text>
          )}
        </View>

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <View style={styles.thumbnailStrip}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailContainer}
            >
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={photo.photoId}
                  style={[
                    styles.thumbnail,
                    index === currentIndex && styles.activeThumbnail,
                  ]}
                  onPress={() => navigateToPhoto(index)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: photo.thumbnailUri || photo.localUri }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
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
  headerInfo: {
    alignItems: 'flex-end',
  },
  photoCounter: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  photoCarousel: {
    flex: 1,
  },
  photoContainer: {
    width: screenWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: screenWidth - 40,
    height: screenHeight - 300,
    maxHeight: screenHeight - 300,
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
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  coordinates: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'center',
  },
  caption: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  thumbnailStrip: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 10,
  },
  thumbnailContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumbnail: {
    borderColor: '#4CAF50',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});

export default PhotoLightbox;