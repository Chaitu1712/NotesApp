import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Button } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotesScreen() {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await axios.get('https://localhost:3000/notes', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotes(response.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchNotes();
  }, []);

  return (
    <View>
      <Text>Notes</Text>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <Text>{item.content}</Text>}
      />
      <Button title="Add Note" onPress={() => { /* Navigate to Add Note Screen */ }} />
    </View>
  );
}