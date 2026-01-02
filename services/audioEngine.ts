
import { TrackMetadata } from "../types";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private mainGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private lfoGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private vinylNode: AudioBufferSourceNode | null = null;
  
  private isStarted = false;
  private currentTrack: TrackMetadata | null = null;
  private schedulerTimer: number | null = null;
  private nextNoteTime = 0;
  private currentStep = 0;
  private introSource: AudioBufferSourceNode | null = null;

  private ambientGains: Record<string, GainNode> = {};

  // Music Theory Helpers
  private noteFreqs: Record<string, number> = {
    'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63, 'F': 349.23,
    'F#': 369.99, 'G': 391.99, 'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
  };

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.mainGain = this.ctx.createGain();
      this.masterFilter = this.ctx.createBiquadFilter();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.value = 1800;
      
      // LFO for "Tape Wobble" Filter modulation
      const lfo = this.ctx.createOscillator();
      this.lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.15; // Slow breath
      this.lfoGain.gain.value = 400; // Subtle movement
      lfo.connect(this.lfoGain);
      this.lfoGain.connect(this.masterFilter.frequency);
      lfo.start();

      this.masterFilter.connect(this.analyser);
      this.analyser.connect(this.mainGain);
      this.mainGain.connect(this.ctx.destination);
      this.mainGain.gain.setValueAtTime(0.6, this.ctx.currentTime);

      this.initAmbientSounds();
      this.initVinylTexture();
    }
  }

  private initVinylTexture() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      const crackle = Math.pow(Math.random(), 30) * (Math.random() > 0.5 ? 1 : -1);
      data[i] = white * 0.01 + crackle * 0.15;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    source.connect(gain);
    gain.connect(this.mainGain!);
    source.start();
    this.vinylNode = source;
  }

  private initAmbientSounds() {
    if (!this.ctx) return;
    ['rain', 'wind', 'beach', 'birds'].forEach(type => {
      const gain = this.ctx!.createGain();
      gain.gain.value = 0;
      gain.connect(this.mainGain!);
      this.ambientGains[type] = gain;
    });
    // ... Simplified ambient logic inherited from previous version ...
  }

  setAmbientVolume(type: string, volume: number) {
    if (this.ambientGains[type]) {
      this.ambientGains[type].gain.setTargetAtTime(volume, this.ctx?.currentTime || 0, 0.2);
    }
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  async playIntro(base64: string) {
    this.initContext();
    if (!this.ctx || !base64) return;
    if (this.introSource) { try { this.introSource.stop(); } catch(e) {} }
    const audioData = this.decode(base64);
    const audioBuffer = await this.decodeAudioData(audioData, this.ctx, 24000, 1);
    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.analyser!);
    source.start();
    this.introSource = source;
  }

  setTrack(track: TrackMetadata) {
    this.currentTrack = track;
    this.currentStep = 0; 
    if (this.masterFilter && this.ctx) {
      this.masterFilter.frequency.setTargetAtTime(track.musicalParameters.filterCutoff || 1800, this.ctx.currentTime, 0.5);
    }
  }

  start() {
    this.initContext();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    if (this.isStarted) return;
    this.isStarted = true;
    this.nextNoteTime = this.ctx!.currentTime;
    this.schedule();
  }

  stop() {
    this.isStarted = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private schedule() {
    if (!this.isStarted || !this.ctx || !this.currentTrack) return;
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.playStep(this.currentStep, this.nextNoteTime);
      this.advanceStep();
    }
    this.schedulerTimer = window.setTimeout(() => this.schedule(), 25);
  }

  private advanceStep() {
    const secondsPerBeat = 60.0 / (this.currentTrack?.bpm || 80);
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.currentStep = (this.currentStep + 1) % 128; // 8 bar phrases
  }

  private playStep(step: number, time: number) {
    if (!this.currentTrack) return;
    
    // Humanized Jitter
    const jitter = (Math.random() - 0.5) * 0.005;
    const t = time + jitter;

    // Structural Arrangement
    const isBreakdown = (step >= 64 && step < 80); // Bar 5 intro breakdown
    const drumComplexity = isBreakdown ? 0.2 : 1.0;

    // DRUMS
    if (Math.random() < drumComplexity) {
      if (step % 16 === 0 || (step % 16 === 10 && Math.random() > 0.7)) this.playKick(t, 0.6);
      if (step % 16 === 8) this.playSnare(t, 0.25);
      if (step % 16 === 7 || step % 16 === 15) this.playSnare(t, 0.05); // Ghost note
      if (step % 2 === 0) {
        const vel = (step % 4 === 0) ? 0.04 : 0.02;
        this.playHiHat(t, vel);
      }
    }

    // CHORDS & BASS
    if (step % 16 === 0) {
      const idx = Math.floor(step / 16) % (this.currentTrack.musicalParameters.chordProgression.length || 1);
      const chord = this.currentTrack.musicalParameters.chordProgression[idx];
      this.playChord(t, chord);
      this.playBass(t, chord);
    }

    // GENERATIVE MELODY (Pentatonic Wandering)
    const melodyComplexity = this.currentTrack.musicalParameters.melodyComplexity || 0.4;
    if (!isBreakdown && Math.random() < melodyComplexity && (step % 4 === 0 || (step % 4 === 2 && Math.random() > 0.5))) {
      this.playLead(t);
    }
  }

  private playKick(time: number, vol: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.4);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
    osc.connect(gain);
    gain.connect(this.masterFilter!);
    osc.start(time);
    osc.stop(time + 0.4);
  }

  private playSnare(time: number, vol: number) {
    if (!this.ctx) return;
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterFilter!);
    noise.start(time);
    noise.stop(time + 0.15);
  }

  private playHiHat(time: number, vol: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(12000, time);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    osc.connect(gain);
    gain.connect(this.masterFilter!);
    osc.start(time);
    osc.stop(time + 0.04);
  }

  private playBass(time: number, chord: string) {
    if (!this.ctx) return;
    const root = chord.replace(/[a-zA-Z]?[0-9]+/g, '').substring(0, 2).trim();
    const freq = (this.noteFreqs[root] || 261) / 4; // Drop 2 octaves
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.1);
    gain.gain.linearRampToValueAtTime(0, time + 3.5);
    osc.connect(gain);
    gain.connect(this.mainGain!);
    osc.start(time);
    osc.stop(time + 4);
  }

  private playChord(time: number, chord: string) {
    if (!this.ctx) return;
    // Map simplified chords to frequencies
    const notes = [261.63, 329.63, 392.00, 493.88]; // Mock Cmaj7
    notes.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, time + i * 0.02); // Strum effect
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.02, time + 0.5);
      gain.gain.linearRampToValueAtTime(0, time + 4);
      osc.connect(gain);
      gain.connect(this.masterFilter!);
      osc.start(time);
      osc.stop(time + 4.1);
    });
  }

  private playLead(time: number) {
    if (!this.ctx) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.00]; // Pentatonic C
    const freq = scale[Math.floor(Math.random() * scale.length)];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.04, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
    osc.connect(gain);
    gain.connect(this.masterFilter!);
    osc.start(time);
    osc.stop(time + 0.8);
  }

  private createNoiseBuffer() {
    const bufferSize = this.ctx!.sampleRate * 0.2;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  }
}

export const audioEngine = new AudioEngine();
