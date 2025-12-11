import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
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
  WifiOff,
  Search,
  LogIn,
  LogOut,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AgoraRTC, { IAgoraRTCClient, ILocalAudioTrack } from "agora-rtc-sdk-ng";

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

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

interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: string;
  album: string;
  albumArt: string | null;
  duration: number;
  previewUrl: string | null;
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
  
  // Spotify state
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyPlayer, setSpotifyPlayer] = useState<any>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [spotifyReady, setSpotifyReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSpotifyTrack, setCurrentSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const [spotifyIsPlaying, setSpotifyIsPlaying] = useState(false);
  const [spotifyPosition, setSpotifyPosition] = useState(0);
  const [spotifyDuration, setSpotifyDuration] = useState(0);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const audioTrackRef = useRef<ILocalAudioTrack | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const spotifyTokenRef = useRef<string | null>(null);
  const { toast } = useToast();

  const { data: configData } = useQuery({
    queryKey: ['/api/jack/stream-config'],
    queryFn: async () => {
      const res = await fetch('/api/jack/stream-config');
      return res.json();
    }
  });

  const { data: songsData } = useQuery({
    queryKey: ['/api/jack/stream-songs'],
    queryFn: async () => {
      const res = await fetch('/api/jack/stream-songs');
      return res.json();
    }
  });

  // Check Spotify connection status
  const { data: spotifyStatus, refetch: refetchSpotifyStatus } = useQuery({
    queryKey: ['/api/jack/spotify/status'],
    queryFn: async () => {
      const res = await fetch('/api/jack/spotify/status');
      return res.json();
    },
    refetchInterval: 30000
  });

  // Initialize Spotify status
  useEffect(() => {
    if (spotifyStatus?.success && spotifyStatus?.data?.connected) {
      setSpotifyConnected(true);
      initSpotifyPlayer();
    } else {
      setSpotifyConnected(false);
    }
  }, [spotifyStatus]);

  // Check URL params for Spotify callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify_connected') === 'true') {
      toast({ title: "Spotify Connected", description: "Successfully connected to Spotify!" });
      refetchSpotifyStatus();
      window.history.replaceState({}, '', '/stream');
    } else if (params.get('spotify_error')) {
      toast({ title: "Spotify Error", description: params.get('spotify_error') || "Connection failed", variant: "destructive" });
      window.history.replaceState({}, '', '/stream');
    }
  }, []);

  // Initialize Spotify Web Playback SDK
  const initSpotifyPlayer = useCallback(async () => {
    if (spotifyPlayer) return;

    // Get access token
    const tokenRes = await fetch('/api/jack/spotify/token');
    const tokenData = await tokenRes.json();
    if (!tokenData.success) return;
    
    spotifyTokenRef.current = tokenData.data.accessToken;

    // Load Spotify SDK script if not already loaded
    if (!window.Spotify) {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'RexSquad Stream Player',
        getOAuthToken: async (cb: (token: string) => void) => {
          // Refresh token if needed
          const res = await fetch('/api/jack/spotify/token');
          const data = await res.json();
          if (data.success) {
            spotifyTokenRef.current = data.data.accessToken;
            cb(data.data.accessToken);
          }
        },
        volume: volume / 100
      });

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Spotify player ready with device ID:', device_id);
        setSpotifyDeviceId(device_id);
        setSpotifyReady(true);
        toast({ title: "Spotify Ready", description: "Web player initialized" });
      });

      player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Device has gone offline:', device_id);
        setSpotifyReady(false);
      });

      player.addListener('player_state_changed', (state: any) => {
        if (!state) return;
        setSpotifyIsPlaying(!state.paused);
        setSpotifyPosition(state.position);
        setSpotifyDuration(state.duration);
        
        if (state.track_window?.current_track) {
          const track = state.track_window.current_track;
          setCurrentSpotifyTrack({
            id: track.id,
            uri: track.uri,
            name: track.name,
            artists: track.artists.map((a: any) => a.name).join(', '),
            album: track.album.name,
            albumArt: track.album.images[0]?.url || null,
            duration: state.duration,
            previewUrl: null
          });
        }
      });

      player.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('Spotify init error:', message);
        toast({ title: "Spotify Error", description: message, variant: "destructive" });
      });

      player.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('Spotify auth error:', message);
        setSpotifyConnected(false);
        toast({ title: "Spotify Auth Error", description: "Please reconnect to Spotify", variant: "destructive" });
      });

      player.addListener('playback_error', ({ message }: { message: string }) => {
        console.error('Spotify playback error:', message);
        toast({ title: "Playback Error", description: message, variant: "destructive" });
      });

      player.addListener('autoplay_failed', () => {
        console.log('Autoplay is not allowed by the browser');
        toast({ title: "Autoplay Blocked", description: "Click play to start music", variant: "default" });
      });

      // Activate element for autoplay policy
      player.activateElement();
      
      player.connect().then((success: boolean) => {
        if (success) {
          console.log('Spotify player connected successfully');
        } else {
          console.error('Failed to connect Spotify player');
          toast({ title: "Connection Failed", description: "Could not connect to Spotify. Make sure you have Premium.", variant: "destructive" });
        }
      });
      
      setSpotifyPlayer(player);
    };

    // If SDK already loaded, trigger the callback
    if (window.Spotify) {
      window.onSpotifyWebPlaybackSDKReady();
    }
  }, [spotifyPlayer, volume, toast]);

  // Search Spotify
  const searchSpotify = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/jack/spotify/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data);
      } else {
        toast({ title: "Search failed", description: data.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Search error", description: "Could not search Spotify", variant: "destructive" });
    }
    setIsSearching(false);
  };

  // Play Spotify track
  const playSpotifyTrack = async (track: SpotifyTrack) => {
    if (!spotifyDeviceId || !spotifyTokenRef.current) {
      toast({ title: "Not ready", description: "Spotify player not initialized", variant: "destructive" });
      return;
    }

    try {
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${spotifyTokenRef.current}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [track.uri]
        })
      });
      setCurrentSpotifyTrack(track);
      toast({ title: "Now Playing", description: `${track.name} - ${track.artists}` });
    } catch (error) {
      toast({ title: "Playback error", description: "Could not play track", variant: "destructive" });
    }
  };

  // Spotify playback controls
  const toggleSpotifyPlayback = () => {
    if (spotifyPlayer) {
      spotifyPlayer.togglePlay();
    }
  };

  const skipSpotifyNext = () => {
    if (spotifyPlayer) {
      spotifyPlayer.nextTrack();
    }
  };

  const skipSpotifyPrevious = () => {
    if (spotifyPlayer) {
      spotifyPlayer.previousTrack();
    }
  };

  // Disconnect from Spotify
  const disconnectSpotify = async () => {
    if (spotifyPlayer) {
      spotifyPlayer.disconnect();
      setSpotifyPlayer(null);
    }
    await fetch('/api/jack/spotify/logout', { method: 'POST' });
    setSpotifyConnected(false);
    setSpotifyReady(false);
    setSpotifyDeviceId(null);
    setCurrentSpotifyTrack(null);
    toast({ title: "Disconnected", description: "Logged out from Spotify" });
  };

  const formatSpotifyTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
    const botApiUrl = import.meta.env.VITE_BOT_API_URL || '';
    const sseUrl = botApiUrl ? `${botApiUrl}/api/jack/stream-events` : '/api/jack/stream-events';
    console.log('Connecting to SSE at:', sseUrl);
    const eventSource = new EventSource(sseUrl);
    sseRef.current = eventSource;

    eventSource.onmessage = (event) => {
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

      {/* Spotify Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music2 className="h-5 w-5 text-green-500" />
              <CardTitle>Spotify</CardTitle>
            </div>
            <Badge variant={spotifyConnected ? "default" : "secondary"} className="gap-1 bg-green-600">
              {spotifyConnected ? "Connected" : "Not Connected"}
            </Badge>
          </div>
          <CardDescription>
            Search and play songs from Spotify (requires Premium)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!spotifyConnected ? (
            <Button 
              onClick={() => window.location.href = '/api/jack/spotify/login'}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <LogIn className="h-4 w-4" />
              Connect to Spotify
            </Button>
          ) : (
            <>
              {/* Search */}
              <div className="flex gap-2">
                <Input
                  placeholder="Search for songs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchSpotify()}
                />
                <Button onClick={searchSpotify} disabled={isSearching} className="gap-2">
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
                  {searchResults.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => playSpotifyTrack(track)}
                    >
                      {track.albumArt && (
                        <img src={track.albumArt} alt={track.album} className="h-10 w-10 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{track.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.artists}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="shrink-0">
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Now Playing */}
              {currentSpotifyTrack && spotifyReady && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                  <div className="flex items-center gap-4">
                    {currentSpotifyTrack.albumArt && (
                      <img src={currentSpotifyTrack.albumArt} alt={currentSpotifyTrack.album} className="h-16 w-16 rounded-lg" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{currentSpotifyTrack.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{currentSpotifyTrack.artists}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <Slider
                      value={[spotifyPosition]}
                      max={spotifyDuration || 100}
                      step={1000}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatSpotifyTime(spotifyPosition)}</span>
                      <span>{formatSpotifyTime(spotifyDuration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <Button variant="outline" size="icon" onClick={skipSpotifyPrevious}>
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button size="icon" onClick={toggleSpotifyPlayback} className="h-12 w-12">
                      {spotifyIsPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={skipSpotifyNext}>
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {spotifyConnected && !spotifyReady && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Initializing Spotify player...</span>
                </div>
              )}

              <Button variant="outline" onClick={disconnectSpotify} className="gap-2">
                <LogOut className="h-4 w-4" />
                Disconnect Spotify
              </Button>
            </>
          )}
        </CardContent>
      </Card>

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
