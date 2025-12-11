import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Radio, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  AlertCircle,
  Music2,
  Wifi,
  WifiOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AgoraRTC, { IAgoraRTCClient, ILocalAudioTrack } from "agora-rtc-sdk-ng";

interface Song {
  id: string;
  filename: string;
  originalName: string;
  size: number;
}

interface StreamConfig {
  appId: string;
  channel: string;
  token: string;
  userId: string;
}

export default function StreamPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const audioTrackRef = useRef<ILocalAudioTrack | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Use bot.js API URL for stream config (where updated credentials are stored)
  const botApiUrl = import.meta.env.VITE_BOT_API_URL || '';

  const { data: configData, refetch: refetchConfig } = useQuery({
    queryKey: ['/api/jack/stream-config'],
    queryFn: async () => {
      const url = botApiUrl ? `${botApiUrl}/api/jack/stream-config` : '/api/jack/stream-config';
      const res = await fetch(url);
      return res.json();
    }
  });

  const { data: songsData } = useQuery({
    queryKey: ['/api/jack/stream-songs'],
    queryFn: async () => {
      const url = botApiUrl ? `${botApiUrl}/api/jack/stream-songs` : '/api/jack/stream-songs';
      const res = await fetch(url);
      return res.json();
    }
  });

  const streamConfig: StreamConfig | null = configData?.success ? configData.data : null;
  const songs: Song[] = songsData?.data || [];
  const currentSong = songs[currentIndex];
  const sseRef = useRef<EventSource | null>(null);
  const songsRef = useRef<Song[]>([]);
  
  // Keep songs ref updated
  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  // Pending action from SSE events
  const pendingActionRef = useRef<'play' | 'next' | null>(null);

  // Connect to SSE for stream control events from external bot.js
  useEffect(() => {
    const sseUrl = botApiUrl ? `${botApiUrl}/api/jack/stream-events` : '/api/jack/stream-events';
    console.log('Connecting to SSE at:', sseUrl);
    const eventSource = new EventSource(sseUrl);
    sseRef.current = eventSource;

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Stream event received:', data);
        
        if (data.action === 'play') {
          // If we have a paused audio element, just resume it
          if (audioElementRef.current && audioElementRef.current.paused) {
            audioElementRef.current.play().then(() => {
              setIsPlaying(true);
            }).catch(err => console.error('Error resuming:', err));
            toast({ title: "Remote Play", description: "Admin resumed playback" });
          } else if (data.songIndex !== undefined) {
            // Start playing a specific song
            setCurrentIndex(data.songIndex);
            pendingActionRef.current = 'play';
            toast({ title: "Remote Play", description: "Admin triggered play command" });
          }
        } else if (data.action === 'pause') {
          if (audioElementRef.current) {
            audioElementRef.current.pause();
            setIsPlaying(false);
            toast({ title: "Remote Pause", description: "Admin paused the stream" });
          }
        } else if (data.action === 'next') {
          if (data.songIndex !== undefined) {
            setCurrentIndex(data.songIndex);
            pendingActionRef.current = 'next';
          }
          toast({ title: "Remote Next", description: "Admin skipped to next song" });
        } else if (data.action === 'stop') {
          if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.currentTime = 0;
            setIsPlaying(false);
            toast({ title: "Remote Stop", description: "Admin stopped the stream" });
          }
        } else if (data.action === 'reconnect') {
          // Reconnect with new Agora credentials from bot.js
          toast({ title: "Reconnecting", description: "Admin triggered Agora reconnect..." });
          
          // First disconnect any existing connection
          try {
            if (audioTrackRef.current) {
              audioTrackRef.current.stop();
              audioTrackRef.current.close();
              audioTrackRef.current = null;
            }
            if (clientRef.current) {
              await clientRef.current.leave();
              clientRef.current = null;
            }
            if (audioElementRef.current) {
              audioElementRef.current.pause();
              audioElementRef.current = null;
            }
            setIsConnected(false);
            setIsPlaying(false);
          } catch (err) {
            console.error('Error disconnecting for reconnect:', err);
          }
          
          // Fetch fresh config from bot.js (which has updated credentials)
          try {
            const configUrl = botApiUrl ? `${botApiUrl}/api/jack/stream-config` : '/api/jack/stream-config';
            const configRes = await fetch(configUrl);
            const freshConfig = await configRes.json();
            
            if (freshConfig.success && freshConfig.data) {
              const { appId, channel, token, userId } = freshConfig.data;
              
              setIsConnecting(true);
              const client = AgoraRTC.createClient({ mode: "live", codec: "vp8", role: "host" });
              clientRef.current = client;
              
              await client.join(appId, channel, token, userId);
              
              setIsConnected(true);
              setCurrentIndex(0);
              
              // Refetch the query cache so UI reflects new config
              refetchConfig();
              
              // Start playing first song
              setTimeout(() => {
                playLocalAudio(0);
              }, 500);
              
              toast({ title: "Reconnected", description: `Joined channel: ${channel}` });
            } else {
              // Just play locally without Agora if no credentials
              setCurrentIndex(0);
              setTimeout(() => {
                playLocalAudio(0);
              }, 100);
              toast({ title: "Playing Locally", description: "No Agora credentials available" });
            }
          } catch (err: any) {
            console.error('Error reconnecting:', err);
            toast({ title: "Reconnect Failed", description: err.message || "Could not reconnect", variant: "destructive" });
            // Fallback to local playback
            setCurrentIndex(0);
            setTimeout(() => {
              playLocalAudio(0);
            }, 100);
          } finally {
            setIsConnecting(false);
          }
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return () => {
      eventSource.close();
      sseRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // Handle pending SSE actions after currentIndex updates (works without Agora connection)
  useEffect(() => {
    if (pendingActionRef.current && songs.length > 0) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      
      // Small delay to ensure state is updated
      setTimeout(() => {
        if (action === 'play' || action === 'next') {
          playLocalAudio(currentIndex);
        }
      }, 100);
    }
  }, [currentIndex, songs.length]);

  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  const connect = async () => {
    if (!streamConfig) {
      toast({ title: "Error", description: "Stream configuration not available", variant: "destructive" });
      return;
    }

    setIsConnecting(true);

    try {
      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8", role: "host" });
      clientRef.current = client;

      // Pass userId as string directly - don't convert to number
      // Agora will include it in the detail["6"] field of the request
      await client.join(
        streamConfig.appId,
        streamConfig.channel,
        streamConfig.token,
        streamConfig.userId
      );

      setIsConnected(true);
      toast({ title: "Connected", description: `Joined channel: ${streamConfig.channel}` });
    } catch (error: any) {
      toast({ title: "Connection failed", description: error.message || "Could not connect to channel", variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
        audioTrackRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
    setIsConnected(false);
    setIsPlaying(false);
  };

  // Play local audio without requiring Agora connection (used by remote SSE commands)
  const playLocalAudio = async (index: number) => {
    const song = songs[index];
    if (!song) return;

    try {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }

      const botApiUrl = import.meta.env.VITE_BOT_API_URL || '';
      const audioUrl = botApiUrl 
        ? `${botApiUrl}/api/jack/songs/file/${song.filename}`
        : `/api/jack/songs/file/${song.filename}`;

      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = audioUrl;
      audio.volume = isMuted ? 0 : volume / 100;
      audioElementRef.current = audio;

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.onended = () => {
        // Auto-play next song
        const nextIndex = (index + 1) % songs.length;
        setCurrentIndex(nextIndex);
        playLocalAudio(nextIndex);
      };

      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing local audio:', error);
    }
  };

  // Play a specific song by index (used by SSE events when Agora connected)
  const playSongAtIndex = async (index: number) => {
    const song = songs[index];
    if (!song || !clientRef.current) return;

    try {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }

      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = `/api/jack/songs/file/${song.filename}`;
      audio.volume = isMuted ? 0 : volume / 100;
      audioElementRef.current = audio;

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.onended = () => {
        playNext();
      };

      await audio.play();

      // Create audio track from media stream
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(audio);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination);

      if (audioTrackRef.current) {
        await clientRef.current.unpublish(audioTrackRef.current);
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
      }

      const track = AgoraRTC.createCustomAudioTrack({
        mediaStreamTrack: destination.stream.getAudioTracks()[0]
      });
      audioTrackRef.current = track;

      await clientRef.current.publish(track);
      setIsPlaying(true);
      toast({ title: "Now playing", description: song.originalName });
    } catch (error: any) {
      toast({ title: "Playback error", description: error.message || "Could not play song", variant: "destructive" });
    }
  };

  const playSong = async () => {
    if (!currentSong || !clientRef.current) return;

    try {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }

      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = `/api/jack/songs/file/${currentSong.filename}`;
      audio.volume = isMuted ? 0 : volume / 100;
      audioElementRef.current = audio;

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.onended = () => {
        playNext();
      };

      await audio.play();

      // Create audio track from media stream
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(audio);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination); // Also play locally

      if (audioTrackRef.current) {
        await clientRef.current.unpublish(audioTrackRef.current);
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
      }

      const track = AgoraRTC.createCustomAudioTrack({
        mediaStreamTrack: destination.stream.getAudioTracks()[0]
      });
      audioTrackRef.current = track;

      await clientRef.current.publish(track);
      setIsPlaying(true);
      toast({ title: "Now playing", description: currentSong.originalName });
    } catch (error: any) {
      toast({ title: "Playback error", description: error.message || "Could not play song", variant: "destructive" });
    }
  };

  const pauseSong = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resumeSong = () => {
    if (audioElementRef.current) {
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  };

  const playNext = () => {
    if (songs.length === 0) return;
    const nextIndex = (currentIndex + 1) % songs.length;
    setCurrentIndex(nextIndex);
    if (isConnected) {
      setTimeout(() => playSong(), 100);
    }
  };

  const playPrevious = () => {
    if (songs.length === 0) return;
    const prevIndex = currentIndex === 0 ? songs.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    if (isConnected) {
      setTimeout(() => playSong(), 100);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const configError = configData && !configData.success;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stream</h1>
        <p className="text-muted-foreground mt-1">
          Stream music to Agora channel
        </p>
      </div>

      {configError && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Configuration Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {configData.message}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              <CardTitle>Stream Control</CardTitle>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <CardDescription>
            {streamConfig ? `Channel: ${streamConfig.channel}` : "Configure Agora credentials in .env file"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-3">
            {!isConnected ? (
              <Button 
                onClick={connect} 
                disabled={isConnecting || !streamConfig}
                className="gap-2"
              >
                {isConnecting ? (
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
                {isConnecting ? "Connecting..." : "Connect"}
              </Button>
            ) : (
              <Button onClick={disconnect} variant="destructive" className="gap-2">
                <WifiOff className="h-4 w-4" />
                Disconnect
              </Button>
            )}
          </div>

          {isConnected && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-16 w-16 rounded-lg bg-primary/10">
                  <Music2 className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {currentSong?.originalName || "No song selected"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {songs.length > 0 ? `Track ${currentIndex + 1} of ${songs.length}` : "No songs in queue"}
                  </p>
                </div>
              </div>

              {currentSong && (
                <div className="space-y-2">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={1}
                    className="cursor-pointer"
                    onValueChange={(val) => {
                      if (audioElementRef.current) {
                        audioElementRef.current.currentTime = val[0];
                      }
                    }}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playPrevious}
                  disabled={songs.length === 0}
                >
                  <SkipBack className="h-5 w-5" />
                </Button>
                
                {!isPlaying ? (
                  <Button
                    size="icon"
                    className="h-12 w-12 rounded-full"
                    onClick={isPlaying ? resumeSong : playSong}
                    disabled={songs.length === 0}
                  >
                    <Play className="h-6 w-6 ml-0.5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="h-12 w-12 rounded-full"
                    onClick={pauseSong}
                  >
                    <Pause className="h-6 w-6" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playNext}
                  disabled={songs.length === 0}
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Slider
                  value={[volume]}
                  max={100}
                  step={1}
                  className="w-32"
                  onValueChange={(val) => setVolume(val[0])}
                />
                <span className="text-sm text-muted-foreground w-8">{volume}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-primary" />
            <CardTitle>Queue</CardTitle>
          </div>
          <CardDescription>
            Songs will play in order. Current queue has {songs.length} song{songs.length !== 1 ? 's' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {songs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Music2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No songs in queue</p>
              <p className="text-sm">Upload songs in the Music page first</p>
            </div>
          ) : (
            <div className="space-y-1">
              {songs.map((song, index) => (
                <div
                  key={song.id}
                  onClick={() => {
                    setCurrentIndex(index);
                    if (isConnected && isPlaying) {
                      setTimeout(() => playSong(), 100);
                    }
                  }}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    index === currentIndex 
                      ? "bg-primary/10 border border-primary/20" 
                      : "hover:bg-muted"
                  }`}
                >
                  <div className={`flex items-center justify-center h-6 w-6 rounded text-xs font-medium ${
                    index === currentIndex ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`truncate ${index === currentIndex ? "font-medium" : ""}`}>
                    {song.originalName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
