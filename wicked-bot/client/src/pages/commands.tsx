import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, Shield, Users, Zap } from "lucide-react";

export default function Commands() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bot Commands</h1>
        <p className="text-muted-foreground mt-1">Complete list of available bot commands</p>
      </div>

      {/* Public Commands */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-500" />
            <CardTitle>Public Commands</CardTitle>
          </div>
          <CardDescription>
            Available to all users in the club
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/mic</code>
              <p className="text-muted-foreground">Request a mic invite (members/loyal members only)</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/admins</code>
              <p className="text-muted-foreground">Display list of all admins with names and IDs</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/whois [id]</code>
              <p className="text-muted-foreground">Show current and old names for a player ID</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">[BotName] [msg]</code>
              <p className="text-muted-foreground">Chat with the bot using ChatGPT</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Commands */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            <CardTitle>Admin-Only Commands</CardTitle>
          </div>
          <CardDescription>
            Restricted to configured admin users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/spam [word]</code>
              <p className="text-muted-foreground">Add a word to the spam filter list</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/ulm [num]</code>
              <p className="text-muted-foreground">Unlock specific mic number (or "all" for all mics)</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/lm [num]</code>
              <p className="text-muted-foreground">Lock specific mic number (or "all" for all mics)</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/cn [name]</code>
              <p className="text-muted-foreground">Change the bot's display name</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/say [msg]</code>
              <p className="text-muted-foreground">Make the bot send a message</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/rejoin</code>
              <p className="text-muted-foreground">Make the bot leave and rejoin the club</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/ub all</code>
              <p className="text-muted-foreground">Unban all banned users</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/ub check</code>
              <p className="text-muted-foreground">Fetch and display the current ban list</p>
            </div>
            <div className="flex gap-3">
              <code className="font-mono bg-muted px-2 py-1 rounded min-w-[140px]">/joinMic</code>
              <p className="text-muted-foreground">Make the bot join a mic</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Special Triggers */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <CardTitle>Special Triggers</CardTitle>
          </div>
          <CardDescription>
            Automated bot responses and actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Terminal className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Auto-moderation</p>
                <p className="text-muted-foreground">Messages containing spam words trigger automatic kick and message deletion</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Terminal className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Welcome messages</p>
                <p className="text-muted-foreground">Bot automatically welcomes new users joining the club</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}