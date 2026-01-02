
export enum MoodPreset {
  CHILL = 'Chill & Relaxed',
  STUDY = 'Deep Focus',
  RAINY = 'Rainy Evening',
  COZY = 'Cozy Fireplace',
  DREAMY = 'Dreamy Night'
}

export interface TrackMetadata {
  id: string;
  name: string;
  artist: string;
  bpm: number;
  mood: string;
  color: string;
  introText: string;
  musicalParameters: {
    key: string;
    scaleType: 'major' | 'minor' | 'pentatonic';
    chordProgression: string[];
    filterCutoff: number;
    reverbWet: number;
    melodyComplexity: number; // 0.0 to 1.0
  };
}

export interface AudioState {
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
}
