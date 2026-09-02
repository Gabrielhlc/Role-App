import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, Platform } from "react-native";
import { Marker, AnimatedRegion } from "react-native-maps";
import { ParticipantLocation } from "../../app/map/[roomId]";

interface FriendMarkerProps {
  friend: ParticipantLocation;
}

export const FriendMarker = React.memo(({ friend }: FriendMarkerProps) => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  // Permite que o Android meça as dimensões e renderize a inicial antes de congelar o snapshot
  useEffect(() => {
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const animatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: friend.latitude,
      longitude: friend.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  useEffect(() => {
    const newCoordinate = {
      latitude: friend.latitude,
      longitude: friend.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    };

    if (Platform.OS === "android") {
      animatedCoordinate
        .timing({
          ...newCoordinate,
          duration: 2500,
          useNativeDriver: false,
          toValue: 0,
        })
        .start();
    } else {
      animatedCoordinate
        .timing({
          ...newCoordinate,
          duration: 2500,
          useNativeDriver: false,
          toValue: 0,
        })
        .start();
    }
  }, [friend.latitude, friend.longitude]);

  return (
    <Marker.Animated
      coordinate={animatedCoordinate as any}
      title={friend.username}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.markerContainer}>
        {/* Círculo do Amigo */}
        <View style={styles.friendAvatarContainer}>
          <Text style={styles.friendInitialText}>
            {friend.username.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Nome do Amigo */}
        <View style={styles.friendLabelContainer}>
          <Text style={styles.friendLabelText} numberOfLines={1}>
            {friend.username}
          </Text>
        </View>
      </View>
    </Marker.Animated>
  );
});

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 90,
  },
  friendAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  friendInitialText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 18,
    textAlign: "center",
    includeFontPadding: false,
  },
  friendLabelContainer: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
    maxWidth: 90,
  },
  friendLabelText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
  },
});
