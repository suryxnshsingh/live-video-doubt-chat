# Live Video Ask - Interactive Learning Platform

A proof-of-concept (POC) application that simulates a live video learning experience with real-time transcription and AI-powered Q&A capabilities.

## Features

- 🎥 **Live Video Simulation**: Video player without seek controls to simulate live streaming
- 🎙️ **Real-time Transcription**: Live transcription using Soniox API (or simulated for POC)
- 💬 **AI-Powered Chat**: Ask questions via text or voice, get contextual answers
- 🎯 **Smart Classification**: Distinguishes between genuine academic questions and noise
- 🌐 **Bilingual Support**: Works with Hindi and English (Hinglish)
- 🎤 **Voice Input**: Ask questions using your microphone

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Transcription**: Soniox API (real-time) / Simulated for POC
- **AI**: OpenAI GPT-4 for chat responses
- **Voice**: OpenAI Whisper for voice-to-text

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your API keys:
```env
NEXT_PUBLIC_SONIOX_API_KEY=your_soniox_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

**Note**: If no Soniox API key is provided, the app will use simulated transcription for demonstration purposes.

### 3. Add Sample Video

Place a sample lecture video file in the `public` directory:
- File name: `sample-lecture.mp4`
- Format: MP4 with clear audio
- Recommended: 5-10 minute educational content
- Language: Hindi/English mix preferred

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. **Start the Video**: Click the play button to start the "live" session
2. **Watch Transcript Build**: See real-time transcription appear as the video plays
3. **Ask Questions**:
   - Click the floating chat button (bottom-right)
   - Type your question or use the microphone
   - Get AI-powered answers based on the lecture context
4. **Live Experience**: Video cannot be scrubbed/seeked to simulate live streaming

## Project Structure

```
live-video-ask/
├── app/
│   ├── api/
│   │   ├── chat/          # OpenAI chat endpoint
│   │   └── transcribe/    # Voice transcription endpoint
│   ├── page.tsx           # Main page
│   └── layout.tsx         # Root layout
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── LiveVideoPlayer.tsx    # Video player (no seek)
│   ├── TranscriptPanel.tsx    # Live transcript display
│   ├── ChatDialog.tsx         # Chat interface
│   ├── ChatInput.tsx          # Text/voice input
│   └── AskButton.tsx          # Floating action button
├── hooks/
│   └── useSonioxTranscription.ts  # Transcription hook
├── public/
│   └── sample-lecture.mp4    # Your video file (add this)
└── .env.local                 # Environment variables
```

## Key Features Explained

### Live Video Simulation
- Video plays linearly without seek controls
- Simulates a live streaming experience
- "LIVE" indicator shows active session

### Real-time Transcription
- Captures audio from video element
- Streams to Soniox API via WebSocket
- Falls back to simulated transcription if no API key

### AI-Powered Responses
- Classifies questions (genuine academic vs noise)
- Provides contextual answers based on recent transcript
- Formatted responses with proper structure
- Bilingual support (Hindi/English)

### Voice Input
- Click microphone to record question
- Automatic transcription via OpenAI Whisper
- Seamless integration with chat

## API Keys

### Soniox API
- Sign up at [https://soniox.com](https://soniox.com)
- Free tier available for testing
- Used for real-time transcription

### OpenAI API
- Get key from [https://platform.openai.com](https://platform.openai.com)
- Required for chat responses and voice transcription
- Uses GPT-4 for intelligent responses

## Development Notes

- **POC Mode**: Transcription is simulated if no Soniox key is provided
- **CORS**: Video must be served from same origin (local file works)
- **Browser Support**: Chrome/Edge recommended for best compatibility
- **Mobile**: Currently optimized for desktop experience

## Future Enhancements

- [ ] Multiple video support
- [ ] User authentication
- [ ] Transcript persistence
- [ ] Analytics dashboard
- [ ] Mobile optimization
- [ ] Production deployment with proper API proxy
- [ ] Support for live RTMP streams

## Troubleshooting

### Video Not Playing
- Ensure `sample-lecture.mp4` exists in `/public`
- Check browser console for errors
- Try a different video format if needed

### Transcription Not Working
- Check if Soniox API key is valid
- Verify browser supports Web Audio API
- Check console for WebSocket errors

### Chat Not Responding
- Verify OpenAI API key is set
- Check API rate limits
- Look for errors in browser console

### Voice Input Issues
- Allow microphone permissions when prompted
- Ensure HTTPS or localhost (required for getUserMedia)
- Check if browser supports MediaRecorder API

## License

This is a proof-of-concept project for educational purposes.