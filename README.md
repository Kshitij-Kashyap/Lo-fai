# [Lo-fAI 🎵](https://kshitij-kashyap.github.io/Lo-fai/)

A generative lo-fi beat producer powered by Google's Gemini AI. Describe a vibe and let AI create unique procedural beats with customizable ambient sounds.

## Features

- **AI-Powered Generation**: Use Gemini AI to create unique lo-fi tracks from text descriptions
- **Mood Presets**: Choose from 5 preset moods (Chill & Relaxed, Deep Focus, Rainy Evening, Cozy Fireplace, Dreamy Night)
- **Ambient Mixer**: Layer rainfall, wind, ocean tides, and bird sounds
- **Procedural Audio**: Real-time synthesis with dynamic parameters
- **Dark/Light Mode**: Toggle between themes
- **Voice Narration**: Optional AI-generated intros for each track
- **Track History**: Keep a journey of generated tracks

## Setup

### 1. Get Your Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy your API key

### 2. Install & Run

```bash
npm install
npm run dev
```

### 3. Configure API Key in App

1. Click the **"Configure Gemini Key"** button in the app footer
2. Paste your Gemini API key in the modal
3. Click **"Save Key"** (stored locally in your browser)

## Usage

- **Generate**: Type a vibe description or select a mood preset to generate a track
- **Play**: Click the play button to listen to the procedural beat
- **Ambient**: Adjust rainfall, wind, ocean, and bird sounds with the mixer sliders
- **History**: View previously generated tracks and jump between them

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Google Gemini AI API
- Lucide React Icons

## Build

```bash
npm run build
npm run preview
```
